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
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// chat_messages: 聊天消息
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
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
