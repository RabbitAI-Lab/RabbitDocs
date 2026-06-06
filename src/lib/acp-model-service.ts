/**
 * ACP 模式的流式模型响应
 *
 * 替代 model-service.ts 中的 SDK 直调逻辑，通过 ACP 连接池与 Agent 通信。
 */
import type { StreamEvent } from "./types";
import type { ContentBlock } from "@agentclientprotocol/sdk";
import { getOrCreateEntry, getOrCreateSession, buildPoolKey, type AcpPoolConfig } from "./acp-pool";
import { resolveModelConfig } from "./model-service";

export async function* streamAcpModelResponse(
  modelId: number,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    userId: string;
    projectId?: string;
    workspaceId?: string;
    chatId: number;
    cwd?: string;
  }
): AsyncGenerator<StreamEvent> {
  const config = resolveModelConfig(modelId);

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

  let accumulatedText = "";
  let accumulatedThinking = "";

  try {
    // 1. 获取或创建连接池 entry
    const entry = await getOrCreateEntry(key, poolConfig);

    // 2. 获取或创建 session（按 chatId 复用）
    const chatIdStr = String(options.chatId);
    const sessionId = await getOrCreateSession(entry, chatIdStr, poolConfig.cwd);

    // 3. 准备 prompt 消息
    // ACP 模式下仅发送最新一条用户消息（Agent 自身维护上下文）
    // 但如果是新 session（第一轮），需要发送完整消息
    const promptMessages = buildPromptMessages(messages, entry.sessions.has(chatIdStr));

    // 4. 重置 client 事件队列
    entry.clientRef.resetForNewPrompt();

    // 5. 发起 prompt（异步，事件通过 sessionUpdate 回调推入队列）
    const promptPromise = entry.connection
      .prompt({
        sessionId,
        prompt: promptMessages,
      })
      .then((response) => {
        // prompt 完成 → 标记 done
        entry.clientRef.markPromptDone();
        return response;
      })
      .catch((err) => {
        // prompt 错误 → 将错误推入队列
        entry.clientRef.markPromptDone();
        console.error("[ACP] prompt error:", err instanceof Error ? err.message : String(err));
        throw err;
      });

    // 6. 同时消费事件队列和等待 prompt 完成
    let promptDone = false;
    let promptError: Error | null = null;

    // 后台等待 prompt 完成
    void promptPromise.catch((err: unknown) => {
      promptError = err instanceof Error ? err : new Error(String(err));
    }).finally(() => {
      promptDone = true;
    });

    // 消费事件流
    for await (const event of entry.clientRef.drainEvents()) {
      if (event.type === "text_delta") {
        accumulatedText += event.text;
        yield event;
      } else if (event.type === "thinking_start") {
        yield event;
      } else if (event.type === "thinking_delta") {
        accumulatedThinking += event.text;
        yield event;
      } else if (event.type === "tool_call") {
        yield event;
      }
    }

    // 7. 检查 prompt 是否有错误
    if (promptError) {
      yield {
        type: "error",
        error: `ACP 模型调用失败: ${(promptError as Error).message}`,
        code: "SDK_ERROR",
      };
      return;
    }

    // 8. 发送 done 事件
    console.log(
      "[ACP] response complete: key=${key} textLength=",
      accumulatedText.length,
      "thinkingLength=",
      accumulatedThinking.length
    );

    yield {
      type: "done",
      fullText: accumulatedText,
      thinking: accumulatedThinking || undefined,
    };
  } catch (err) {
    console.error("[ACP] stream error:", err instanceof Error ? err.message : String(err));
    yield {
      type: "error",
      error: `ACP 调用出错: ${err instanceof Error ? err.message : String(err)}`,
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
