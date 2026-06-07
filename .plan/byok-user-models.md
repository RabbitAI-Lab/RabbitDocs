# BYOK (Bring Your Own Key) 实施方案

## Context

当前 ChatWiki 的模型配置由管理员统一管理（`model_configs` 表），所有用户共享同一套模型。需要实现 BYOK 功能：**用户从系统预设的 Provider（GLM、MiniMax、Kimi、Alibaba Cloud、DeepSeek）中选择，填入自己的 API Key，服务端做透传代理**。当前只支持 Anthropic 协议。

**关键约束**：BYOK 不是真正意义上的"任意自定义模型"。用户只能从系统已支持的 5 个 Provider 中选择，baseUrl 使用 `PROVIDER_DEFAULTS` 中 Anthropic 协议对应的预设值，用户只需提供 **API Key** 和 **modelName**。

---

## 核心设计决策

### 1. 新建 `user_model_configs` 表
- `model_configs` 的 integer ID 被 `chats.modelId`、`token_usage_logs.modelId`、ACP pool 广泛引用，改动影响面太大
- 关注点分离：管理员模型 vs 用户模型，查询逻辑更简单
- 迁移风险低：纯 additive migration

### 2. BYOK modelId 使用 `"byok_N"` 字符串编码
- 前端 `selectedModelId` 类型从 `number` 扩展为 `number | string`
- `chats` 表新增 `userModelId` 列（integer）存储 BYOK 模型引用
- 与 `chats.modelId`（integer，管理员模型）互斥使用

### 3. API Key 使用 AES-256-GCM 加密存储
- 密钥来源：`process.env.BYOK_ENCRYPTION_KEY` 或首次运行自动生成到 `~/.rabbitdocs/.byok-key`
- 存储格式：`iv:authTag:ciphertext`（base64）
- GET API 返回 mask 后的值，密钥永不传输到前端

### 4. Provider 限定为系统预设列表
- 用户只能从 `PROVIDERS`（GLM、MiniMax、Kimi、Alibaba Cloud、DeepSeek）中选择
- `baseUrl` 自动从 `PROVIDER_DEFAULTS[provider]["anthropic"]` 填充，用户不可修改
- `protocol` 固定为 `"anthropic"`
- 用户只需填写：Provider（下拉选择）、Model Name、API Key、显示名称

---

## 变更清单

### Phase 1：数据库 + 加密工具

| 文件 | 操作 | 描述 |
|------|------|------|
| `drizzle/0040_add_user_model_configs.sql` | 新建 | 创建 `user_model_configs` 表 + `chats.user_model_id` 列 |
| `drizzle/meta/_journal.json` | 修改 | 注册新迁移 |
| `src/db/schema.ts` | 修改 | 新增 `userModelConfigs` 表定义，`chats` 表增加 `userModelId` 字段 |
| `src/lib/crypto.ts` | 新建 | `encryptApiKey()` / `decryptApiKey()` — AES-256-GCM 加解密 |

### Phase 2：后端服务层

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/lib/user-model-service.ts` | 新建 | `resolveUserModelConfig(id, userId)` — 从 DB 查询 + 解密 apiKey + 校验所有权；根据 provider 自动补全 baseUrl |
| `src/lib/model-service.ts` | 修改 | 提取 `streamWithConfig(config, messages, opts)` 内部函数；新增 `streamUserModelResponse()` 入口 |
| `src/lib/acp-model-service.ts` | 修改 | `streamAcpModelResponse` 支持接受 config 对象 |
| `src/lib/types.ts` | 修改 | `ChatCompletionRequest.modelId` 扩展为 `number | string` |

### Phase 3：API 端点

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/app/api/user-models/route.ts` | 新建 | GET（列表，key mask）/ POST（创建，校验 provider 在预设列表内，key 加密） |
| `src/app/api/user-models/[id]/route.ts` | 新建 | GET / PATCH / DELETE，所有操作验证 `userId` 所有权 |
| `src/app/api/chat/completions/route.ts` | 修改 | modelId 路由分发：`"byok_N"` → `streamUserModelResponse`，number → `streamModelResponse` |
| `src/app/api/chats/[chatId]/route.ts` | 修改 | PATCH 支持 `userModelId` 字段 |

### Phase 4：前端集成

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/components/chat/useChatSelectors.ts` | 修改 | 新增 `userModels` 状态，`selectedModelId` 扩展为 `number | string`，并行请求 `/api/user-models` |
| `src/components/chat/ChatInputFooter.tsx` | 修改 | 模型下拉菜单分两组：管理员模型 + 我的模型(BYOK) |
| `src/components/chat/ChatWorkspace.tsx` | 修改 | 适配 `selectedModelId` 的 string 类型 |
| `src/components/chat/useChatMessages.ts` | 修改 | modelId 类型适配 `number | string` |
| `src/components/chat/useChatNavigation.ts` | 修改 | 加载 chat 时处理 `userModelId` |

### Phase 5：用户管理 UI（独立页面 + 菜单入口）

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/app/(app)/my-models/page.tsx` | **新建** | 独立的"我的模型"页面，包含模型列表 + 添加/编辑/删除功能 |
| `src/components/user/UserModelConfigModal.tsx` | 新建 | BYOK 模型添加/编辑弹窗：Provider 下拉（仅预设列表）、Model Name、API Key、显示名称 |
| `src/components/layout/MyAccountMenu.tsx` | 修改 | 在 `menuItems` 中 profile 下方新增 `{ label: t('myModels'), href: "/my-models" }` 菜单项 |
| `messages/en.json` | 修改 | 新增 `sidebar.myModels` + `myModelsPage.*` i18n |
| `messages/zh.json` | 修改 | 新增 `sidebar.myModels`（"我的模型"）+ `myModelsPage.*` i18n |

---

## 关键实现细节

### 数据库 Schema
```sql
CREATE TABLE user_model_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,              -- 限定为 PROVIDERS 中的值
  name TEXT NOT NULL,                  -- 用户自定义显示名称
  base_url TEXT NOT NULL,              -- 从 PROVIDER_DEFAULTS 自动填充
  api_key_encrypted TEXT NOT NULL,     -- AES-256-GCM 加密
  model_name TEXT NOT NULL,            -- 用户填写
  extra_env_json TEXT NOT NULL DEFAULT '{}',
  backend TEXT NOT NULL DEFAULT 'sdk',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_user_model_configs_user_id ON user_model_configs(user_id);

ALTER TABLE chats ADD COLUMN user_model_id INTEGER REFERENCES user_model_configs(id) ON DELETE SET NULL;
```

### resolveUserModelConfig — 服务端 Provider 校验 + baseUrl 补全
```typescript
import { PROVIDERS, getProviderDefaults } from "@/lib/model-constants";

function resolveUserModelConfig(id: number, userId: string) {
  const row = db.select().from(userModelConfigs)
    .where(and(eq(userModelConfigs.id, id), eq(userModelConfigs.userId, userId)))
    .get();
  if (!row) throw new ModelError("BYOK 模型不存在", "MODEL_NOT_FOUND");

  // 校验 provider 在预设列表内
  if (!(PROVIDERS as readonly string[]).includes(row.provider)) {
    throw new ModelError(`不支持的 Provider: ${row.provider}`, "INVALID_CONFIG");
  }

  // baseUrl 以 DB 存储为准（POST 时已从 PROVIDER_DEFAULTS 填充）
  // 解密 apiKey
  const apiKey = decryptApiKey(row.apiKeyEncrypted);
  return { ...row, apiKey, protocol: "anthropic" as const };
}
```

### POST /api/user-models — Provider 校验 + baseUrl 自动填充
```typescript
const { provider, modelName, apiKey, name, backend } = body;

// 校验 provider
if (!(PROVIDERS as readonly string[]).includes(provider)) {
  return NextResponse.json({ error: "不支持的 Provider" }, { status: 400 });
}

// 从 PROVIDER_DEFAULTS 获取 anthropic 协议的 baseUrl
const defaults = getProviderDefaults(provider, "anthropic");
if (!defaults) {
  return NextResponse.json({ error: "该 Provider 不支持 Anthropic 协议" }, { status: 400 });
}

db.insert(userModelConfigs).values({
  userId: auth.id,
  provider,
  name: name || `${provider}-${modelName}`,
  baseUrl: defaults.baseUrl,           // 自动填充，用户不可修改
  apiKeyEncrypted: encryptApiKey(apiKey),
  modelName,
  backend: backend || "sdk",
  ...
}).run();
```

### UserModelConfigModal — 前端表单（简化版）
```
┌─────────────────────────────────────────────┐
│  添加我的模型                                 │
├─────────────────────────────────────────────┤
│  Provider: [GLM ▼]  (仅预设列表，不可自定义)   │
│  Model:    [glm-5.1          ]  (自动填默认)  │
│  API Key:  [•••••••••••••••  ]  (用户填写)     │
│  名称:     [GLM-我的模型      ]  (可选)        │
│                                             │
│  协议: Anthropic Compatible (固定，不可选)     │
│  Base URL: https://open.bigmodel.cn/... (只读)│
└─────────────────────────────────────────────┘
```
- Provider 切换时自动填充 modelName 和 baseUrl（只读展示）
- 用户只需填写 API Key

### MyAccountMenu 菜单入口
```typescript
// src/components/layout/MyAccountMenu.tsx
const menuItems = [
  { label: t('profile'), href: "/profile" },
  { label: t('myModels'), href: "/my-models" },  // ← 新增
  { label: t('billing'), href: "/billing" },
  { label: t('docs'), href: "/docs" },
  { label: t('account'), href: "/settings" },
];
```

### /my-models 页面结构
- 页面布局参考 `profile/page.tsx`（max-w-4xl + Card 组件）
- 顶部：标题"我的模型" + 副标题 + "添加模型"按钮
- 列表：模型卡片列表（Provider、Model Name、API Key mask、操作按钮）
- 空状态：Empty 组件 + 引导文案

### chat/completions 路由分发逻辑
```typescript
// route.ts 中
if (typeof modelId === 'string' && modelId.startsWith('byok_')) {
  const userModelId = parseInt(modelId.replace('byok_', ''));
  generator = streamUserModelResponse(userModelId, messages, { ...opts, userId: auth.id });
} else {
  generator = streamModelResponse(modelId, messages, opts);
}
```

### model-service.ts 重构方向
```
当前: streamModelResponse(modelId, messages, opts)
      ├─ resolveModelConfig(modelId)  // 从 model_configs 查
      └─ SDK 调用逻辑

重构后:
streamWithConfig(config, messages, opts)  // 提取的共享逻辑
streamModelResponse(modelId, messages, opts)       // 管理员模型入口（签名不变）
streamUserModelResponse(userModelId, messages, opts) // BYOK 入口（新增）
```

### 安全要点
- 所有 `/api/user-models` 端点强制 `requireAuth` + `WHERE user_id = auth.id`
- API Key 仅在 `resolveUserModelConfig` 内部解密，不出日志、不出 API 响应
- 用户删除 BYOK 模型后，`chats.user_model_id` 被 SET NULL，历史消息可查看但无法继续对话

---

## 验证方案

1. **创建 BYOK 模型**：POST `/api/user-models` → 确认 DB 中 `api_key_encrypted` 非明文
2. **列出模型**：GET `/api/user-models` → 确认返回的 apiKey 为 mask 格式（`sk-****xxxx`）
3. **聊天测试**：在前端模型选择器中选择 BYOK 模型，发送消息 → 确认 SSE 流正常返回
4. **权限隔离**：用户 A 的 BYOK 模型对用户 B 不可见、不可用
5. **管理员模型不变**：使用管理员模型聊天，流程完全不变
6. **Provider 校验**：POST 时传入非法 provider → 返回 400 错误
7. **ACP 模式**：BYOK 模型 backend=acp 时，确认 ACP pool 正确创建连接
