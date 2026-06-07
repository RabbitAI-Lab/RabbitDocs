import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { registerProjectTools } from "./tools/project";
import { registerFileTools } from "./tools/file";
import { registerDirectoryTools } from "./tools/directory";
import { registerTemplateTools } from "./tools/template";
import { registerTodoTools } from "./tools/todo";
import { validateApiKey } from "@/lib/auth/api-key";
import { runWithMcpContext } from "./context";

const PORT = parseInt(process.env.MCP_PORT || "4001");
const HOST = process.env.MCP_HOST || "127.0.0.1";
const transports = new Map<string, NodeStreamableHTTPServerTransport>();
const sessionUserIds = new Map<string, string | null>();

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "rabbitdocs-mcp", version: "1.0.0" });
  registerProjectTools(server);
  registerFileTools(server);
  registerDirectoryTools(server);
  registerTemplateTools(server);
  registerTodoTools(server);
  // Client tools (refresh_file_tree, preview_html) — 供 ACP Agent 使用
  // 实际动作由前端通过 SSE tool_call 事件执行，这里只返回固定文本
  registerClientTools(server);
  return server;
}

export function startMcpServer() {
  const app = createMcpExpressApp({ host: HOST });

  // POST /mcp — 处理 MCP 请求（新 session 或已有 session）
  app.post("/mcp", async (req, res) => {
    // API Key 认证（支持多种 header 格式）
    // 格式1: Authorization: Bearer atm_xxx
    // 格式2: api-key: atm_xxx（旧格式兼容）
    const authHeader = req.headers["authorization"] as string | undefined;
    const apiKeyHeader = req.headers["api-key"] as string | undefined;
    let rawKey: string | undefined;
    if (authHeader?.startsWith("Bearer atm_")) {
      rawKey = authHeader.slice(7);
    } else if (apiKeyHeader?.startsWith("atm_")) {
      rawKey = apiKeyHeader;
    }
    let requestUserId: string | null = null;
    if (rawKey) {
      const validated = validateApiKey(rawKey);
      if (!validated) {
        res.status(401).json({ error: "Invalid API key" });
        return;
      }
      requestUserId = validated.userId;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: NodeStreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
      // 如果本次请求带了认证信息，更新 session 绑定的 userId
      if (requestUserId) {
        sessionUserIds.set(sessionId, requestUserId);
      }
    } else if (!sessionId) {
      const newSessionId = randomUUID();
      transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });
      transports.set(newSessionId, transport);
      sessionUserIds.set(newSessionId, requestUserId);
      const server = createMcpServer();
      await server.connect(transport);
    } else {
      res.status(400).json({ error: "Invalid session" });
      return;
    }

    // 确定最终 userId：优先本次请求认证，其次 session 绑定的 userId
    const finalSessionId = sessionId || [...transports.keys()].pop()!;
    const userId = requestUserId ?? sessionUserIds.get(finalSessionId) ?? null;
    await runWithMcpContext({ userId }, () =>
      transport.handleRequest(req, res, req.body)
    );
  });

  // GET /mcp — SSE stream（服务端推送通知）
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session" });
      return;
    }
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp — 终止 session
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.close();
      transports.delete(sessionId);
      sessionUserIds.delete(sessionId);
    }
    res.status(204).end();
  });

  app.listen(PORT, HOST, () => {
    console.log(
      `[MCP] RabbitDocs MCP Server running on http://${HOST}:${PORT}/mcp`
    );
  });
}

/**
 * 注册 client tools（refresh_file_tree, preview_html）到 MCP server。
 * 这些工具用于通知前端刷新文件树或预览 HTML 文件。
 * ACP Agent 通过 MCP 调用这些工具，前端通过 SSE tool_call 事件执行实际动作。
 */
function registerClientTools(server: McpServer) {
  server.registerTool(
    "refresh_file_tree",
    {
      description:
        "Refresh the file tree in the user's UI. Call this tool after you create, delete, or rename files or directories so the user immediately sees the updated file tree.",
    },
    async () => ({
      content: [
        { type: "text" as const, text: "File tree refresh notification sent." },
      ],
    })
  );

  server.registerTool(
    "preview_html",
    {
      description:
        "Open or switch to an HTML file in the project workspace tab. The path is relative to the project root, e.g. 'docs/index.html'.",
      inputSchema: z.object({ path: z.string().describe("HTML file path relative to the project root, e.g. 'docs/foo.html'") }),
    },
    async ({ path }: { path: string }) => {
      if (!path || typeof path !== "string" || !path.endsWith(".html")) {
        throw new Error("preview_html only accepts .html files");
      }
      return {
        content: [
          { type: "text" as const, text: `Preview requested for ${path}` },
        ],
      };
    }
  );

  server.registerTool(
    "refresh_file_content",
    {
      description:
        "Notify the frontend to reload a file's content in the editor after it has been modified externally.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to the project root, e.g. 'docs/foo.md'"),
      }),
    },
    async ({ path }: { path: string }) => {
      if (!path || typeof path !== "string") {
        throw new Error("refresh_file_content requires a valid path");
      }
      return {
        content: [
          { type: "text" as const, text: `File content refresh requested for ${path}` },
        ],
      };
    }
  );
}
