# HTML MCP 工具实施方案

## Context

ChatWiki 当前 MCP 工具集只支持 Markdown 文档（`read_file` / `write_file` / `delete_file` / `rename_file` / `list_files` / `read_tree`）和一个客户端工具 `refresh_file_tree`。agent 无法在项目中直接处理 HTML 文件。

本方案为 MCP 工具集新增 4 个 HTML 工具，让 agent 可以在 `docs` 目录下创建/修改/删除 HTML 文件，并通过客户端工具在项目工作区的 tab 标签页中预览。HTML 文件会出现在项目左侧文件树中（带专属图标），使用 Monaco Editor 编辑，通过 `iframe sandbox` 安全隔离预览，并支持生成分享链接（独立于 chat 分享）。

预期结果：agent 可通过工具调用直接产出可预览的 HTML 文档，用户可在项目工作区无缝编辑/预览/分享。

---

## 1. 数据层

### 1.1 `src/db/schema.ts`：新增 `sharedHtmlFiles` 表

参考 `sharedChats`（L107-112），时间戳统一用 `text`（ISO 字符串）：

```ts
// shared_html_files: HTML 文件分享
export const sharedHtmlFiles = sqliteTable("shared_html_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  htmlPath: text("html_path").notNull(),   // 相对 projectRoot 的路径，如 "docs/index.html"
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

### 1.2 `src/lib/fs.ts`：核心抽象参数化

- `buildPath` (L36-44) 改为 `buildPath(...segments, ext = ".md")`：最后一个段没带后缀时拼接 `ext`；带了就直接用。默认 `.md` 保持向后兼容。
- 头部增加路径段防御：
  ```ts
  for (const seg of segments) {
    if (seg === ".." || seg.includes("\0")) {
      throw new Error("Invalid path segment");
    }
  }
  ```
- `listTree` (L117-148) 改为 `listTree(dirSegments, exts: string[] = [".md"])`：循环 `exts` 判定，文件名去后缀统一为 `name.slice(0, -ext.length)`。默认 `[".md"]` 保持向后兼容。
- `readDocument` / `writeDocument` / `deleteDocument` / `renameDocument` 末尾追加可选 `ext` 参数，默认 `.md`，透传给 `buildPath`。
- `listDocuments` (L433-440) 内部改用 `listTree(dirSegments, [".md"])`，签名保持不变（仍是 `(dirSegments) => string[]`）。

### 1.3 `src/lib/tree.ts`：`stripTreePrefix` 参数化

- `stripTreePrefix(fullPath, ext = ".md")`：当前强制剥 `.md`，改为根据 `ext` 剥，可传 `".html"`。默认保持向后兼容。

---

## 2. MCP Server-Side Tools

文件：`src/mcp-server/tools/file.ts`

复用现有 `requireDocsPath` (L18-26) 路径校验。新增 3 个工具（与 `write_file` / `delete_file` 同模式）：

```ts
server.registerTool("create_html", { ... }, async ({ path, content }) => {
  const segments = parsePath(path);
  const invalid = requireDocsPath(segments);
  if (invalid) return { content: [{ type: "text", text: invalid }], isError: true };
  // 路径必须以 .html 结尾
  if (!segments[segments.length - 1].endsWith(".html")) {
    return { content: [{ type: "text", text: "create_html requires .html file" }], isError: true };
  }
  writeDocument(content, ...segments, ".html");
  recordDocumentActivity(...);  // 记录活动
  return { content: [{ type: "text", text: `Created ${path}` }] };
});
```

`update_html` 同上（仍走 `writeDocument`）。`delete_html` 走 `deleteDocument(...segments, ".html")`，并在删除前查询 `sharedHtmlFiles` 中匹配 `htmlPath` 的记录一并删除（级联清理）。

所有工具需要：
1. `requireDocsPath` 校验 `segments[4] === "docs"`
2. 强制 `.html` 扩展名
3. `buildPath` 头部防 `..` 攻击
4. 调用 `recordDocumentActivity` 记录活动

---

## 3. MCP Client-Side Tool

文件：`src/lib/client-tools.ts`

```ts
const previewHtml = tool(
  "preview_html",
  "Open or switch to an HTML file in the project workspace tab. The path is relative to the project root, e.g. 'docs/index.html'. If the tab is already open, switches to it; otherwise opens a new tab.",
  {
    path: z.string().describe("HTML file path relative to project root, e.g. 'docs/foo.html'"),
  },
  async ({ path }) => {
    if (!path.endsWith(".html")) {
      throw new Error("preview_html only accepts .html files");
    }
    return {
      content: [{ type: "text" as const, text: `Preview requested for ${path}` }],
    };
  }
);
```

注册到 `createClientToolsMcpServer` 的 `tools: [refreshFileTree, previewHtml]`。

---

## 4. UI 集成

### 4.1 `src/components/ui/FileTree.tsx`

L287-298 文件渲染分支：

```tsx
if (node.path.endsWith(".html")) {
  return <FileCode2 className="..." />;  // 来自 lucide-react
}
return <File className="..." />;
```

### 4.2 `src/components/project/ProjectWorkspace.tsx`

- `FileTab` 接口 (L27-31) 增加 `type: "markdown" | "html"`
- 新增 `handlePreviewHtml(path: string)`：
  - 在 `tabs` 中查找同 path 的 html tab
  - 找到则 `setActiveTabId`（切换）
  - 未找到则 push 新 tab `{ id: uuid, path, type: "html", title, dirty: false }`
- 扩展 `onToolCall` 回调：
  ```tsx
  onToolCall={({ toolName, input }) => {
    if (toolName === "refresh_file_tree") router.refresh();
    else if (toolName === "preview_html") handlePreviewHtml(input.path);
  }}
  ```
- `renderTabContent` 按 `tab.type` 分发：`"html"` → `<HtmlEditor tab={tab} />`，否则 `DocumentEditor`

### 4.3 新建 `src/components/editor/HtmlEditor.tsx`

- 顶部 toolbar：文件名 + Monaco/预览 tab 切换 + 手动保存按钮（dirty 高亮）+ 分享按钮
- 编辑态：`<Editor @monaco-editor/react language="html" value={content} onChange={...} />`
- 预览态：`<iframe srcDoc={content} sandbox="" />`（最严格：无脚本、无表单、无弹窗、无同源）
- 保存：调用现有 `/api/fs/document?path=...` 写接口（需扩展为支持 `.html`，见 §1.2）
- 分享按钮：调用 `/api/share-html/...` 弹窗显示链接

### 4.4 `package.json`：新增依赖

```json
"@monaco-editor/react": "^4.6.0",
"monaco-editor": "^0.50.0"
```

---

## 5. 分享功能

### 5.1 4 个 API 端点

新建 `src/app/api/share-html/[projectId]/[...path]/route.ts`：

- `POST` → 创建或重新生成分享 token（upsert 到 `sharedHtmlFiles`）
- `DELETE` → 取消分享（删除记录）
- `GET` → 查询分享状态

返回结构：`{ token: string, url: string, createdAt: string, isShared: boolean }`

token 生成：使用 `crypto.randomUUID()` 或 `nanoid`（项目内已有就复用）。

### 5.2 公开页面

新建 `src/app/share-html/[token]/page.tsx`：
- 服务端从 `sharedHtmlFiles` 查 token → 拿 `projectId` + `htmlPath`
- 服务端读取 HTML 文件内容
- 全屏 `<iframe srcDoc={html} sandbox="" />` 渲染
- 不暴露 project 结构 / 文件树

### 5.3 新建 `src/components/project/ShareHtmlButton.tsx`

- 弹窗显示分享链接 + 复制按钮
- "取消分享" 按钮（DELETE）
- "重新生成分享链接" 按钮（POST 覆盖 token）
- 状态：未分享 / 已分享

---

## 6. 数据库迁移

新建 `drizzle/0018_add_shared_html_files.sql`：

```sql
CREATE TABLE `shared_html_files` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `project_id` text NOT NULL,
  `html_path` text NOT NULL,
  `token` text NOT NULL UNIQUE,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX `shared_html_files_token_idx` ON `shared_html_files` (`token`);
CREATE INDEX `shared_html_files_project_id_idx` ON `shared_html_files` (`project_id`);
```

执行：`npm run db:migrate` 或 `drizzle-kit push`

---

## 7. 实施任务清单（按依赖顺序）

1. **添加依赖**：`@monaco-editor/react` + `monaco-editor` 到 `package.json`，`npm install`
2. **fs.ts 参数化**：`buildPath` 接受 ext + `..` 防御；`listTree` 接受 exts；`read/write/delete/renameDocument` 透传 ext
3. **tree.ts**：`stripTreePrefix` 参数化
4. **DB schema**：`src/db/schema.ts` 新增 `sharedHtmlFiles` 表
5. **数据库迁移**：创建 `drizzle/0018_add_shared_html_files.sql` 并执行
6. **MCP server tools**：在 `file.ts` 注册 `create_html` / `update_html` / `delete_html`（含 `delete_html` 级联清理 `sharedHtmlFiles`）
7. **Client tool**：在 `client-tools.ts` 注册 `preview_html`
8. **分享 API**：实现 `src/app/api/share-html/[projectId]/[...path]/route.ts`（POST/GET/DELETE）
9. **公开分享页**：实现 `src/app/share-html/[token]/page.tsx`
10. **FileTree 改造**：HTML 文件用 `FileCode2` 图标
11. **ProjectWorkspace 改造**：FileTab.type + `handlePreviewHtml` + onToolCall 分发
12. **HtmlEditor 组件**：Monaco 编辑 + iframe 预览 + 手动保存
13. **ShareHtmlButton 组件**：弹窗 + 复制 + 取消/重新生成分享
14. **更新 system prompt / agent 提示**：在 system prompts 表中告知 agent 新工具用途
15. **回归测试**：跑现有 Markdown 工具的端到端用例，确保 `buildPath` 默认 `.md` 行为不变

---

## 8. 验证步骤

### 8.1 单元/集成

- [ ] `buildPath(root, "..", "etc", "passwd", ".md")` 抛错
- [ ] `listTree(segments, [".html"])` 仅返回 HTML 文件
- [ ] `listTree(segments)`（默认）仍只返回 `.md`（向后兼容）
- [ ] MCP 工具 `create_html` 在 `docs/` 外调用 → 拒绝
- [ ] MCP 工具 `create_html` 在 `docs/foo/bar.html` 调用 → 创建成功
- [ ] MCP 工具 `create_html` 在 `docs/foo.txt` 调用 → 拒绝（非 .html）
- [ ] `delete_html` 删除后对应 `sharedHtmlFiles` 记录被级联清理
- [ ] 分享 token 唯一性、取消后 token 查不到、重新生成后旧 token 失效

### 8.2 E2E 流程

1. 启动 dev server，访问项目 `http://localhost:3000`
2. 在 chat 中让 agent 调用 `create_html` 创建 `docs/hello.html`
3. 文件树出现新 HTML 图标（点击后编辑器内是 Monaco 高亮）
4. 让 agent 调用 `preview_html` 传 `docs/hello.html` → tab 打开新 HTML
5. 在 HtmlEditor 中切换 Monaco 编辑 / iframe 预览
6. 修改后手动保存 → 预览自动刷新
7. 点击分享 → 弹窗显示 `http://localhost:3000/share-html/{token}`
8. 复制链接到新隐身窗口 → 看到 HTML 渲染（脚本被 sandbox 阻止）
9. 重新生成分享 → 旧链接 404，新链接可用
10. 取消分享 → 所有链接 404
11. 让 agent 调用 `update_html` 修改 → 编辑器内容更新
12. 让 agent 调用 `delete_html` → 文件从树消失，分享记录同步清除
13. 重复调用 `preview_html` 同一文件 → 切换到已存在的 tab（不重复打开）

### 8.3 安全验证

- [ ] 公开 `/share-html/[token]` 页面：iframe `sandbox=""` 阻止 JS、表单提交、`window.open`、跨源请求
- [ ] 公开页面响应不包含 `project_id`、其他文件路径、token 列表
- [ ] MCP 工具拒绝 `path = "personal/default/projects/{id}/docs/../config.json"` 等逃逸尝试
- [ ] 公开页面对不存在的 token 返回 404，不泄露存在性

### 8.4 回归

- [ ] 现有 Markdown 工具（`write_file` 等）行为不变
- [ ] 文件树对 `.md` 文件显示保持原样
- [ ] DocumentEditor、CherryEditor 不受影响
- [ ] 现有 chat 分享 (`/share/[token]`) 不受影响

---

## 9. 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| preview_html 实现 | client-side tool | 触发前端 UI 切换 tab，无需 MCP 重启 |
| 文件树集成 | 显示 HTML（带不同图标） | 与 Markdown 统一体验 |
| 编辑器 | Monaco Editor | 支持 HTML 高亮、复杂编辑体验 |
| 保存策略 | 手动保存 | 避免 agent 误操作覆盖用户内容 |
| 沙箱 | iframe `sandbox=""` | 浏览器原生最严格隔离 |
| 分享实现 | 新增 `shared_html_files` 表 | 独立于 chat 分享，结构更清晰 |
| buildPath 改造 | 参数化 + 默认 `.md` | 保持向后兼容，最小变更 |
| 子目录 | 允许 `docs/` 下嵌套 HTML | 组织更灵活 |
| 分享语义 | 实时（删除/修改后访问即变） | 与 chat 分享一致，无快照复杂度 |
| 分享路径 | `/share-html/[token]`（独立路由） | 不与 `/share/[token]`（chat）冲突 |

---

## 10. 关键文件清单

**修改**：
- `src/lib/fs.ts` — `buildPath` / `listTree` / 文档 CRUD 参数化 + 路径防御
- `src/lib/tree.ts` — `stripTreePrefix` 参数化
- `src/db/schema.ts` — 新增 `sharedHtmlFiles` 表
- `src/mcp-server/tools/file.ts` — 注册 3 个 HTML 工具
- `src/lib/client-tools.ts` — 注册 `preview_html`
- `src/components/ui/FileTree.tsx` — HTML 图标分支
- `src/components/project/ProjectWorkspace.tsx` — tab type + onToolCall 分发
- `package.json` — 新增 monaco 依赖

**新建**：
- `drizzle/0018_add_shared_html_files.sql`
- `src/app/api/share-html/[projectId]/[...path]/route.ts`
- `src/app/share-html/[token]/page.tsx`
- `src/components/editor/HtmlEditor.tsx`
- `src/components/project/ShareHtmlButton.tsx`
