# Rabbit Doc MCP 新增 Todo 工具 + 修复 API Key 认证

## Context

MCP Server 当前提供了 project、file、directory、template 四类工具，但缺少 todo 工具。数据库中已有 `todos` 表，REST API 也已有完整的 CRUD 端点（`/api/todos`），需要在 MCP 层补充等价的 todo 工具，使 ACP Agent 可以通过 MCP 协议管理用户的待办事项。

同时发现一个 **API Key 认证不生效** 的 bug：MCP 配置中 headers 用的是 `"api-key": "${user-api-key}"`，但服务端读取的是 `"authorization": "Bearer atm_xxx"`，header 名不匹配导致认证永远失败。

## 已完成（上一轮）

- ✅ 新建 `src/mcp-server/tools/todo.ts`（list_todos / create_todo / update_todo / delete_todo）
- ✅ 修改 `src/mcp-server/index.ts` 注册 todo 工具

## 待修复：API Key header 名对齐

### 问题

| 位置 | header 名 | 值格式 |
|------|-----------|--------|
| MCP 配置 | `api-key` | `atm_xxx` |
| 服务端读取 | `authorization` | `Bearer atm_xxx` |

### 修改方案：改配置端，对齐服务端

#### 文件 1: `src/components/admin/McpPageClient.tsx` (L46, L52)

将 `"api-key": "${user-api-key}"` 改为 `"Authorization": "Bearer ${user-api-key}"`，两处。

#### 文件 2: `src/db/seed.ts` (L199-203)

系统提示词中的 MCP 配置示例，添加 headers：
```json
{
  "rabbit-docs-mcp": {
    "type": "http",
    "url": "http://127.0.0.1:4001/mcp",
    "headers": { "Authorization": "Bearer ${user-api-key}" }
  }
}
```

#### 文件 3: `src/lib/model-service.ts` (L598-612) — 无需修改

`resolveMcpServersForUser` 已支持替换 `${user-api-key}` 占位符，改为 `Bearer ${user-api-key}` 后值变成 `Bearer atm_xxx`，服务端可直接解析。

## 验证

1. **重启 Next.js dev server**（`npm run dev`），MCP Server 通过 `instrumentation.ts` 启动，Turbopack HMR 不会自动重启它
2. 确认终端日志输出 `[MCP] RabbitDocs MCP Server running on http://127.0.0.1:4001/mcp`
3. 使用 MCP 客户端（或 ChatWiki 内部 Agent）连接 MCP Server，确认 `list_todos` / `create_todo` / `update_todo` / `delete_todo` 出现在工具列表中
4. 确认带 API Key 的请求能正确识别用户，todo 工具可正常操作
5. 确认未提供 API Key 时所有 todo 工具返回认证错误
6. 白名单无需修改，`mcp__rabbit-docs-mcp__*` 通配符已覆盖所有内置 MCP 工具
