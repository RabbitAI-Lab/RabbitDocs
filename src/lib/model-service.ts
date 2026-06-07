import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Query, Options, McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { createClientToolsMcpServer, CLIENT_TOOL_PREFIX } from "./client-tools";
import { parseExtraEnv } from "./model-env";
import type { McpServer } from "@agentclientprotocol/sdk";
import { db } from "@/db";
import { modelConfigs, mcpConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ModelError } from "./types";
import type { StreamEvent } from "./types";
import { readProjectMcpConfig as readProjectMcpConfigFromFs } from "./fs";
import { tokenUsageLogs } from "@/db/schema";
import { getSystemKey } from "./auth/api-key";
import { resolveUserModelConfig, type UserModelConfigRow } from "./user-model-service";

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

/** 统一的模型配置接口（管理员模型 + BYOK 模型共用） */
type UnifiedModelConfig = ModelConfigRow | UserModelConfigRow;

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
  yield* streamWithConfig(config, messages, options, modelId);
}

/** BYOK 用户模型流式响应入口 */
export async function* streamUserModelResponse(
  userModelId: number,
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
  if (!options?.userId) {
    throw new ModelError("BYOK 模型需要用户认证", "INVALID_CONFIG");
  }
  const config = resolveUserModelConfig(userModelId, options.userId);
  console.log("[ModelService] BYOK userModelId=", userModelId, "provider=", config.provider);
  yield* streamWithConfig(config, messages, options, userModelId);
}

/** 共享的流式调用逻辑（管理员模型 + BYOK 模型共用） */
async function* streamWithConfig(
  config: UnifiedModelConfig,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: {
    systemPrompt?: string;
    cwd?: string;
    projectId?: string;
    userId?: string;
    workspaceId?: string;
    chatId?: number;
  },
  _modelIdForLog?: number
): AsyncGenerator<StreamEvent> {
  const modelIdForLog = _modelIdForLog ?? config.id;

  // ACP 后端分流
  console.log("[ModelService] backend=", config.backend, "userId=", options?.userId || "(none)", "chatId=", options?.chatId ?? "(none)");
  if (config.backend === "acp" && options?.userId && options?.chatId) {
    console.log("[ACP] ========== ACP 分流触发 ==========");
    console.log("[ACP] modelId:", modelIdForLog, "provider:", config.provider, "modelName:", config.modelName);
    console.log("[ACP] userId:", options.userId, "projectId:", options.projectId ?? "(none)", "workspaceId:", options.workspaceId ?? "(none)");
    console.log("[ACP] chatId:", options.chatId, "cwd:", options.cwd ?? process.cwd());
    console.log("[ACP] messages count:", messages.length);
    console.log("[ACP] ============================================");
    const { streamAcpModelResponse } = await import("./acp-model-service");
    yield* streamAcpModelResponse(modelIdForLog, messages, {
      userId: options.userId,
      projectId: options.projectId,
      workspaceId: options.workspaceId,
      chatId: options.chatId,
      cwd: options.cwd,
    }, config);
    return;
  }
  console.log("[ModelService] 使用 SDK 直调模式 (backend=", config.backend, ")");

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
    // 加载项目级 settings（.claude/settings.json + CLAUDE.md）
    // 不含 'user'（~/.claude/settings.json）和 'local'（.claude/settings.local.json）
    settingSources: ['project'],
    // 启用项目中已安装的所有 skills
    skills: 'all',
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
  const resolved = resolveMcpServersForUser(options?.userId, options?.projectId);
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
    ...withAlwaysLoad(resolved),
    rabbitdocs_client: clientToolsServer,
  };
  sdkOptions.allowedTools = [
    "mcp__rabbitdocs_client__*",
    "mcp__rabbit-docs-mcp__*",
    "mcp__gitnexus__*",
    "mcp__zhipu-web-search-sse__*",
    "Read", "Write", "Edit",
    "Glob", "Grep", "WebFetch",
  ];

  // 服务端日志：打印 Agent SDK 调用参数
  console.log("[AgentSDK] ========== 调用开始 ==========");
  console.log("[AgentSDK] modelId:", modelIdForLog);
  console.log("[AgentSDK] provider:", config.provider);
  console.log("[AgentSDK] modelName:", config.modelName);
  console.log("[AgentSDK] baseUrl:", config.baseUrl);
  console.log("[AgentSDK] cwd:", options?.cwd || process.cwd());
  console.log("[AgentSDK] permissionMode:", sdkOptions.permissionMode);
  console.log("[AgentSDK] maxTurns:", sdkOptions.maxTurns);
  console.log("[AgentSDK] settingSources:", sdkOptions.settingSources);
  console.log("[AgentSDK] skills:", sdkOptions.skills);
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
      error: `[SDK] 模型调用初始化失败: ${err instanceof Error ? err.message : String(err)}`,
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
            error: `[SDK] 模型调用失败: ${message.error}`,
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

        // ── Token usage 采集 ──
        const msgAny = message as Record<string, unknown>;
        const usage = msgAny.usage as {
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens: number;
          cache_read_input_tokens: number;
        } | undefined;
        const apiUsage = msgAny.apiUsage as {
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens: number;
          cache_read_input_tokens: number;
        } | undefined;
        const tokenUsage = usage || apiUsage;
        const totalCostUsd = msgAny.total_cost_usd as number | undefined;
        const durationMs = msgAny.duration_ms as number | undefined;
        const numTurns = msgAny.num_turns as number | undefined;

        if (tokenUsage) {
          const totalTokens = (tokenUsage.input_tokens || 0) + (tokenUsage.output_tokens || 0);
          console.log(
            "[AgentSDK] token usage: input=", tokenUsage.input_tokens,
            "output=", tokenUsage.output_tokens,
            "cache_creation=", tokenUsage.cache_creation_input_tokens,
            "cache_read=", tokenUsage.cache_read_input_tokens,
            "total=", totalTokens,
            "cost=", totalCostUsd,
            "raw_usage=", JSON.stringify(usage),
            "raw_apiUsage=", JSON.stringify(apiUsage)
          );
          // BYOK 模型不记录 token 用量（用户自付费）
          const isByokModel = "userId" in config;
          if (!isByokModel) {
            // 持久化到 token_usage_logs
            try {
              db.insert(tokenUsageLogs).values({
                userId: options?.userId || "unknown",
                modelId: modelIdForLog,
                chatId: options?.chatId,
                backend: "sdk",
                inputTokens: tokenUsage.input_tokens || 0,
                outputTokens: tokenUsage.output_tokens || 0,
                cacheCreationInputTokens: tokenUsage.cache_creation_input_tokens || 0,
                cacheReadInputTokens: tokenUsage.cache_read_input_tokens || 0,
                totalTokens,
                costUsd: Math.round((totalCostUsd || 0) * 10000),
                durationMs: durationMs || 0,
                numTurns: numTurns || 1,
                projectId: options?.projectId,
                workspaceId: options?.workspaceId,
                createdAt: new Date().toISOString(),
              }).run();
            } catch (err) {
              console.error("[TokenUsage] failed to log usage:", err);
            }
          }

          // 向前端发送 usage 事件
          yield {
            type: "usage" as const,
            inputTokens: tokenUsage.input_tokens || 0,
            outputTokens: tokenUsage.output_tokens || 0,
            cacheCreationInputTokens: tokenUsage.cache_creation_input_tokens || 0,
            cacheReadInputTokens: tokenUsage.cache_read_input_tokens || 0,
            totalTokens,
            costUsd: totalCostUsd,
            durationMs,
            numTurns,
          };
        }

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
      error: `[SDK] 模型调用过程中出错: ${err instanceof Error ? err.message : String(err)}`,
      code: "SDK_ERROR",
    };
  }
}

/**
 * 合并全局 + 项目级 MCP 配置，并替换 headers 中的 `${user-api-key}` 占位符。
 * 供 SDK 直调模式和 ACP 模式共用。
 */
export function resolveMcpServersForUser(
  userId: string | undefined,
  projectId: string | undefined,
): Record<string, McpServerConfig> {
  // 1. 读取全局 MCP
  const globalMcpServers = readMcpServers();

  // 2. 读取项目级 MCP
  let projectMcpServers: Record<string, McpServerConfig> | undefined;
  if (projectId) {
    try {
      const projectDirSegments = ["projects", projectId];
      const projectConfig = readProjectMcpConfigFromFs(projectDirSegments);
      if (projectConfig?.mcpServers && typeof projectConfig.mcpServers === "object") {
        projectMcpServers = projectConfig.mcpServers as Record<string, McpServerConfig>;
      }
    } catch {
      // 项目级 MCP 配置读取失败，忽略
    }
  }

  // 3. 合并
  const merged: Record<string, McpServerConfig> = {
    ...globalMcpServers,
    ...projectMcpServers,
  };

  // 4. 查询用户系统 Key（用于替换占位符）
  const userApiKey = userId ? getSystemKey(userId)?.keyField : undefined;

  // 5. 替换 headers 中的 ${user-api-key}
  const PLACEHOLDER = "${user-api-key}";
  for (const cfg of Object.values(merged)) {
    const headers = (cfg as Record<string, unknown>).headers;
    if (headers && typeof headers === "object" && userApiKey) {
      for (const [key, val] of Object.entries(headers as Record<string, string>)) {
        if (typeof val === "string" && val.includes(PLACEHOLDER)) {
          (headers as Record<string, string>)[key] = val.replace(PLACEHOLDER, userApiKey);
        }
      }
    }
  }

  return merged;
}

/**
 * 将 SDK 格式的 MCP 配置转换为 ACP newSession 所需的 mcpServers 数组格式。
 * ACP SDK headers 格式: Array<{name: string, value: string}>
 * Claude SDK headers 格式: Record<string, string>
 */
export function convertToAcpMcpServers(
  servers: Record<string, McpServerConfig>,
): Array<McpServer> {
  return Object.entries(servers).map(([name, cfg]) => {
    const entry = cfg as Record<string, unknown>;
    if (entry.type === "http" || entry.type === "sse") {
      // HTTP/SSE 类型：转换 headers 格式
      const sdkHeaders = entry.headers as Record<string, string> | undefined;
      const acpHeaders = sdkHeaders
        ? Object.entries(sdkHeaders).map(([hName, hValue]) => ({ name: hName, value: hValue }))
        : [];
      return {
        type: entry.type,
        name,
        url: entry.url,
        headers: acpHeaders,
      } as McpServer;
    } else if (entry.command) {
      // stdio 类型
      const env = entry.env as Record<string, string> | undefined;
      const acpEnv = env
        ? Object.entries(env).map(([eName, eValue]) => ({ name: eName, value: eValue }))
        : [];
      return {
        type: "stdio",
        name,
        command: entry.command as string,
        args: (entry.args as string[]) || [],
        env: acpEnv,
      } as McpServer;
    }
    // 其他类型直接返回
    return { ...entry, name } as McpServer;
  });
}
