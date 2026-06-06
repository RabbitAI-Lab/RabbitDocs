# 修复生产环境 Turbopack 外部模块加载失败

## Context

生产环境聊天功能报错：

```
Error: Failed to load external module @anthropic-ai/claude-agent-sdk-6f88bcb0fd027c9d: 
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@anthropic-ai/claude-agent-sdk-6f88bcb0fd027c9d' 
imported from /app/.next/server/chunks/[turbopack]_runtime.js
```

### 根因分析

Next.js 16 默认使用 Turbopack 作为构建工具。Turbopack 处理 `serverExternalPackages` 时：

1. **构建阶段**：Turbopack 为每个外部包生成带 hash 后缀的模块标识符（如 `@anthropic-ai/claude-agent-sdk-6f88bcb0fd027c9d`），并在 `.next/node_modules/` 中创建对应的相对路径软链接，指向 `node_modules/.pnpm/` 中的实际包
2. **运行时**：`[turbopack]_runtime.js` 中的 `externalImport()` 调用 `await import("@anthropic-ai/claude-agent-sdk-6f88bcb0fd027c9d")`，Node.js 通过软链接解析到真实包

**问题出在 Dockerfile.prod 的多阶段构建**：

```dockerfile
# Stage 2.5: 裁剪为生产依赖
FROM builder AS prod-deps
RUN pnpm config set ignore-scripts true && pnpm prune --prod

# Stage 3: 运行时
COPY --from=prod-deps /app/node_modules ./node_modules   ← 来自 prod-deps（已裁剪）
COPY --from=builder   /app/.next    ./.next              ← 来自 builder（未裁剪）！
```

- `.next` 来自 `builder` 阶段（完整依赖环境）
- `node_modules` 来自 `prod-deps` 阶段（已执行 `pnpm prune --prod`）
- `.next/node_modules/` 中的软链接指向的 `.pnpm/` 路径在裁剪后的 `node_modules` 中可能已不存在或结构已变

**为什么只有聊天受影响**：`@anthropic-ai/claude-agent-sdk` 是 ESM 包（`"type": "module"`），通过 `await import()` 加载。Node.js ESM 解析对软链接目标的存在性更敏感。而 `better-sqlite3`（CJS）可能因 pnpm store 路径未被裁剪而仍可正常解析。

## 修复方案

### 修改文件

1. `docker/Dockerfile.prod` — 将 `.next` 的复制来源从 `builder` 改为 `prod-deps`，确保 `.next` 和 `node_modules` 来自同一构建阶段

### 具体改动

```dockerfile
# 修改前：
COPY --from=builder   --chown=nextjs:nodejs /app/.next    ./.next

# 修改后：
COPY --from=prod-deps --chown=nextjs:nodejs /app/.next    ./.next
```

这样 `.next/node_modules/` 中的软链接与裁剪后的 `node_modules/.pnpm/` 保持一致。

### 备选方案

如果上述修改不能解决问题（例如 `pnpm prune` 确实改变了 `.pnpm/` 路径结构），则使用 `--webpack` 构建生产包：

```dockerfile
# builder 阶段
RUN pnpm build -- --webpack
```

Webpack 处理 `serverExternalPackages` 不会生成带 hash 后缀的模块标识符，直接使用原始包名做 `require()`，避免了软链接问题。

## 验证方式

1. 执行 `docker compose -f docker/docker-compose.prod.yml build` 重新构建镜像
2. 执行 `docker compose -f docker/docker-compose.prod.yml up -d` 启动服务
3. 登录后进入聊天页面，发送一条消息，确认 AI 能正常回复
4. 检查 `docker compose -f docker/docker-compose.prod.yml logs -f` 中无 `[ERR_MODULE_NOT_FOUND]` 错误
