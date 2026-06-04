# Database Dump & Restore 功能

## Context

项目当前使用 SQLite (better-sqlite3) + Drizzle ORM，仅支持单一数据库。需要添加数据库 dump/restore 能力，支持 JSON（跨数据库兼容）和 SQL（SQLite 原生）双格式，方便数据迁移、备份和灾难恢复。

## 新建文件

| 文件 | 用途 |
|------|------|
| `src/lib/db-dump.ts` | 核心 dump/restore 逻辑 |
| `src/app/api/auth/admin/database/info/route.ts` | GET 数据库统计信息 |
| `src/app/api/auth/admin/database/dump/route.ts` | GET 导出 JSON/SQL |
| `src/app/api/auth/admin/database/restore/route.ts` | POST 从 JSON 恢复 |
| `src/app/admin/database/page.tsx` | Admin 页面（server component） |
| `src/components/admin/DatabasePageClient.tsx` | Admin 页面 UI（client component） |

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/db/index.ts` | 新增 `getSqlite()` 导出函数，暴露原始 better-sqlite3 实例 |
| `src/components/admin/AdminSidebar.tsx` | Infrastructure 分组新增 "Database" 菜单项 |

## 实现细节

### 1. `src/db/index.ts` — 新增 getSqlite()

在现有 `db` Proxy 导出之后添加：

```ts
export function getSqlite(): Database.Database {
  if (!_sqlite) initDb();
  return _sqlite!;
}
```

### 2. `src/lib/db-dump.ts` — 核心逻辑

**表发现**：通过 `sqlite_master` 获取所有用户表名，排除 `_migrations`，仅处理 schema 中存在的表。

**JSON Dump 格式**：
```json
{
  "version": 1,
  "timestamp": "2026-06-05T10:30:00.000Z",
  "tables": {
    "accounts": {
      "columns": ["id", "name", "type", "created_at"],
      "rows": [{ "id": 1, "name": "Default", "type": "personal", ... }]
    }
  }
}
```
- 使用列名键值对（非位置数组），兼容列顺序变化
- 通过 Drizzle ORM `db.select().from(table).all()` 读取，确保类型安全

**SQL Dump 格式**：
```sql
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
-- Table: accounts (5 rows)
INSERT INTO accounts (id, name, type, created_at) VALUES (1, 'Default', 'personal', '...');
-- ... all tables ...
COMMIT;
PRAGMA foreign_keys=ON;
```
- 关闭外键约束以支持任意插入顺序
- 使用参数化值防止 SQL 注入

**Restore 逻辑**：
- 整体包裹在 `sqlite.transaction()` 中，失败自动回滚
- 将 dump 中的列与当前 schema 做交集，处理列增减
- 恢复前清空目标表数据
- 重置自增序列

**getDatabaseInfo()**：
- 文件路径、大小、最后修改时间
- SQLite 版本、journal mode、integrity check 状态
- 各表行数/列数统计

### 3. API 端点

所有端点使用 `requireAdmin(req)` 鉴权，`export const dynamic = "force-dynamic"`。

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/auth/admin/database/info` | GET | 返回数据库统计信息 |
| `/api/auth/admin/database/dump?format=json\|sql` | GET | 下载 dump 文件 |
| `/api/auth/admin/database/restore` | POST | 从 JSON 恢复 |

Dump 端点返回 `Content-Disposition: attachment` 头，浏览器自动下载。
Restore 端点接受 `{ data: DatabaseDump, options?: { skipTables?: string[] } }` JSON body。

### 4. Admin UI

**DatabasePageClient.tsx** 包含三个区域：

1. **数据库概览** — 文件路径、大小、版本、表统计表格
2. **导出** — 两个按钮：Export JSON / Export SQL，点击触发下载
3. **恢复** — Upload 组件选择 .json 文件 → 预览摘要 → 确认弹窗 → 执行恢复

使用 Ant Design 组件：Card, Table, Button, Upload, Modal, App.useApp()。
下载逻辑：`authFetch()` → `res.blob()` → `URL.createObjectURL()` → 触发 `<a>` 点击。

### 5. 侧边栏

在 Infrastructure 分组中，Email 之后添加 Database 菜单项：
- href: `/admin/database`
- label: `Database`
- icon: 数据库圆柱体 SVG

## 验证

1. 启动 dev server，访问 `/admin/database` 查看数据库概览
2. 点击 Export JSON，验证下载的 JSON 文件包含所有表数据
3. 点击 Export SQL，验证下载的 SQL 文件语法正确
4. 上传 JSON 文件执行恢复，验证数据正确恢复且表行数一致
5. 验证非 admin 用户无法访问 API 端点
