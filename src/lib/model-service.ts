import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Query, Options, McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { createClientToolsMcpServer, CLIENT_TOOL_PREFIX } from "./client-tools";
import { db } from "@/db";
import { modelConfigs, mcpConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ModelError } from "./types";
import type { StreamEvent } from "./types";
import { readProjectMcpConfig as readProjectMcpConfigFromFs } from "./fs";

type ModelConfigRow = {
  id: number;
  provider: string;
  protocol: "openai" | "anthropic";
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
};

function resolveModelConfig(modelId: number): ModelConfigRow {
  const config = db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.id, modelId))
    .get();

  if (!config) {
    throw new ModelError("模型配置不存在，请检查模型设置", "MODEL_NOT_FOUND");
  }

  if (config.protocol !== "anthropic") {
    throw new ModelError(
      `该模型使用 ${config.protocol} 协议，暂不支持。请配置 Anthropic 兼容端点。`,
      "PROTOCOL_UNSUPPORTED"
    );
  }

  if (!config.apiKey) {
    throw new ModelError("API 密钥未配置，请检查模型设置", "INVALID_CONFIG");
  }

  return config as ModelConfigRow;
}

function readMcpServers(): Record<string, McpServerConfig> | undefined {
  const config = db.select().from(mcpConfig).get();
  if (!config?.configJson || config.configJson === "{}") return undefined;
  try {
    const parsed = JSON.parse(config.configJson);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, McpServerConfig>;
    }
  } catch {
    console.warn("[MCP] 配置 JSON 解析失败，已忽略");
  }
  return undefined;
}

export async function* streamModelResponse(
  modelId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: {
    systemPrompt?: string;
    cwd?: string;
    projectId?: string;
  }
): AsyncGenerator<StreamEvent> {
  const config = resolveModelConfig(modelId);

  // Format conversation as prompt text
  const promptParts: string[] = [];
  if (options?.systemPrompt) {
    promptParts.push(`[System Instructions]: ${options.systemPrompt}\n\n`);
  }
  for (const msg of messages) {
    const label = msg.role === "user" ? "用户" : "助手";
    promptParts.push(`[${label}]: ${msg.content}`);
  }
  const prompt = promptParts.join("\n\n");

  const cwd = options?.cwd || process.cwd();

  const sdkOptions: Options = {
    includePartialMessages: true,
    // Layer 2: 只允许显式预批准的操作，其余一律拒绝
    permissionMode: "dontAsk",
    // 不加载任何文件系统 settings，防止被注入宽松规则
    settingSources: [],
    // 只使用 SDK 传入的 MCP servers，忽略 .mcp.json 等外部配置
    strictMcpConfig: true,
    cwd,
    maxTurns: 300,
    // Layer 1: OS 级沙箱
    sandbox: {
      enabled: true,
      // 沙箱不可用时直接失败，不允许静默降级为无沙箱
      failIfUnavailable: true,
      // 禁止通过 dangerouslyDisableSandbox 绕过沙箱
      allowUnsandboxedCommands: false,
      filesystem: {
        // 在沙箱内允许读写 cwd（项目目录）
        allowWrite: [cwd],
        allowRead: [cwd],
        // 禁止读写敏感文件
        denyRead: [
          ".env", "*.db", "*.db-shm", "*.db-wal",
          "**/.env", "**/*.db", "**/*.db-shm", "**/*.db-wal",
        ],
        denyWrite: [
          ".env", "*.db", "*.db-shm", "*.db-wal",
          "**/.env", "**/*.db", "**/*.db-shm", "**/*.db-wal",
        ],
      },
    },
    // Layer 2 细节：通过 settings 定义 permission rules
    settings: {
      permissions: {
        allow: [
          // 项目目录内的文件读写
          `Read(${cwd}/**)`,
          `Edit(${cwd}/**)`,
          `Write(${cwd}/**)`,
          // 允许文件搜索
          "Glob(*)",
          "Grep(*)",
          // 允许网页抓取
          "WebFetch(*)",
          // 允许所有 MCP 工具（MCP 由系统管理员配置，可信）
          "mcp__*",
        ],
        deny: [
          // 禁止读取项目外的敏感路径
          "Read(/etc/**)",
          "Read(../**)",
          "Read(./**/.env)",
          // 禁止写入项目外
          "Write(../**)",
          "Edit(../**)",
          // 禁止 unrestricted Bash
          "Bash(*)",
        ],
      },
    },
    // Layer 3: 运行时回调，最终门控
    canUseTool: async (toolName, input) => {
      // 允许所有 MCP 工具
      if (toolName.startsWith("mcp__")) {
        return { behavior: "allow" };
      }
      // 对文件操作做路径校验
      const filePath = (input as Record<string, unknown>).file_path as string | undefined
        || (input as Record<string, unknown>).path as string | undefined;
      if (filePath) {
        const resolved = path.resolve(cwd, filePath);
        if (!resolved.startsWith(cwd)) {
          return { behavior: "deny", message: `路径超出项目范围: ${filePath}` };
        }
      }
      // 拦截 Bash 命令中的路径逃逸
      if (toolName === "Bash") {
        const command = (input as Record<string, unknown>).command as string | undefined;
        if (command && /(\.\.\/|\/etc\/|\/home\/|\/Users\/)/.test(command) && !command.includes(cwd)) {
          return { behavior: "deny", message: `Bash 命令包含项目外路径` };
        }
      }
      return { behavior: "allow" };
    },
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: config.baseUrl,
      ANTHROPIC_API_KEY: config.apiKey,
      ANTHROPIC_MODEL: config.modelName,
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_AGENT_SDK_CLIENT_APP: "ChatWiki/0.1.0",
    } as Record<string, string | undefined>,
  };

  // 注入 MCP 服务器配置（全局 MCP + 项目 MCP + 客户端 tool in-process MCP）
  const globalMcpServers = readMcpServers();
  let projectMcpServers: Record<string, McpServerConfig> | undefined;
  if (options?.projectId) {
    try {
      const projectConfig = readProjectMcpConfigFromFs(["personal", "default", "projects", options.projectId]);
      if (projectConfig?.mcpServers && typeof projectConfig.mcpServers === "object") {
        projectMcpServers = projectConfig.mcpServers as Record<string, McpServerConfig>;
      }
    } catch {
      // 项目级 MCP 配置读取失败，忽略
    }
  }
  const clientToolsServer = createClientToolsMcpServer();
  sdkOptions.mcpServers = {
    ...globalMcpServers,
    ...projectMcpServers,
    chatwiki_client: clientToolsServer,
  };
  sdkOptions.allowedTools = ["mcp__chatwiki_client__*"];

  // 服务端日志：打印 Agent SDK 调用参数
  console.log("[AgentSDK] ========== 调用开始 ==========");
  console.log("[AgentSDK] modelId:", modelId);
  console.log("[AgentSDK] provider:", config.provider);
  console.log("[AgentSDK] modelName:", config.modelName);
  console.log("[AgentSDK] baseUrl:", config.baseUrl);
  console.log("[AgentSDK] cwd:", options?.cwd || process.cwd());
  console.log("[AgentSDK] permissionMode:", sdkOptions.permissionMode);
  console.log("[AgentSDK] maxTurns:", sdkOptions.maxTurns);
  console.log("[AgentSDK] settingSources:", sdkOptions.settingSources);
  console.log("[AgentSDK] sandbox:", JSON.stringify(sdkOptions.sandbox));
  console.log("[AgentSDK] systemPrompt:", options?.systemPrompt ? `(length: ${options.systemPrompt.length})` : "(none)");
  console.log("[AgentSDK] messages count:", messages.length);
  console.log("[AgentSDK] prompt length:", prompt.length);
  console.log("[AgentSDK] mcpServers:", Object.keys(sdkOptions.mcpServers).join(", "));
  console.log("[AgentSDK] env ANTHROPIC_BASE_URL:", config.baseUrl);
  console.log("[AgentSDK] env ANTHROPIC_MODEL:", config.modelName);
  console.log("[AgentSDK] ==========================================");

  let accumulated = "";
  let q: Query;

  try {
    q = query({ prompt, options: sdkOptions });
  } catch (err) {
    yield {
      type: "error",
      error: `模型调用初始化失败: ${err instanceof Error ? err.message : String(err)}`,
      code: "SDK_ERROR",
    };
    return;
  }

  try {
    for await (const message of q) {
      if (message.type === "stream_event") {
        const event = message.event;
        if (
          event.type === "content_block_delta" &&
          "delta" in event &&
          event.delta &&
          "type" in event.delta &&
          event.delta.type === "text_delta" &&
          "text" in event.delta
        ) {
          const text = event.delta.text;
          accumulated += text;
          yield { type: "text_delta", text };
        } else {
          console.log("[AgentSDK] unhandled stream_event type:", event.type);
        }
      } else if (message.type === "result") {
        console.log("[AgentSDK] result message, error:", ("error" in message && message.error) || "(none)");
        if ("error" in message && message.error) {
          yield {
            type: "error",
            error: `模型调用失败: ${message.error}`,
            code: "SDK_ERROR",
          };
          return;
        }
        // Use accumulated text, or fall back to result text if available
        const resultText =
          accumulated ||
          ("result" in message && typeof message.result === "string"
            ? message.result
            : accumulated);
        console.log("[AgentSDK] response length:", resultText.length);
        yield { type: "done", fullText: resultText };
      } else if (message.type === "assistant") {
        // 检测客户端 tool 调用（tool_use blocks in assistant message）
        const assistantMsg = message as { type: "assistant"; message: { content: Array<{ type: string; name?: string; id?: string; input?: Record<string, unknown> }> } };
        for (const block of assistantMsg.message.content) {
          if (block.type === "tool_use" && block.name && block.name.startsWith(CLIENT_TOOL_PREFIX)) {
            const toolName = block.name.slice(CLIENT_TOOL_PREFIX.length);
            console.log("[AgentSDK] client tool_call:", toolName);
            yield {
              type: "tool_call" as const,
              toolName,
              args: (block.input as Record<string, unknown>) ?? {},
            };
          }
        }
      } else if (message.type === "system") {
        console.log("[AgentSDK] system:", (message as Record<string, unknown>).subtype || message.type);
      }
    }

    // If we never got a result message but accumulated text, yield done
    if (accumulated) {
      console.log("[AgentSDK] stream ended without result, accumulated:", accumulated.length);
      yield { type: "done", fullText: accumulated };
    }
  } catch (err) {
    console.error("[AgentSDK] stream error:", err instanceof Error ? err.message : String(err));
    yield {
      type: "error",
      error: `模型调用过程中出错: ${err instanceof Error ? err.message : String(err)}`,
      code: "SDK_ERROR",
    };
  }
}
