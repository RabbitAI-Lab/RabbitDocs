import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { randomUUID } from "node:crypto";
import { registerProjectTools } from "./tools/project";
import { registerFileTools } from "./tools/file";
import { registerDirectoryTools } from "./tools/directory";
import { registerTemplateTools } from "./tools/template";
import { validateApiKey } from "@/lib/auth/api-key";

const PORT = parseInt(process.env.MCP_PORT || "4001");
const HOST = process.env.MCP_HOST || "127.0.0.1";
const transports = new Map<string, NodeStreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "rabbitdocs-mcp", version: "1.0.0" });
  registerProjectTools(server);
  registerFileTools(server);
  registerDirectoryTools(server);
  registerTemplateTools(server);
  return server;
}

export function startMcpServer() {
  const app = createMcpExpressApp({ host: HOST });

  // POST /mcp — 处理 MCP 请求（新 session 或已有 session）
  app.post("/mcp", async (req, res) => {
    // API Key 认证（可选：如果提供了 Bearer token 则验证）
    const authHeader = req.headers["authorization"] as string | undefined;
    if (authHeader?.startsWith("Bearer atm_")) {
      const key = authHeader.slice(7);
      const validated = validateApiKey(key);
      if (!validated) {
        res.status(401).json({ error: "Invalid API key" });
        return;
      }
      // 认证通过，继续处理
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: NodeStreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else if (!sessionId) {
      const newSessionId = randomUUID();
      transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });
      transports.set(newSessionId, transport);
      const server = createMcpServer();
      await server.connect(transport);
    } else {
      res.status(400).json({ error: "Invalid session" });
      return;
    }

    await transport.handleRequest(req, res, req.body);
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
    }
    res.status(204).end();
  });

  app.listen(PORT, HOST, () => {
    console.log(
      `[MCP] RabbitDocs MCP Server running on http://${HOST}:${PORT}/mcp`
    );
  });
}
