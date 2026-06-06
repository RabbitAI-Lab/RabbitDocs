/**
 * ChatWiki ACP Client 实现
 *
 * 实现 ACP Client 接口：
 * - requestPermission: 自动批准第一个选项
 * - sessionUpdate: 将更新推入事件队列，供 AsyncGenerator 消费
 */
import type { Client, SessionNotification, RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";
import type { StreamEvent } from "./types";
import { mapAcpUpdateToStreamEvents } from "./acp-event-mapper";

export class ChatWikiAcpClient implements Client {
  /**
   * 事件队列：ACP sessionUpdate 映射后的 StreamEvent 缓存在这里。
   * drainEvents() 作为 AsyncGenerator 从此队列消费。
   */
  private eventQueue: StreamEvent[] = [];

  /**
   * resolveWait: 当队列中有新事件时 resolve 当前等待的 Promise。
   * drainEvents() 通过 await 此 Promise 来等待新事件到达。
   */
  private resolveWait: (() => void) | null = null;

  /**
   * 标记 prompt turn 是否结束。
   * 当 prompt() 返回后，drainEvents() 应该停止等待。
   */
  private promptDone = false;

  /**
   * 跟踪是否已经发送过 thinking_start。
   * ACP 没有 thinking_start 事件，我们在第一次 agent_thought_chunk 时补充。
   */
  private thinkingStarted = false;

  // --- Client interface 实现 ---

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    console.log("[ACP] requestPermission:", params.toolCall?.title ?? "(no title)");
    // 自动批准第一个选项
    if (params.options && params.options.length > 0) {
      return {
        outcome: {
          outcome: "selected",
          optionId: params.options[0].optionId,
        },
      } as RequestPermissionResponse;
    }
    // 没有选项时返回允许
    return {
      outcome: {
        outcome: "selected",
      },
    } as RequestPermissionResponse;
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    const update = params.update;
    const mapped = mapAcpUpdateToStreamEvents(update);

    // 特殊处理：首次 agent_thought_chunk 时补充 thinking_start
    if (update.sessionUpdate === "agent_thought_chunk" && !this.thinkingStarted) {
      this.thinkingStarted = true;
      this.eventQueue.push({ type: "thinking_start" });
    }

    if (mapped.length > 0) {
      this.eventQueue.push(...mapped);
      // 唤醒等待中的消费者
      this.resolveWait?.();
    }
  }

  // --- 事件消费 ---

  /**
   * 标记 prompt turn 结束，drainEvents 将在队列清空后停止。
   */
  markPromptDone(): void {
    this.promptDone = true;
    this.resolveWait?.();
  }

  /**
   * 重置状态（新一轮 prompt 前调用）。
   */
  resetForNewPrompt(): void {
    this.eventQueue = [];
    this.resolveWait = null;
    this.promptDone = false;
    this.thinkingStarted = false;
  }

  /**
   * AsyncGenerator：从事件队列消费 StreamEvent。
   * 在 promptDone=true 且队列清空后结束。
   */
  async *drainEvents(): AsyncGenerator<StreamEvent> {
    while (true) {
      // 1. 先消费队列中的所有事件
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        yield event;
      }

      // 2. 队列空 + prompt 完成 → 结束
      if (this.promptDone) {
        return;
      }

      // 3. 等待新事件到达或 prompt 完成
      await new Promise<void>((resolve) => {
        this.resolveWait = resolve;
      });
    }
  }
}
