/**
 * ACP 模式的流式模型响应
 *
 * 替代 model-service.ts 中的 SDK 直调逻辑，通过 ACP 连接池与 Agent 通信。
 */
import type { StreamEvent } from "./types";
import type { ContentBlock, PromptResponse } from "@agentclientprotocol/sdk";
import { getOrCreateEntry, getOrCreateSession, forceRecreateEntry, buildPoolKey, type AcpPoolConfig } from "./acp-pool";
import { resolveModelConfig, resolveMcpServersForUser, convertToAcpMcpServers } from "./model-service";
import { db } from "@/db";
import { tokenUsageLogs } from "@/db/schema";

type AcpModelConfig = {
  id: number;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  extraEnvJson: string;
  backend: string;
  provider: string;
  protocol: string;
};

/** 检测是否为连接断开错误 */
function isConnectionClosedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("ACP connection closed") || msg.includes("ENOENT");
}

export async function* streamAcpModelResponse(
  modelId: number,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    userId: string;
    projectId?: string;
    workspaceId?: string;
    chatId: number;
    cwd?: string;
  },
  preResolvedConfig?: AcpModelConfig,
  _retryAttempted = false
): AsyncGenerator<StreamEvent> {
  // 如果已从 model-service 传入预解析的 config，直接使用（避免重复查询 DB）
  const config = preResolvedConfig ?? resolveModelConfig(modelId);

  // 构建 pool key
  const key = buildPoolKey({
    projectId: options.projectId,
    workspaceId: options.workspaceId,
    userId: options.userId,
  });

  // 构建 pool 配置
  const poolConfig: AcpPoolConfig = {
    modelId,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    modelName: config.modelName,
    cwd: options.cwd || process.cwd(),
    extraEnvJson: config.extraEnvJson,
  };

  console.log("[ACP] streamAcpModelResponse 开始");
  console.log("[ACP]   modelId:", modelId);
  console.log("[ACP]   key:", key);
  console.log("[ACP]   poolConfig.cwd:", poolConfig.cwd);
  console.log("[ACP]   poolConfig.modelName:", poolConfig.modelName);
  console.log("[ACP]   poolConfig.baseUrl:", poolConfig.baseUrl);
  console.log("[ACP]   messages count:", messages.length);
  console.log("[ACP]   options.userId:", options.userId);
  console.log("[ACP]   options.chatId:", options.chatId);

  let accumulatedText = "";
  let accumulatedThinking = "";

  try {
    // 1. 获取或创建连接池 entry
    console.log("[ACP] 获取连接池 entry, key=", key);
    const entry = await getOrCreateEntry(key, poolConfig);
    console.log("[ACP] 连接池 entry 就绪, key=", key, "closed=", entry.closed);

    // 2. 解析全局/项目 MCP 配置并替换 user-api-key 占位符
    const resolvedMcpServers = resolveMcpServersForUser(options.userId, options.projectId);
    const acpMcpServers = convertToAcpMcpServers(resolvedMcpServers);
    console.log("[ACP] resolved MCP servers:", acpMcpServers.map((s) => (s as { name?: string }).name).join(", "));

    // 3. 获取或创建 session（按 chatId 复用）
    const chatIdStr = String(options.chatId);
    const isNewSession = !entry.sessions.has(chatIdStr);
    console.log("[ACP] 获取 session, chatId=", chatIdStr, "isNewSession=", isNewSession);
    const sessionId = await getOrCreateSession(entry, chatIdStr, poolConfig.cwd, acpMcpServers);
    console.log("[ACP] sessionId=", sessionId);

    // 4. 准备 prompt 消息
    const isContinuation = !isNewSession;
    const promptMessages = buildPromptMessages(messages, isContinuation);
    console.log("[ACP] prompt 消息准备完毕, isContinuation=", isContinuation, "promptBlocks=", promptMessages.length);
    if (promptMessages[0] && promptMessages[0].type === "text") {
      console.log("[ACP] prompt text length=", promptMessages[0].text.length, "preview=", promptMessages[0].text.slice(0, 200));
    }

    // 4. 重置 client 事件队列
    entry.clientRef.resetForNewPrompt();

    // 5. 发起 prompt
    console.log("[ACP] 发起 prompt, sessionId=", sessionId);
    let promptResponse: PromptResponse | null = null;
    const promptPromise = entry.connection
      .prompt({
        sessionId,
        prompt: promptMessages,
      })
      .then((response) => {
        // prompt 完成 → 标记 done
        entry.clientRef.markPromptDone();
        promptResponse = response;
        console.log("[ACP] PromptResponse: stopReason=", response.stopReason,
          "usage=", JSON.stringify(response.usage));
        return response;
      })
      .catch((err) => {
        // prompt 错误 → 将错误推入队列
        entry.clientRef.markPromptDone();
        console.error("[ACP] prompt error:", err instanceof Error ? err.message : String(err));
        throw err;
      });

    // 6. 同时消费事件队列和等待 prompt 完成
    let _promptDone = false;
    let promptError: Error | null = null;

    // 后台等待 prompt 完成
    void promptPromise.catch((err: unknown) => {
      promptError = err instanceof Error ? err : new Error(String(err));
    }).finally(() => {
      _promptDone = true;
    });

    // 消费事件流
    console.log("[ACP] 开始消费事件流...");
    let eventCount = 0;
    for await (const event of entry.clientRef.drainEvents()) {
      eventCount++;
      if (event.type === "text_delta") {
        accumulatedText += event.text;
        yield event;
      } else if (event.type === "thinking_start") {
        yield event;
      } else if (event.type === "thinking_delta") {
        accumulatedThinking += event.text;
        yield event;
      } else if (event.type === "tool_call") {
        console.log("[ACP] tool_call event:", event.toolName);
        yield event;
      } else {
        console.log("[ACP] unhandled event type:", event.type);
      }
    }
    console.log("[ACP] 事件流结束, total events=", eventCount);

    // 7. 检查 prompt 是否有错误
    if (promptError) {
      yield {
        type: "error",
        error: `[ACP] 模型调用失败: ${(promptError as Error).message}`,
        code: "SDK_ERROR",
      };
      return;
    }

    // 8. 发送 done 事件
    console.log(
      "[ACP] response complete: key=", key, "textLength=",
      accumulatedText.length,
      "thinkingLength=",
      accumulatedThinking.length
    );

    // ── Token usage 采集（ACP 模式） ──
    // 优先使用 PromptResponse.usage（含 inputTokens/outputTokens/cachedReadTokens 等细分）
    // 回退到 UsageUpdate（仅含 context used/size/cost）
    const promptUsage = (promptResponse as PromptResponse | null)?.usage;
    const finalUsage = entry.clientRef.getLastUsageUpdate();
    if (promptUsage || finalUsage) {
      const prevUsed = entry.clientRef.getPrevUsageUsed();
      const incrementalUsed = finalUsage ? Math.max(0, finalUsage.used - prevUsed) : 0;

      const inputTokens = promptUsage?.inputTokens ?? 0;
      const outputTokens = promptUsage?.outputTokens ?? 0;
      const cacheCreationInputTokens = promptUsage?.cachedWriteTokens ?? 0;
      const cacheReadInputTokens = promptUsage?.cachedReadTokens ?? 0;
      const totalTokens = promptUsage?.totalTokens ?? incrementalUsed;
      const costUsd = finalUsage?.cost
        ? Math.round(finalUsage.cost.amount * 10000)
        : 0;

      console.log(
        "[ACP] token usage: input=", inputTokens,
        "output=", outputTokens,
        "cache_creation=", cacheCreationInputTokens,
        "cache_read=", cacheReadInputTokens,
        "total=", totalTokens,
        "costUsd=", costUsd,
        "source=", promptUsage ? "PromptResponse" : "UsageUpdate"
      );

      // BYOK 模型不记录 token 用量（用户自付费）
      const isByokModel = !!preResolvedConfig;
      if (!isByokModel) {
        try {
          db.insert(tokenUsageLogs).values({
            userId: options.userId,
            modelId,
            chatId: options.chatId,
            backend: "acp",
            inputTokens,
            outputTokens,
            cacheCreationInputTokens,
            cacheReadInputTokens,
            totalTokens,
            costUsd,
            contextSize: finalUsage?.size,
            contextUsed: finalUsage?.used,
            projectId: options.projectId,
            workspaceId: options.workspaceId,
            createdAt: new Date().toISOString(),
          }).run();
        } catch (err) {
          console.error("[ACP TokenUsage] failed to log:", err);
        }
      }

      // 向前端发送 usage 事件
      yield {
        type: "usage" as const,
        inputTokens,
        outputTokens,
        cacheCreationInputTokens,
        cacheReadInputTokens,
        totalTokens,
        costUsd: finalUsage?.cost?.amount,
        contextSize: finalUsage?.size,
        contextUsed: finalUsage?.used,
      };
    }

    yield {
      type: "done",
      fullText: accumulatedText,
      thinking: accumulatedThinking || undefined,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[ACP] stream error:", errMsg);

    // 连接断开时自动重连（仅限尚未输出内容时）
    if (isConnectionClosedError(err) && !_retryAttempted && !accumulatedText) {
      console.log("[ACP] 连接断开，尝试自动重连...");
      try {
        const newEntry = await forceRecreateEntry(key, poolConfig);
        console.log("[ACP] 重连成功, pid=", newEntry.child.pid);
        yield* streamAcpModelResponse(modelId, messages, options, config, true);
        return;
      } catch (reconnectErr) {
        console.error("[ACP] 重连失败:", reconnectErr instanceof Error ? reconnectErr.message : String(reconnectErr));
      }
    }

    yield {
      type: "error",
      error: `[ACP] 调用出错: ${errMsg}`,
      code: "SDK_ERROR",
    };
  }
}

/**
 * 构建 ACP prompt 消息列表。
 *
 * 复用 session 时（isContinuation=true）只发最新一条用户消息。
 * 新 session 时发送完整消息列表。
 */
function buildPromptMessages(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  isContinuation: boolean
): ContentBlock[] {
  // ACP prompt 需要 user role 的消息
  // 将 system/assistant 消息包装为 user 消息中的上下文

  if (isContinuation) {
    // 复用 session：仅发送最新一条用户消息
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      return [{ type: "text" as const, text: lastUserMsg.content }];
    }
  }

  // 新 session：发送完整消息列表作为上下文
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      parts.push(`[System Instructions]: ${msg.content}`);
    } else if (msg.role === "user") {
      parts.push(`[用户]: ${msg.content}`);
    } else if (msg.role === "assistant") {
      parts.push(`[助手]: ${msg.content}`);
    }
  }

  return [{ type: "text" as const, text: parts.join("\n\n") }];
}
