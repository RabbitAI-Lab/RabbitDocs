# 生产镜像压缩方案

## Context

当前生产镜像 `ghcr.io/rabbitai-lab/rabbitdocs` 大小 **2GB**，主要由三部分构成：
- `node_modules` 全量生产依赖 ~800MB（含大量客户端库如 monaco-editor、cherry-markdown）
- 运行时阶段不必要的 `python3/make/g++` 编译工具链 ~100MB
- `.next` 构建产物 ~100MB

通过启用 Next.js `standalone` 输出模式 + 移除运行时编译工具链，预计可将镜像压缩至 **~450-600MB**（减少 70%+）。

## 修改文件

1. `next.config.ts` — 启用 standalone 模式
2. `docker/Dockerfile.prod` — 重构为 standalone 架构

## 具体变更

### 1. next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "better-sqlite3", "bcrypt"],
  outputFileTracingIncludes: {
    "/*": ["drizzle/**/*"],
  },
};

export default nextConfig;
```

- `output: "standalone"` — Next.js build 后生成 `.next/standalone/` 目录，仅包含运行时必需的最小化 `node_modules` 和 `server.js`
- `outputFileTracingIncludes` — 确保 `drizzle/` 迁移文件被包含在 standalone 输出中

### 2. docker/Dockerfile.prod

关键变化：
1. **deps 阶段添加 `node-linker=hoisted`** — 解决 pnpm 符号链接与 standalone 不兼容的问题（仅影响 Docker 内部，不影响本地开发）
2. **移除 `prod-deps` 阶段** — standalone 模式自动追踪并只包含运行时必要的文件，不再需要手动 prune
3. **运行时阶段移除 `python3/make/g++`** — native addons（bcrypt、better-sqlite3）在 deps 阶段已编译完毕，运行时直接使用预编译产物
4. **运行时不再需要 pnpm** — 直接 `node server.js` 启动
5. **手动 COPY drizzle 目录** — `process.cwd()/drizzle` 路径需要与 standalone 工作目录对齐
6. **添加 BuildKit 缓存挂载** — 加速后续构建

```dockerfile
# Stage 1: 依赖安装（hoisted 模式避免 symlink 问题）
FROM node:20-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN echo 'node-linker=hoisted' > .npmrc
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile

# Stage 2: 构建（standalone 输出）
FROM node:20-bookworm-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 3: 运行时（极简）
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV MCP_PORT=4001
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 产物（含最小化 node_modules）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# standalone 不包含 static 和 public，需手动复制
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# drizzle 迁移文件（process.cwd()/drizzle）
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

RUN mkdir -p /app/data/home && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
```

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| standalone 文件追踪遗漏 native addon（better-sqlite3/bcrypt） | `serverExternalPackages` 已声明，hoisted 模式确保路径可追踪；若遗漏，可手动 COPY 补救 |
| `process.cwd()` 在 standalone 模式下的路径不一致 | 手动 COPY drizzle 到 standalone 根目录，确保 `process.cwd()/drizzle` 路径正确 |
| instrumentation.ts 动态 import 不被追踪 | 动态 `await import()` 在 `serverExternalPackages` 声明的包会被 Next.js 文件追踪自动发现 |
| Express MCP server (port 4001) 不工作 | `instrumentation.ts` 的 `register()` 在 standalone `server.js` 启动时同样会执行 |

## 验证步骤

1. `docker compose -f docker/docker-compose.prod.yml build` 构建镜像
2. 检查镜像大小：`docker images rabbitdocs:prod`
3. `docker compose -f docker/docker-compose.prod.yml up -d` 启动容器
4. 验证 Next.js 服务：`curl http://localhost:3000`
5. 验证 MCP 服务：`curl http://localhost:4001/mcp`
6. 验证数据库初始化：检查容器日志中 `[db]` 前缀的输出
7. 验证用户认证（bcrypt）：尝试登录/注册
8. 验证静态资源加载：浏览器访问检查 CSS/JS/字体
