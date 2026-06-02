# 添加 GitNexus MCP 全局配置

## Context

用户希望在 `/admin/mcp` 页面新增一个名为 `gitnexus` 的 MCP server，配置文件如下：

```json
{
  "mcpServers": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

经研究当前实现：

- `/admin/mcp` 页面（`src/app/admin/mcp/page.tsx` + `src/components/admin/McpPageClient.tsx`）是一个**单 JSON 编辑器**（`Input.TextArea`，rows=20）
- `mcp_config` 表是**单行配置表**（`src/db/schema.ts` L82-88），整张表只有一条记录，所有 MCP server 装在一个 JSON 对象里
- 数据库中现有内容：`{}`（空对象，无任何 MCP 配置）
- 存储格式：**不带 `mcpServers` 外层包装**，最外层就是 server map（由 `src/lib/model-service.ts` L49-61 `readMcpServers()` 直接 `JSON.parse` 注入 `sdkOptions.mcpServers`）

由于采用 JSON 编辑器模式且无独立"卡片/列表 UI"概念，**本任务无需修改任何代码**——只需要在 admin 页面把 JSON 粘到 TextArea 中保存即可。

## 目标

将 gitnexus MCP server 持久化到 `mcp_config.configJson` 字段中，使 Claude Agent SDK 在下次聊天时能加载 GitNexus MCP。

## 最终要写入的 JSON 文本

把以下 JSON **完整替换** admin 页面 TextArea 内的现有内容，然后点击 `Save` 按钮：

```json
{
  "gitnexus": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "gitnexus@latest", "mcp"]
  }
}
```

**关键点**：

1. **去除外层 `mcpServers` 包装**：用户原始配置是 Claude Desktop 标准格式（带 `mcpServers` 包装层），本系统存储格式直接是 server map，需要去掉外层。
2. **显式声明 `type: "stdio"`**：与现有 `EXAMPLE_JSON`（`src/components/admin/McpPageClient.tsx` L18-24）和 `handleInstallChatWiki` 注入 chatwiki server 的写法保持一致。
3. **整体结构 = 一个对象**：`{ "<server-name>": { "type": "stdio", "command": "npx", "args": [...] } }`，键名 `gitnexus` 即 Claude Agent SDK 中的 server name。

## 操作步骤

1. 启动开发服务器：`pnpm dev`（或运行 `bash scripts/dev.sh`）
2. 浏览器访问 `http://localhost:3000/admin/mcp`
3. 清空页面中 `Input.TextArea` 现有内容（当前为 `{}`）
4. 粘贴上面的 JSON
5. 点击右上角 `Save` 按钮
6. 前端会先 `JSON.parse` 校验 → `PUT /api/mcp-config`（`src/app/api/mcp-config/route.ts` L18-61）再次校验并 `db.update(mcpConfig)` 覆盖单行记录
7. 保存成功后页面底部 `Last saved:` 时间会更新，并弹出"Saved successfully"提示

## 关键文件（仅作参考，本任务不修改）

- `src/app/admin/mcp/page.tsx` — 服务端读 mcp_config 单行记录
- `src/components/admin/McpPageClient.tsx` — JSON 编辑器（前端校验 + PUT）
- `src/app/api/mcp-config/route.ts` — GET / PUT 路由（后端校验 + 覆盖写库）
- `src/db/schema.ts` L82-88 — `mcpConfig` 表结构
- `src/lib/model-service.ts` L49-61、L195-213 — `readMcpServers()` 与 `sdkOptions.mcpServers` 合并逻辑

## 验证

1. **数据库验证**：
   ```bash
   sqlite3 data.db "SELECT config_json, updated_at FROM mcp_config;"
   ```
   期望输出：
   ```
   {
     "gitnexus": {
       "type": "stdio",
       "command": "npx",
       "args": ["-y", "gitnexus@latest", "mcp"]
     }
   }|2026-06-XX XX:XX:XX
   ```

2. **API 验证**：
   ```bash
   curl http://localhost:3000/api/mcp-config
   ```
   期望返回：
   ```json
   {
     "configJson": "{\n  \"gitnexus\": { \"type\": \"stdio\", ... }\n}",
     "updatedAt": "..."
   }
   ```

3. **聊天端到端验证**：
   - 在 chat 页面发送一条消息，让 Agent 使用 gitnexus 提供的工具（如代码分析相关工具）
   - 观察 Claude Agent SDK 是否成功启动 `npx -y gitnexus@latest mcp` 子进程（可在终端日志中查看 MCP 启动信息）
   - 可用工具前缀应为 `mcp__gitnexus__*`

## 风险与注意

- `npx -y gitnexus@latest` 首次运行会下载 npm 包，可能需要数秒，Agent 调用时会有启动延迟
- 如系统未安装 `npx` / Node.js，则该 MCP 启动失败，需要保证运行环境有 Node
- 若 `gitnexus` 名称已存在于项目级 `.mcp.json` 中，全局会被项目级覆盖（参见 `model-service.ts` L195-213 合并顺序：全局 → 项目级 → 内置 `chatwiki_client`）
