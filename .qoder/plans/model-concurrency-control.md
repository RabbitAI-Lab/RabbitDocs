# 模型并发控制方案

## Context

当前 ChatWiki 的 `/api/chat/completions` 端点对所有请求不加限制地直接调用模型 API。当多个用户/会话同时使用同一模型时，可能超出 API 速率限制或造成资源争抢。需要为每个模型配置并发上限，超限请求排队等待，前端实时展示排队位置。

**设计决策**：
- 并发维度：全局按模型（所有用户共享 N 个槽位）
- `maxConcurrency = 0` 表示不限制
- 支持取消排队请求

---

## 新建文件

### 1. `src/lib/model-concurrency.ts` — 模型并发信号量管理器

核心设计：使用 `globalThis` 注册表模式（与 `acp-pool.ts` 一致），确保 HMR 不丢失状态。

**数据结构**：
- `ModelSemaphore`：每个 modelId 对应 `{ activeCount, queue: WaitingRequest[] }`
- `WaitingRequest`：`{ resolve, reject, abortHandler, enqueueTime }`

**关键方法**：
- `acquire(modelId, maxConcurrency, { signal, onPositionUpdate })`：
  - `maxConcurrency === 0` → 立即返回
  - `activeCount < maxConcurrency` → activeCount++，立即返回
  - 否则入队等待，返回 Promise
  - AbortSignal 触发时从队列移除并 reject
- `release(modelId)`：
  - activeCount--
  - 队列非空 → 取出队首，activeCount++，调用 resolve
  - 通知所有等待者位置更新（通过 onPositionUpdate 回调）
- `getStats()` — 调试用

### 2. `drizzle/0040_add_max_concurrency_to_model_configs.sql`

```sql
ALTER TABLE model_configs ADD COLUMN max_concurrency INTEGER NOT NULL DEFAULT 0;
```

---

## 修改文件

### 3. `src/db/schema.ts` — 添加字段

`modelConfigs` 表添加 `maxConcurrency: integer("max_concurrency").notNull().default(0)`

### 4. `drizzle/meta/_journal.json` — 追加迁移记录

entries 末尾追加 idx=15 的 `0040_add_max_concurrency_to_model_configs`

### 5. `src/lib/types.ts` — 添加事件类型

`StreamEvent` 联合类型中添加：
```ts
| { type: "queue_position"; position: number; waitCount: number }
```

### 6. `src/lib/model-service.ts` — 扩展返回类型

`ModelConfigRow` 类型添加 `maxConcurrency: number`

### 7. `src/app/api/chat/completions/route.ts` — 并发控制核心

修改 `pull()` 函数：

```
pull(controller) {
  let acquired = false;
  try {
    // 1. 并发控制
    const config = resolveModelConfig(modelId);
    if ((config.maxConcurrency ?? 0) > 0) {
      await modelConcurrencyManager.acquire(modelId, config.maxConcurrency, {
        signal: req.signal,
        onPositionUpdate(position, waitCount) {
          controller.enqueue(encoder.encode(
            `event: queue_position\ndata: ${JSON.stringify({
              type: "queue_position", position, waitCount
            })}\n\n`
          ));
        },
      });
      acquired = true;
    }

    // 2. 现有流式响应逻辑（不变）
    const generator = streamModelResponse(modelId, messages, { ... });
    for await (const event of generator) { ... }
    controller.close();
  } catch (err) {
    if (err?.name === "AbortError") {
      controller.close(); // 客户端取消，静默关闭
    } else {
      // 现有错误处理
    }
    controller.close();
  } finally {
    if (acquired) modelConcurrencyManager.release(modelId);
  }
}
```

注意：`resolveModelConfig` 被调用两次（route 中 + streamModelResponse 内部），SQLite 同步查询开销极小，可接受。若要优化，可将 config 传入 `streamModelResponse`，但改动更大，暂不处理。

### 8. `src/app/api/models/route.ts` — POST 支持 maxConcurrency

解构 `maxConcurrency`，insert values 中添加 `maxConcurrency: maxConcurrency ?? 0`

### 9. `src/app/api/models/[id]/route.ts` — PATCH 支持 maxConcurrency

解构 `maxConcurrency`，添加 `if (maxConcurrency !== undefined) updateData.maxConcurrency = maxConcurrency`

### 10. `src/components/chat/chat-workspace-ref.ts` — Message 接口扩展

添加：
```ts
queuePosition?: number;   // 排队位置（undefined = 未排队）
queueWaitCount?: number;  // 前方等待数
```

### 11. `src/components/chat/useChatMessages.ts` — SSE 事件处理

`streamAiResponse` 的 `consumeSseStream` 回调中添加：
```ts
} else if (eventType === "queue_position" && data.type === "queue_position") {
  setMessages((prev) => updateMessageById(prev, tempAiMsgId, {
    queuePosition: data.position,
    queueWaitCount: data.waitCount,
  }));
}
```

`done` / `error` 事件处理中清空 `queuePosition` / `queueWaitCount`。

### 12. `src/components/chat/ChatBubbleItem.tsx` — 排队状态 UI

在 `mapMessagesToBubbleItems` 中，当 `msg.queuePosition` 存在时，AI 气泡显示排队提示而非 loading 动画：
- 显示 `ClockCircleOutlined` + "排队中：前方有 {count} 条请求"
- 使用 `isAiLoading` 判断逻辑中加入 `!msg.queuePosition` 条件（有排队时不显示普通 loading）

### 13. `src/components/admin/model-config-shared.ts` — 类型扩展

- `ModelConfig` 接口添加 `maxConcurrency?: number`
- `ModelConfigSubmitData` 接口添加 `maxConcurrency?: number`
- `CREATE_FORM_DEFAULTS` 添加 `maxConcurrency: 0`

### 14. `src/components/admin/ModelConfigModal.tsx` — 表单字段

Backend 选择器后添加 `InputNumber`（min=0, max=100, step=1），label 用 i18n key。

`handleOk` 中将 `maxConcurrency` 传入 onSubmit。

### 15. `src/components/admin/ModelsPageClient.tsx` — 编辑回填

`handleStartEdit` 的 `setEditInitialValues` 中添加 `maxConcurrency: model.maxConcurrency ?? 0`

### 16. `src/components/admin/ModelCard.tsx` — 卡片显示

添加并发数信息行：`maxConcurrency` > 0 显示数字，否则显示"不限"。

### 17. `messages/zh.json` + `messages/en.json` — i18n

`chat.queue` 下添加 `modelQueuePosition`。
`admin.modelConfigModal` 下添加 `labelMaxConcurrency` / `tooltipMaxConcurrency`。
`admin` 下添加 `modelCard.unlimited`。

---

## 边界情况

| 场景 | 处理方式 |
|------|---------|
| HMR | `globalThis` 注册表保留状态 |
| 服务器重启 | 内存状态重置，所有连接断开，客户端自动重试 |
| 多请求并发 | Node.js 单线程保证原子性 |
| 请求异常未 release | `try/finally` 保证 + AbortSignal 监听 |
| 动态修改 maxConcurrency | 每次 acquire 从 DB 读取最新值 |
| 客户端取消 | 前端 abort → 后端 signal 触发 → 从队列移除 |

---

## 验证方案

1. **设置并发限制**：Admin → 模型管理 → 编辑模型 → 设置最大并发数为 1
2. **触发排队**：打开 2 个浏览器标签页，同时向同一模型发送消息
3. **观察排队状态**：第二个标签页的 AI 气泡应显示"排队中：前方有 1 条请求"
4. **验证自动发送**：第一个请求完成后，第二个请求自动开始流式响应
5. **验证取消**：排队状态下点击取消按钮，请求从队列移除
6. **验证 0 值**：设置 maxConcurrency=0 后，多个请求不排队
7. **前端聊天队列不冲突**：同一窗口内连续发送多条消息，客户端队列行为不变
