import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Query, Options, McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { createClientToolsMcpServer, CLIENT_TOOL_PREFIX } from "./client-tools";
import { parseExtraEnv } from "./model-env";
import { db } from "@/db";
import { modelConfigs, mcpConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ModelError } from "./types";
import type { StreamEvent } from "./types";
import { readProjectMcpConfig as readProjectMcpConfigFromFs, getDataRoot } from "./fs";

type ModelConfigRow = {
  id: number;
  provider: string;
  protocol: "openai" | "anthropic";
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  extraEnvJson: string;
  backend: string; // "sdk" | "acp"
};

export function resolveModelConfig(modelId: number): ModelConfigRow {
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

export function readMcpServers(): Record<string, McpServerConfig> | undefined {
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
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: {
    systemPrompt?: string;
    cwd?: string;
    projectId?: string;
    userId?: string;
    workspaceId?: string;
    chatId?: number;
  }
): AsyncGenerator<StreamEvent> {
  const config = resolveModelConfig(modelId);

  // ACP 后端分流
  if (config.backend === "acp" && options?.userId && options?.chatId) {
    const { streamAcpModelResponse } = await import("./acp-model-service");
    yield* streamAcpModelResponse(modelId, messages, {
      userId: options.userId,
      projectId: options.projectId,
      workspaceId: options.workspaceId,
      chatId: options.chatId,
      cwd: options.cwd,
    });
    return;
  }

  // Format conversation as prompt text
  const promptParts: string[] = [];
  // 优先从 messages 中提取 system 消息
  const hasSystemMessage = messages.length > 0 && messages[0].role === "system";
  if (hasSystemMessage) {
    promptParts.push(`[System Instructions]: ${messages[0].content}\n\n`);
  } else if (options?.systemPrompt) {
    promptParts.push(`[System Instructions]: ${options.systemPrompt}\n\n`);
  }
  const chatMessages = hasSystemMessage ? messages.slice(1) : messages;
  for (const msg of chatMessages) {
    const label = msg.role === "user" ? "用户" : "助手";
    promptParts.push(`[${label}]: ${msg.content}`);
  }
  const prompt = promptParts.join("\n\n");

  const cwd = options?.cwd || process.cwd();

  // 解析用户配置的 extra env（来自 model_configs.extra_env_json）
  const userExtraEnv = parseExtraEnv(config.extraEnvJson);

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
    // Layer 3.5: PreToolUse hook — 在权限规则检查之前执行，可拦截预批准的工具
    // Write .md 文件路径约束：必须写入 docs/ 目录
    hooks: {
      PreToolUse: [{
        matcher: "Write",
        hooks: [async (input) => {
          const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input;
          const filePath = toolInput?.file_path as string | undefined;
          if (filePath && filePath.endsWith(".md")) {
            const resolved = path.resolve(cwd, filePath);
            const docsDir = path.resolve(cwd, "docs");
            if (!resolved.startsWith(docsDir + path.sep)) {
              return {
                decision: "block" as const,
                reason: "Markdown (.md) files must be written to the docs/ directory. Please adjust the file path to be under docs/.",
              };
            }
          }
          return { continue: true };
        }],
      }],
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
      // 用户配置的环境变量（来自 model_configs.extra_env_json）
      // 注意：硬编码项在下方 spread 之后赋值，避免被用户覆盖
      ...userExtraEnv,
      // 系统级硬编码（覆盖优先级最高）
      ANTHROPIC_BASE_URL: config.baseUrl,
      ANTHROPIC_API_KEY: config.apiKey,
      ANTHROPIC_MODEL: config.modelName,
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_AGENT_SDK_CLIENT_APP: "RabbitDocs/0.1.0",
    } as Record<string, string | undefined>,
  };

  // 注入 MCP 服务器配置（全局 MCP + 项目 MCP + 客户端 tool in-process MCP）
  const globalMcpServers = readMcpServers();
  let projectMcpServers: Record<string, McpServerConfig> | undefined;
  if (options?.projectId) {
    try {
      // 从 cwd 推算 dirSegments（cwd 格式: .../personal/{userId}/projects/{projectId}）
      const dataRoot = getDataRoot();
      let projectDirSegments: string[] | undefined;
      if (options.cwd && options.cwd.startsWith(dataRoot)) {
        const rel = path.relative(dataRoot, options.cwd).split(path.sep);
        // 期望格式: ["personal", "{userId}", "projects", "{projectId}"]
        if (rel.length >= 4 && rel[0] === "personal" && rel[2] === "projects") {
          projectDirSegments = rel.slice(0, 4);
        }
      }
      // 回退到 default（兼容迁移前数据）
      if (!projectDirSegments) {
        projectDirSegments = ["personal", "default", "projects", options.projectId];
      }
      const projectConfig = readProjectMcpConfigFromFs(projectDirSegments);
      if (projectConfig?.mcpServers && typeof projectConfig.mcpServers === "object") {
        projectMcpServers = projectConfig.mcpServers as Record<string, McpServerConfig>;
      }
    } catch {
      // 项目级 MCP 配置读取失败，忽略
    }
  }
  const clientToolsServer = createClientToolsMcpServer();
  // 为所有 MCP 配置添加 alwaysLoad: true，确保 SDK 同步等待 MCP 连接完成再构建 prompt
  // 否则 stdio/sse 类型的 MCP 如果启动较慢，第一轮对话时工具尚未注册，会报 "no tool available"
  const withAlwaysLoad = (servers: Record<string, McpServerConfig> | undefined): Record<string, McpServerConfig> | undefined => {
    if (!servers) return undefined;
    return Object.fromEntries(
      Object.entries(servers).map(([name, cfg]) => [name, { ...cfg, alwaysLoad: true }])
    );
  };
  sdkOptions.mcpServers = {
    ...withAlwaysLoad(globalMcpServers),
    ...withAlwaysLoad(projectMcpServers),
    rabbitdocs_client: clientToolsServer,
  };
  sdkOptions.allowedTools = [
    "mcp__rabbitdocs_client__*",
    "mcp__rabbitdocs__*",
    "mcp__gitnexus__*",
    "mcp__zhipu-web-search-sse__*",
    "Read", "Write", "Edit",
    "Glob", "Grep", "WebFetch",
  ];

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
  console.log("[AgentSDK] systemPrompt (from options):", options?.systemPrompt ? `(length: ${options.systemPrompt.length})` : "(none)");
  console.log("[AgentSDK] messages[0] system content:", hasSystemMessage ? `(length: ${messages[0].content.length})` : "(none)");
  console.log("[AgentSDK] messages count:", messages.length);
  console.log("[AgentSDK] prompt length:", prompt.length);
  console.log("[AgentSDK] mcpServers:", Object.keys(sdkOptions.mcpServers).join(", "));
  console.log("[AgentSDK] env ANTHROPIC_BASE_URL:", config.baseUrl);
  console.log("[AgentSDK] env ANTHROPIC_MODEL:", config.modelName);
  console.log("[AgentSDK] extra env count:", Object.keys(userExtraEnv).length);
  console.log(
    "[AgentSDK] extra env keys:",
    Object.keys(userExtraEnv).join(", ") || "(none)"
  );
  console.log("[AgentSDK] ==========================================");

  let accumulatedText = "";
  let accumulatedThinking = "";
  let lastThinkingSignature: string | undefined;
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
        // 1) Extended Thinking 块起始：content_block_start 中 block.type === "thinking"
        if (event.type === "content_block_start") {
          const block = (event as { content_block?: { type?: string } }).content_block;
          if (block?.type === "thinking") {
            yield { type: "thinking_start" };
          }
          continue;
        }
        // 2) 仅处理 content_block_delta，其他 stream_event 忽略
        if (event.type !== "content_block_delta") {
          console.log("[AgentSDK] unhandled stream_event type:", event.type);
          continue;
        }
        const delta = "delta" in event ? (event as { delta?: { type?: string; text?: string; thinking?: string; signature?: string } }).delta : undefined;
        if (!delta) continue;
        if (delta.type === "text_delta" && typeof delta.text === "string") {
          // 常规正文增量
          accumulatedText += delta.text;
          yield { type: "text_delta", text: delta.text };
        } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
          // Extended Thinking 增量
          accumulatedThinking += delta.thinking;
          yield { type: "thinking_delta", text: delta.thinking };
        } else if (delta.type === "signature_delta" && typeof delta.signature === "string") {
          // Extended Thinking 签名（多轮续接时需要回传）
          lastThinkingSignature = delta.signature;
          yield { type: "thinking_signature", signature: delta.signature };
        } else {
          console.log("[AgentSDK] unhandled content_block_delta type:", delta.type);
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
          accumulatedText ||
          ("result" in message && typeof message.result === "string"
            ? message.result
            : accumulatedText);
        console.log(
          "[AgentSDK] response length:",
          resultText.length,
          "thinking length:",
          accumulatedThinking.length,
          "has signature:",
          !!lastThinkingSignature
        );
        yield {
          type: "done",
          fullText: resultText,
          thinking: accumulatedThinking || undefined,
          thinkingSignature: lastThinkingSignature,
        };
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
        const sysMsg = message as Record<string, unknown>;
        const subtype = sysMsg.subtype as string | undefined;
        console.log("[AgentSDK] system:", subtype || message.type);

        // 检测 api_retry 事件，对 529 等服务端错误直接终止，不再重试
        if (subtype === "api_retry") {
          const errorStatus = sysMsg.error_status as number | null;
          const errorType = sysMsg.error as string | undefined;
          console.warn(
            "[AgentSDK] api_retry: status=", errorStatus,
            "error=", errorType,
            "attempt=", sysMsg.attempt,
            "max_retries=", sysMsg.max_retries
          );
          // 529 = 服务端过载，429 = 限流，5xx = 服务端错误 — 这些都不应重试
          if (
            errorStatus === 529 ||
            errorStatus === 429 ||
            (errorStatus !== null && errorStatus >= 500 && errorStatus < 600)
          ) {
            const userMessage = errorStatus === 529
              ? "模型访问量过大，请稍后再试"
              : errorStatus === 429
              ? "模型调用频率超限，请稍后再试"
              : `模型服务暂时不可用 (${errorStatus})，请稍后再试`;
            console.error("[AgentSDK] 终止重试，直接返回错误:", userMessage);
            q.close();
            yield {
              type: "error",
              error: userMessage,
              code: "SERVER_OVERLOADED",
            };
            return;
          }
        }
      }
    }

    // If we never got a result message but accumulated text, yield done
    if (accumulatedText) {
      console.log(
        "[AgentSDK] stream ended without result, accumulated:",
        accumulatedText.length,
        "thinking:",
        accumulatedThinking.length
      );
      yield {
        type: "done",
        fullText: accumulatedText,
        thinking: accumulatedThinking || undefined,
        thinkingSignature: lastThinkingSignature,
      };
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
