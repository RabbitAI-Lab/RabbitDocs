# 将 Wiki 系统提示词提取为内置数据

## Context

当前 `/admin/system-prompts` 页面中有一条手动创建的 "Wiki" 系统提示词，内容涉及 ChatWiki MCP 配置。需要将其转为系统内置记录：
- 新部署环境通过 seed 自动初始化
- 禁止删除（隐藏删除按钮 + API 保护）
- 仍然允许编辑内容和启用/禁用

参考 templates 模块的 `is_system` 机制，为 system_prompts 表增加同样的标记能力。

## 数据库中现有 Wiki 记录

- name: `Wiki`
- content: `如果涉及到Wiki的增删改查操作，需要使用ChatWiki MCP进行。使用ChatWiki MCP前，先检查ChatWiki MCP是否已安装。MCP配置是:\n{"chatwiki": {"type": "http", "url": "http://127.0.0.1:4001/mcp"}}`

## 实施计划

### Task 1: 创建迁移文件 — 添加 is_system 列

新建 `drizzle/0019_add_is_system_to_system_prompts.sql`：

```sql
ALTER TABLE system_prompts ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
```

### Task 2: 创建迁移文件 — 标记现有 Wiki 记录

新建 `drizzle/0020_mark_system_system_prompts.sql`：

```sql
UPDATE system_prompts SET is_system = 1 WHERE name = 'Wiki';
```

### Task 3: 更新 schema.ts

文件: `src/db/schema.ts`

在 `systemPrompts` 表定义中添加 `isSystem` 字段：

```ts
isSystem: integer("is_system").notNull().default(0),
```

### Task 4: 更新 seed.ts

文件: `src/db/seed.ts`

在 seed 函数中增加 system_prompts 的种子逻辑：
- 检查 system_prompts 表是否为空
- 为空时插入 Wiki 内置提示词（`isSystem: 1`）
- import 中添加 `systemPrompts`

### Task 5: 更新 SystemPromptsPageClient.tsx — 隐藏删除按钮

文件: `src/components/admin/SystemPromptsPageClient.tsx`

- `SystemPrompt` 接口添加 `isSystem: number` 字段
- Actions 列的删除按钮添加条件渲染：`isSystem !== 1` 时才显示

### Task 6: 更新 DELETE API — 服务端保护

文件: `src/app/api/system-prompts/[id]/route.ts`

DELETE 端点增加 is_system 检查：
- 查询目标记录的 is_system 值
- 若为 1，返回 403 Forbidden

## 涉及文件

| 文件 | 操作 |
|---|---|
| `drizzle/0019_add_is_system_to_system_prompts.sql` | 新建 |
| `drizzle/0020_mark_system_system_prompts.sql` | 新建 |
| `src/db/schema.ts` | 修改 |
| `src/db/seed.ts` | 修改 |
| `src/components/admin/SystemPromptsPageClient.tsx` | 修改 |
| `src/app/api/system-prompts/[id]/route.ts` | 修改 |

## 验证

1. 启动项目 `npm run dev`，确认迁移正常执行（日志中出现 `✓ 0019_...` 和 `✓ 0020_...`）
2. 访问 `/admin/system-prompts`，确认 Wiki 记录存在且无删除按钮
3. 确认 Wiki 记录仍可编辑内容和切换启用状态
4. 通过 API 直接调用 `DELETE /api/system-prompts/{wiki_id}`，确认返回 403
5. 清空数据库后重新启动，确认 Wiki 通过 seed 自动创建
