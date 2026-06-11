import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";

// accounts: 账号信息
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["personal", "enterprise"] }).notNull().default("personal"),
  createdAt: text("created_at").notNull(),
});

// enterprises: 企业信息
export const enterprises = pgTable("enterprises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

// organisations: 组织架构
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  enterpriseId: integer("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  createdAt: text("created_at").notNull(),
});

// templates: 文档模板
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull().default(""),
  icon: text("icon"),
  agentPrompt: text("agent_prompt").default(""),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// chats: 聊天会话
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull().default("New Chat"),
  modelId: integer("model_id"),
  templateId: integer("template_id"),
  projectId: text("project_id"),
  workspaceId: text("workspace_id"),
  userModelId: integer("user_model_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

// chat_messages: 聊天消息
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  thinking: text("thinking"),
  thinkingSignature: text("thinking_signature"),
  isError: boolean("is_error").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// model_configs: 模型配置
export const modelConfigs = pgTable("model_configs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  protocol: text("protocol", { enum: ["openai", "anthropic"] }).notNull().default("openai"),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  modelName: text("model_name").notNull(),
  extraEnvJson: text("extra_env_json").notNull().default("{}"),
  backend: text("backend").notNull().default("sdk"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
});

// mcp_config: MCP 服务器配置（单行配置表）
export const mcpConfig = pgTable("mcp_config", {
  id: serial("id").primaryKey(),
  configJson: text("config_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// sandbox_config: 沙盒配置（单行配置表）
export const sandboxConfig = pgTable("sandbox_config", {
  id: serial("id").primaryKey(),
  sandboxUrl: text("sandbox_url").notNull().default("openapi.sandbox.rabbitai-lab.com"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// storage_config: 文件存储配置（单行配置表）
export const storageConfig = pgTable("storage_config", {
  id: serial("id").primaryKey(),
  storagePath: text("storage_path").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// shared_chats: 会话分享
export const sharedChats = pgTable("shared_chats", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

// shared_html_files: HTML 文件分享
export const sharedHtmlFiles = pgTable("shared_html_files", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),
  htmlPath: text("html_path").notNull(),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// operation_logs: 操作日志
export const operationLogs = pgTable("operation_logs", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),
  category: text("category", { enum: ["repository", "sandbox", "skills", "mcp", "member"] }).notNull(),
  action: text("action", { enum: ["create", "update", "delete", "enable", "disable"] }).notNull(),
  detail: text("detail").notNull(),
  operator: text("operator").notNull().default("system"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});

// document_activities: 文档活动日志
export const documentActivities = pgTable("document_activities", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),
  documentPath: text("document_path").notNull(),
  documentTitle: text("document_title").notNull(),
  action: text("action", { enum: ["create", "update", "delete", "rename"] }).notNull(),
  oldTitle: text("old_title"),
  userId: text("user_id"),
  createdAt: text("created_at").notNull(),
});

// system_prompts: 系统提示词配置
export const systemPrompts = pgTable("system_prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// todos: 待办事项
export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  completed: boolean("completed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── 认证相关表 ──

// users: 用户账号
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  emailVerified: boolean("email_verified").notNull().default(false),
  accountType: text("account_type").notNull().default("personal"),
  enterpriseId: text("enterprise_id"),
  positions: text("positions"),
  satokenLoginId: text("satoken_login_id").unique(),
  disabled: boolean("disabled").notNull().default(false),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  providerCustomerIds: text("provider_customer_ids").default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// system_settings: 系统设置（key-value）
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// invite_codes: 邀请码
export const inviteCodes = pgTable("invite_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdById: text("created_by_id").references(() => users.id),
  usedById: text("used_by_id").unique().references(() => users.id),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

// email_verifications: 邮箱验证令牌
export const emailVerifications = pgTable("email_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  code: text("code").unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// passkeys: WebAuthn 凭证
export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  signCount: integer("sign_count").notNull().default(0),
  transports: text("transports"),
  deviceName: text("device_name"),
  aaguid: text("aaguid"),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
});

// cli_authorization_codes: CLI OAuth 授权码
export const cliAuthorizationCodes = pgTable("cli_authorization_codes", {
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
export const cliTokens = pgTable("cli_tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("CLI Token"),
  token: text("token").notNull().unique(),
  prefix: text("prefix").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
});

// api_keys: API 密钥
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name"),
  keyField: text("key_field").notNull().unique(),
  prefix: text("prefix").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// plans: 套餐计划
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  defaultCurrency: text("default_currency").notNull().default("CNY"),
  prices: text("prices").notNull().default("[]"),
  discountType: text("discount_type", { enum: ["none", "percentage", "fixed"] }).notNull().default("none"),
  discountValue: integer("discount_value").notNull().default(0),
  features: text("features").notNull().default("[]"),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  providerPrices: text("provider_prices").notNull().default("{}"),
  billingMode: text("billing_mode", { enum: ["subscription", "one_time"] }).notNull().default("subscription"),
  tokenLimitMonthly: integer("token_limit_monthly").notNull().default(0),
  tokenLimitYearly: integer("token_limit_yearly").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// user_subscriptions: 用户订阅
export const userSubscriptions = pgTable("user_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  planId: integer("plan_id").notNull().references(() => plans.id),
  billingCycle: text("billing_cycle", { enum: ["monthly", "yearly"] }).notNull().default("monthly"),
  status: text("status", { enum: ["active", "cancelled", "expired"] }).notNull().default("active"),
  startedAt: text("started_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  cancelledAt: text("cancelled_at"),
  provider: text("provider"),
  providerSubscriptionId: text("provider_subscription_id"),
  providerCustomerId: text("provider_customer_id"),
  providerSessionId: text("provider_session_id"),
  paymentMode: text("payment_mode", { enum: ["subscription", "one_time"] }).notNull().default("subscription"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// entity_members: 项目/工作空间成员索引表
export const entityMembers = pgTable("entity_members", {
  id: serial("id").primaryKey(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  memberId: text("member_id").notNull(),
  userId: text("user_id"),
  accountName: text("account_name").notNull(),
  ownerId: text("owner_id").notNull(),
  addedAt: text("added_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// entities: 项目/工作空间实体主表
export const entities = pgTable("entities", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["project", "workspace"] }).notNull(),
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  accountId: text("account_id").notNull(),
  accountType: text("account_type", { enum: ["personal", "enterprise"] }).notNull().default("personal"),
  ownerId: text("owner_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  gitnexusStatus: text("gitnexus_status"),
  sandboxStatus: text("sandbox_status"),
  skillsStatus: text("skills_status"),
  publishStatus: text("publish_status"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// token_usage_logs: Token 用量日志
export const tokenUsageLogs = pgTable("token_usage_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  modelId: integer("model_id").notNull(),
  chatId: integer("chat_id"),
  backend: text("backend", { enum: ["sdk", "acp"] }).notNull().default("sdk"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
  cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costUsd: integer("cost_usd").notNull().default(0),
  contextSize: integer("context_size"),
  contextUsed: integer("context_used"),
  durationMs: integer("duration_ms").notNull().default(0),
  numTurns: integer("num_turns").notNull().default(1),
  projectId: text("project_id"),
  workspaceId: text("workspace_id"),
  createdAt: text("created_at").notNull(),
});

// user_model_configs: 用户 BYOK 模型配置
export const userModelConfigs = pgTable("user_model_configs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  modelName: text("model_name").notNull(),
  extraEnvJson: text("extra_env_json").notNull().default("{}"),
  backend: text("backend").notNull().default("sdk"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// entity_repositories: 仓库子表
export const entityRepositories = pgTable("entity_repositories", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  repoType: text("repo_type", { enum: ["github", "gitlab", "other"] }).notNull().default("other"),
  credentials: text("credentials").notNull().default("{}"),
  syncStatus: text("sync_status"),
  lastSyncAt: text("last_sync_at"),
  lastCheckedAt: text("last_checked_at"),
  localCommitHash: text("local_commit_hash"),
  remoteCommitHash: text("remote_commit_hash"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── 支付相关表 ──

// orders: 订单
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  planId: integer("plan_id").notNull().references(() => plans.id),
  subscriptionId: text("subscription_id"),
  nextRenewalReminderSent: boolean("next_renewal_reminder_sent").notNull().default(false),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("CNY"),
  originalAmount: integer("original_amount").notNull(),
  discountAmount: integer("discount_amount").notNull().default(0),
  billingCycle: text("billing_cycle", { enum: ["monthly", "yearly"] }).notNull(),
  paymentMode: text("payment_mode", { enum: ["subscription", "one_time"] }).notNull(),
  provider: text("provider").notNull(),
  providerPaymentId: text("provider_payment_id"),
  providerChargeId: text("provider_charge_id"),
  providerInvoiceId: text("provider_invoice_id"),
  status: text("status", {
    enum: ["pending", "paid", "cancelled", "refunded", "partially_refunded", "failed"],
  }).notNull().default("pending"),
  paidAt: text("paid_at"),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// refunds: 退款
export const refunds = pgTable("refunds", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  userId: text("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "processing", "completed", "failed"],
  }).notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
  provider: text("provider").notNull(),
  providerRefundId: text("provider_refund_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// notification_jobs: 通知任务队列
export const notificationJobs = pgTable("notification_jobs", {
  id: serial("id").primaryKey(),
  type: text("type", {
    enum: [
      "order_pending",
      "order_pending_reminder",
      "order_paid",
      "order_failed",
      "subscription_renewal_upcoming",
      "subscription_renewed",
      "refund_requested_admin",
      "refund_approved",
      "refund_completed",
      "refund_rejected",
      "token_top_up",
      "sandbox_applied_admin",
      "sandbox_approved",
      "sandbox_rejected",
      "plan_changed",
    ],
  }).notNull(),
  orderId: text("order_id"),
  subscriptionId: text("subscription_id"),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  data: text("data").notNull().default("{}"),
  status: text("status", {
    enum: ["pending", "sent", "failed", "skipped"],
  }).notNull().default("pending"),
  scheduledAt: text("scheduled_at").notNull(),
  sentAt: text("sent_at"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
});

// user_mcp_configs: 用户级第三方 MCP 服务器配置
export const userMcpConfigs = pgTable("user_mcp_configs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  entryJson: text("entry_json").notNull().default("{}"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// feedbacks: 意见反馈
export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  contact: text("contact"),
  type: text("type", { enum: ["bug", "improvement", "other"] }).notNull().default("bug"),
  status: text("status", { enum: ["pending", "reviewed", "resolved"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// token_top_ups: Token 充值记录（管理员手动充值/系统赠送等）
export const tokenTopUps = pgTable("token_top_ups", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokens: integer("tokens").notNull(),
  reason: text("reason", { enum: ["system_gift", "promotion", "compensation", "manual"] }).notNull().default("manual"),
  note: text("note"),
  expiresAt: text("expires_at").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// sandbox_applications: 沙箱申请
export const sandboxApplications = pgTable("sandbox_applications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  sandboxUrl: text("sandbox_url"),
  reason: text("reason"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
  remark: text("remark"),
  bindEntityId: text("bind_entity_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
