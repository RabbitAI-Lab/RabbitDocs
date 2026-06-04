# SQLite → PostgreSQL 迁移方案

## Context

ChatWiki 当前使用 SQLite (better-sqlite3) + Drizzle ORM 作为数据层。随着项目发展，需要迁移到 PostgreSQL 以获得更好的并发性能、云数据库支持和生产级可靠性。本次迁移涉及 Schema 重写、驱动替换、同步→异步 API 改造、Docker 配置更新和数据迁移。

---

## 一、技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| PG 驱动 | `postgres` (postgres.js) | API 更简洁、Drizzle 一级支持、性能更优 |
| ORM | Drizzle ORM (不变) | 仅切换 dialect：`sqlite-core` → `pg-core` |
| 迁移工具 | Drizzle Kit 内置 migrator | 替代当前自定义迁移系统 |
| 布尔字段 | 使用 PG 原生 `boolean` | 下游 `=== 1` 比较改为布尔判断 |
| 时间字段 | 保持 `text` (ISO 字符串) | 避免时区问题，最小化改动 |
| JSON 字段 | 保持 `text` | 可选后续升级为 `jsonb`，本次不动 |
| 双数据库模式 | **不支持** | 维护成本过高，在 feature 分支一次性迁移 |

---

## 二、改动范围

### 核心变更（3 个文件完全重写）

| 文件 | 改动 |
|------|------|
| `src/db/schema.ts` | `sqliteTable` → `pgTable`，`integer` → `serial`/`boolean`，类型映射 |
| `src/db/index.ts` | `better-sqlite3` → `postgres`，同步→异步，Proxy 删除，使用 Drizzle migrator |
| `drizzle.config.ts` | `dialect: "postgresql"`，`dbCredentials: { url }` |

### API 转换（最大工作量，~60 个文件）

所有 DB 调用从同步改为异步，模式如下：

```
// Before (SQLite 同步)
const row = db.select().from(table).where(eq(...)).get();
const result = db.insert(table).values({...}).run();
const id = result.lastInsertRowid;

// After (PostgreSQL 异步)
const [row] = await db.select().from(table).where(eq(...)).limit(1);
const [inserted] = await db.insert(table).values({...}).returning();
const id = inserted.id;
```

关键 API 差异：
- `.get()` → `await ... limit(1)` 取 `[0]`
- `.all()` → `await ...` 直接返回数组
- `.run()` → `await ...` 直接执行
- `result.lastInsertRowid` → `.returning()` 获取完整行

### 布尔字段转换

| 表 | 字段 | `integer` → `boolean` |
|----|------|----------------------|
| templates | isSystem | `=== 1` → 直接布尔判断 |
| chatMessages | isError | 同上 |
| modelConfigs | isDefault | 同上 |
| systemPrompts | enabled, isSystem | 同上 |
| todos | completed | 同上 |
| users | emailVerified, disabled | 同上 |
| apiKeys | isSystem | 同上 |
| plans | enabled | 同上 |

---

## 三、分阶段执行计划

### Phase 1: Schema 迁移 + 依赖替换

**文件**: `src/db/schema.ts`, `package.json`, `drizzle.config.ts`, `next.config.ts`

1. 安装 `postgres`，移除 `better-sqlite3` 和 `@types/better-sqlite3`
2. `schema.ts` 全量重写：
   - `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core"` → `import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core"`
   - `integer("id").primaryKey({ autoIncrement: true })` → `serial("id").primaryKey()`
   - 布尔字段 `integer("col").default(0)` → `boolean("col").default(false)`
   - 其他 `integer` 保持不变（外键引用等）
3. `drizzle.config.ts` 改为 `dialect: "postgresql"`, `dbCredentials: { url: process.env.DATABASE_URL! }`
4. `next.config.ts` 中 `serverExternalPackages` 替换 `better-sqlite3` → `postgres`

### Phase 2: 连接层重写

**文件**: `src/db/index.ts`, `src/instrumentation.ts`

1. `index.ts` 完全重写：
   - 删除所有 SQLite 代码（PRAGMA、sqlite_master、integrity_check、WAL）
   - 使用 `postgres(connectionString)` 创建连接
   - 使用 `drizzle(client, { schema })` 创建实例
   - `initDb()` 变为 `async`，使用 Drizzle 内置 migrator
   - 删除 Proxy 包装，直接导出 `db` 实例
   - 保留 graceful shutdown（`await client.end()`）
2. `instrumentation.ts`: `initDb()` → `await initDb()`

### Phase 3: 同步→异步批量转换（按模块）

**顺序**: lib 文件 → API 路由 → 页面组件 → MCP 工具

#### 3a. 库文件（6 个，函数签名变为 async）

- `src/lib/auth/settings.ts` — 所有函数加 `async`，内部加 `await`
- `src/lib/auth/api-key.ts` — 同上
- `src/lib/auth/session.ts` — 内部加 `await`（已是 async）
- `src/lib/auth/sa-token.ts` — 内部加 `await`
- `src/lib/model-service.ts` — 内部加 `await`（已是 async）
- `src/lib/operation-log.ts` — 内部加 `await`

#### 3b. API 路由（~46 个，添加 `await`）

每个文件的模式：
1. 所有 `db.select()...` 前加 `await`
2. `.get()` 改为 `limit(1)` + `[0]`
3. `.all()` 改为 `await ...`（Drizzle PG 默认返回数组）
4. `.run()` 改为 `await ...`
5. `result.lastInsertRowid` 改为 `.returning()` 模式
6. 布尔比较 `=== 1` → `=== true`，`!== 1` → `=== false`

#### 3c. 页面组件（~8 个）

确保是 `async function`，内部 DB 调用加 `await`

#### 3d. MCP Server 工具（2 个）

`src/mcp-server/tools/file.ts`, `template.ts` — 添加 `await`

### Phase 4: 迁移文件重建

1. 备份 `drizzle/` → `drizzle-sqlite-backup/`
2. 清空 `drizzle/` 和 `drizzle/meta/`
3. 启动本地 PG 实例
4. 运行 `pnpm drizzle-kit generate` 生成全新 PG 迁移
5. 验证生成的 SQL 语法

### Phase 5: Docker 配置

**文件**: `docker-compose.dev.yml`, `docker-compose.prod.yml`, `Dockerfile.dev`, `Dockerfile.prod`

1. 添加 `postgres` 服务（`postgres:16-alpine`）
2. 应用服务添加 `depends_on` 和 `DATABASE_URL` 环境变量
3. 移除 SQLite 相关的 volume 挂载（`data.db`, `data.db-shm`, `data.db-wal`）
4. 添加 PG 数据卷

### Phase 6: 数据迁移脚本

**新建文件**: `scripts/migrate-sqlite-to-pg.ts`

按外键依赖顺序迁移 25 张表的数据，处理类型转换（`0/1` → `false/true`），重置 PG 序列。

---

## 四、验证方案

| 阶段 | 验证方法 |
|------|----------|
| Phase 1 | `tsc --noEmit` 类型检查通过；`drizzle-kit generate` 无报错 |
| Phase 2 | 应用启动成功，PG 连接正常，seed 数据写入 |
| Phase 3 | 每个 API 路由返回正确数据；`tsc --noEmit` 通过 |
| Phase 4 | 全新 PG 实例上迁移成功执行 |
| Phase 5 | `docker compose up` 后应用正常启动 |
| Phase 6 | 行数校验、外键完整性校验、关键业务功能回归测试 |

关键回归测试点：
1. 用户注册/登录/Passkey
2. 聊天创建/消息发送/流式响应
3. 模板 CRUD / 系统提示词
4. 会话分享 / HTML 分享
5. 管理后台所有配置页
6. API Key 认证 / CLI 认证

---

## 五、风险与回滚

- **回滚策略**: Git feature 分支开发，主分支保持 SQLite 可用；迁移前备份 SQLite 文件
- **高风险项**: `lastInsertRowid` 遗漏（TS 类型系统会捕获）、布尔比较遗漏（全局搜索 `=== 1`）
- **性能**: PG 网络延迟 > SQLite 内存访问，但 PG 连接池和并行查询能力远优

---

## 六、预估时间

| Phase | 工作量 |
|-------|--------|
| Phase 1: Schema + 依赖 | 1 天 |
| Phase 2: 连接层 | 0.5 天 |
| Phase 3: 异步转换 | 3-4 天（最大工作量） |
| Phase 4: 迁移文件 | 0.5 天 |
| Phase 5: Docker | 0.5 天 |
| Phase 6: 数据迁移 | 1 天 |
| 测试 | 1-2 天 |
| **总计** | **8-10 天** |
