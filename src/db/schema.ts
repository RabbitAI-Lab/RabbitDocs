import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// accounts: 账号信息
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["personal", "enterprise"] }).notNull().default("personal"),
  createdAt: text("created_at").notNull(),
});

// enterprises: 企业信息
export const enterprises = sqliteTable("enterprises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

// organisations: 组织架构
export const organisations = sqliteTable("organisations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  enterpriseId: integer("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  createdAt: text("created_at").notNull(),
});

// templates: 文档模板
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull().default(""),
  icon: text("icon"),
  agentPrompt: text("agent_prompt").default(""),
  isSystem: integer("is_system").notNull().default(0),  // 0=用户创建, 1=系统模板
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// chats: 聊天会话
export const chats = sqliteTable("chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default("New Chat"),
  modelId: integer("model_id"),
  templateId: integer("template_id"),
  projectId: text("project_id"),
  workspaceId: text("workspace_id"),  // nullable，记录从哪个 workspace 发起
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// chat_messages: 聊天消息
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  // Extended Thinking 思考过程原文（Anthropic 返回的 thinking 字段）
  thinking: text("thinking"),
  // Extended Thinking 签名（用于多轮对话继续启用 thinking 时回传给模型）
  thinkingSignature: text("thinking_signature"),
  // 标记该消息是否为错误消息（如 529 模型过载等），错误消息不参与后续模型调用
  isError: integer("is_error").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// model_configs: 模型配置
export const modelConfigs = sqliteTable("model_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  protocol: text("protocol", { enum: ["openai", "anthropic"] }).notNull().default("openai"),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  modelName: text("model_name").notNull(),
  // 用户可配置的环境变量 JSON 字符串
  // 包含两个预定义开关（CLAUDE_CODE_DISABLE_ADAPTIVE / CLAUDE_CODE_DEFAULT_THINKING）
  // 以及任意用户自定义 key/value
  extraEnvJson: text("extra_env_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isDefault: integer("is_default").notNull().default(0),
});

// mcp_config: MCP 服务器配置（单行配置表）
export const mcpConfig = sqliteTable("mcp_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  configJson: text("config_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// sandbox_config: 沙盒配置（单行配置表）
export const sandboxConfig = sqliteTable("sandbox_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sandboxUrl: text("sandbox_url").notNull().default("openapi.sandbox.rabbitai-lab.com"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// storage_config: 文件存储配置（单行配置表）
export const storageConfig = sqliteTable("storage_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storagePath: text("storage_path").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// shared_chats: 会话分享
export const sharedChats = sqliteTable("shared_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

// shared_html_files: HTML 文件分享（独立于 chat 分享）
// 一个项目下同一路径同一时刻最多一条活跃分享记录
export const sharedHtmlFiles = sqliteTable("shared_html_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  htmlPath: text("html_path").notNull(), // 相对项目根目录的路径，如 "docs/index.html"
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// operation_logs: 操作日志
export const operationLogs = sqliteTable("operation_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  category: text("category", { enum: ["repository", "sandbox", "skills", "mcp", "member"] }).notNull(),
  action: text("action", { enum: ["create", "update", "delete", "enable", "disable"] }).notNull(),
  detail: text("detail").notNull(),
  operator: text("operator").notNull().default("system"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});

// document_activities: 文档活动日志
export const documentActivities = sqliteTable("document_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  documentPath: text("document_path").notNull(),
  documentTitle: text("document_title").notNull(),
  action: text("action", { enum: ["create", "update", "delete", "rename"] }).notNull(),
  oldTitle: text("old_title"),
  createdAt: text("created_at").notNull(),
});

// system_prompts: 系统提示词配置
export const systemPrompts = sqliteTable("system_prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  enabled: integer("enabled").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  isSystem: integer("is_system").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// todos: 待办事项
export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  completed: integer("completed").notNull().default(0),  // 0=待办, 1=已完成
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── 认证相关表 ──

// users: 用户账号
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  emailVerified: integer("email_verified").notNull().default(0),
  accountType: text("account_type").notNull().default("personal"),
  enterpriseId: text("enterprise_id"),
  positions: text("positions"),  // JSON string
  satokenLoginId: text("satoken_login_id").unique(),
  disabled: integer("disabled").notNull().default(0),  // 0=启用, 1=禁用（软删除）
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// system_settings: 系统设置（key-value）
export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// invite_codes: 邀请码
export const inviteCodes = sqliteTable("invite_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdById: text("created_by_id").references(() => users.id),
  usedById: text("used_by_id").unique().references(() => users.id),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

// email_verifications: 邮箱验证令牌
export const emailVerifications = sqliteTable("email_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  code: text("code").unique(), // 6 位数字验证码（可选，仅在邮件中发送时存在）
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// passkeys: WebAuthn 凭证
export const passkeys = sqliteTable("passkeys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  signCount: integer("sign_count").notNull().default(0),
  transports: text("transports"),  // JSON string
  deviceName: text("device_name"),
  aaguid: text("aaguid"),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
});

// cli_authorization_codes: CLI OAuth 授权码
export const cliAuthorizationCodes = sqliteTable("cli_authorization_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// cli_tokens: CLI 长期令牌
export const cliTokens = sqliteTable("cli_tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("CLI Token"),
  token: text("token").notNull().unique(),
  prefix: text("prefix").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
});

// api_keys: API 密钥
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name"),
  keyField: text("key_field").notNull().unique(),
  prefix: text("prefix").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isSystem: integer("is_system").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// plans: 套餐计划
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  defaultCurrency: text("default_currency").notNull().default("CNY"), // 默认货币
  prices: text("prices").notNull().default("[]"),                   // JSON: [{currency, monthlyPrice, yearlyPrice}]
  discountType: text("discount_type", { enum: ["none", "percentage", "fixed"] }).notNull().default("none"),
  discountValue: integer("discount_value").notNull().default(0),    // percentage: 85=8.5折; fixed: 分
  features: text("features").notNull().default("[]"),              // JSON: [{name, included}]
  enabled: integer("enabled").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// user_subscriptions: 用户订阅
export const userSubscriptions = sqliteTable("user_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  planId: integer("plan_id").notNull().references(() => plans.id),
  billingCycle: text("billing_cycle", { enum: ["monthly", "yearly"] }).notNull().default("monthly"),
  status: text("status", { enum: ["active", "cancelled", "expired"] }).notNull().default("active"),
  startedAt: text("started_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
