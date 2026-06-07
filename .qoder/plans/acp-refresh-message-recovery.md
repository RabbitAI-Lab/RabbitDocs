# ACP 刷新页面后消息恢复方案

## Context

当 ACP 消息正在流式回复中，用户刷新页面重新进入会话，消息不显示。只有等 ACP 处理完毕后再次刷新才能看到。原因是 AI 回复只在客户端 SSE 流结束后才保存到 DB，刷新导致流中断，回复内容丢失且永远不会入库。

## 根因

1. **AI 回复仅在客户端保存**：`useChatMessages.ts` 在 SSE 流正常结束后才调用 `POST /api/chats/${chatId}/messages` 保存 AI 消息
2. **Generator 取消后文本丢失**：`acp-model-service.ts` 中 `accumulatedText` 是 generator 局部变量，SSE 断开后 generator 被取消，变量丢失
3. **ACP 后台继续运行但无人消费**：`sessionUpdate()` 继续向 `eventQueue` 推事件，`promptPromise` 最终 resolve，但 `PromptResponse` 不含文本内容
4. **页面加载只读 DB**：所有页面路径从 `chatMessages` 表查询消息，没有机制检测进行中的 ACP 响应

## 方案：服务端自动持久化 + 客户端检测恢复

### Task 1: 在 ACP Client 中独立累积文本

**文件**: `src/lib/acp-client.ts`

在 `ChatWikiAcpClient` 中添加独立于 generator 的文本累积：
- 新增 `_accumulatedText: string`、`_accumulatedThinking: string` 属性
- 在 `sessionUpdate()` 中映射事件后，遍历 mapped 事件提取 `text_delta` 和 `thinking_delta` 文本累加
- 在 `resetForNewPrompt()` 中重置这些属性
- 新增 `_generation: number` 计数器（每次 reset 递增），防止过期 prompt 的后台保存
- 新增 getter：`getAccumulatedText()`、`getAccumulatedThinking()`、`getGeneration()`

### Task 2: 服务端后台持久化 ACP 回复

**文件**: `src/lib/acp-model-service.ts`

在 `promptPromise` resolve 后启动后台保存任务（不依赖 generator 生命周期）：

```
1. 新增模块级 inProgressChatIds: Set<number> 和导出函数 isAcpPromptInProgress(chatId)
2. 在 streamAcpModelResponse 开头 inProgressChatIds.add(options.chatId)
3. 在 resetForNewPrompt 之后记录当前 generation
4. 注册后台保存：promptPromise.then() 中读取 clientRef 的累积文本，保存到 DB
5. 保存前检查 generation 是否匹配（防止新一轮 prompt 覆盖）
6. 保存后 inProgressChatIds.delete(options.chatId)
7. 在 generator 的 catch/finally 中也做 delete 清理
```

保存逻辑（直接操作 DB）：
```typescript
db.insert(chatMessages).values({
  chatId: options.chatId,
  role: "assistant",
  content: text,
  thinking: thinking || null,
  createdAt: new Date().toISOString(),
}).run();
db.update(chats).set({ updatedAt: new Date().toISOString() })
  .where(eq(chats.id, options.chatId)).run();
```

### Task 3: 消息插入幂等（去重）

**文件**: `src/app/api/chats/[chatId]/messages/route.ts`

在 `POST` handler 中，当 `role === "assistant"` 时，插入前检查是否已存在相同消息：
- 查询该 chat 最后一条消息
- 如果是 assistant 且 content 完全相同，直接返回已有记录

### Task 4: 新增 ACP 状态查询 API

**新建文件**: `src/app/api/chats/[chatId]/acp-status/route.ts`

```typescript
import { isAcpPromptInProgress } from "@/lib/acp-model-service";
// GET → { inProgress: boolean }
```

### Task 5: 客户端检测与恢复

**文件**: `src/components/chat/useChatMessages.ts`

在组件中新增 ACP 恢复逻辑：

1. 当 `effectiveChatId` 存在且 `loading === false`（非当前会话的流式响应）时，检查最后一条消息
2. 如果最后一条消息是 `user`（无 assistant 回复），调用 `/api/chats/${chatId}/acp-status`
3. 如果 `inProgress === true`：
   - 设置 `acpRecovering = true`，`loading = true`
   - 添加临时 AI 占位消息（空内容 + loading 状态）
   - 每 2 秒轮询 `acp-status`
   - 当 `inProgress === false` 时，重新加载消息并结束恢复
4. 如果 `inProgress === false`：不做处理（消息已丢失或尚未开始）
5. 添加 60 秒超时，超时后移除占位消息并显示错误提示

### Task 6: 清理 ProjectWorkspace / WorkspaceDetail 中的恢复支持

**无需修改** ProjectEditorArea 和 WorkspaceEditorArea。因为 Task 5 的检测逻辑完全在 `useChatMessages` 内部完成，通过 API 端点检测 ACP 状态，不需要通过 props 传递 `acpInProgress`。

## 变更文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/acp-client.ts` | 修改 | 添加文本累积属性和 getter |
| `src/lib/acp-model-service.ts` | 修改 | 添加 inProgressChatIds + 后台保存任务 |
| `src/app/api/chats/[chatId]/messages/route.ts` | 修改 | assistant 消息幂等插入 |
| `src/app/api/chats/[chatId]/acp-status/route.ts` | 新建 | ACP 状态查询端点 |
| `src/components/chat/useChatMessages.ts` | 修改 | ACP 恢复检测和轮询 |

## 验证方法

1. 启动开发服务器，创建一个使用 ACP 后端的模型
2. 发送一条会触发长时间 ACP 处理的消息（如让 agent 执行多步操作）
3. 在 ACP 流式回复过程中刷新页面
4. 验证：页面显示 loading 状态，ACP 完成后自动显示 AI 回复
5. 验证：AI 回复在 DB 中只有一条记录（无重复）
6. 验证：正常流程（不刷新）下 AI 回复仍然正常显示和保存
