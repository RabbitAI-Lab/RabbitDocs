# ChatWiki 国际化 (i18n) 实施方案

## Context

ChatWiki (品牌名 RabbitDocs) 当前所有 UI 文本和 API 消息均为硬编码，存在中英文混用的状况（如 `error.tsx` 中 "页面加载失败"、`workspace-mcp` 路由中 "缺少 dirSegments 参数"）。需要引入统一的 i18n 方案，支持中文/英文切换，Cookie 模式不改变 URL 结构。

**现状数据**：
- 104 个组件文件 + 39 个页面文件 + 96 个 API 路由
- 79 个 TSX 含硬编码英文文本
- 110 处 `message.success/error/warning/info` 调用
- 179 处 API 路由中硬编码消息（中英混合）
- 80 处 Zod schema 验证

---

## 技术选型：next-intl 4.13.0

**选择理由**：
1. 官方支持 Cookie 模式（"without locale-based routing"），不需要 `[locale]` 路由段
2. Server Component 用 `getTranslations()`，Client Component 用 `useTranslations()`，一套 API
3. 内置 TypeScript 类型提示，ICU MessageFormat 支持变量/复数
4. 社区活跃（4.3k+ stars），持续维护

---

## 架构设计

### 数据流

```
Cookie (NEXT_LOCALE)
  → src/i18n/request.ts (getRequestConfig 读取 Cookie)
    → layout.tsx (getLocale + getMessages + NextIntlClientProvider)
      → ThemeRegistry (ConfigProvider locale 同步 Ant Design)
        → 所有组件 (useTranslations / getTranslations)
```

### Provider 嵌套顺序（layout.tsx）

```
<html lang={locale}>
  <body>
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeRegistry locale={locale}>       {/* antd ConfigProvider locale */}
        <AuthProvider>
          <FloatingChatProvider>
            {children}
          </FloatingChatProvider>
        </AuthProvider>
      </ThemeRegistry>
    </NextIntlClientProvider>
  </body>
</html>
```

### 翻译文件结构

```
messages/
  zh.json    # 中文翻译（所有 namespace 合并）
  en.json    # 英文翻译
```

单文件 + namespace 嵌套 key（如 `admin.usersPage.title`），预计约 600 个 key，文件大小可控。

### Namespace 划分

| Namespace | 覆盖范围 | 预估 key |
|-----------|---------|---------|
| common | 保存/取消/删除/搜索/加载等通用词 | ~30 |
| sidebar | 侧边栏菜单文本 | ~15 |
| admin | Admin 后台所有页面 | ~120 |
| auth | 登录/注册/设置/验证 | ~50 |
| chat | 聊天相关 | ~40 |
| workspace | 工作区 | ~60 |
| todos/profile/settings/billing | 各功能模块 | ~70 |
| api | API 响应消息 | ~180 |
| metadata | 页面 title/description | ~15 |
| error | 全局错误页 | ~5 |
| **合计** | | **~585** |

---

## 实施步骤

### Phase 1: 基础设施搭建

**新建文件**：
- `src/i18n/request.ts` — next-intl 配置（从 Cookie 读取 locale）
- `src/lib/i18n-api.ts` — API 层翻译辅助函数
- `src/hooks/useLocaleSwitch.ts` — 语言切换 hook（设置 Cookie + router.refresh）
- `messages/zh.json` — 中文翻译完整文件
- `messages/en.json` — 英文翻译完整文件

**修改文件**：
- `next.config.ts` — 添加 next-intl 插件配置
- `package.json` — 添加 `next-intl` 依赖
- `src/app/layout.tsx` — 包裹 `NextIntlClientProvider`，动态 `html lang`，`generateMetadata` 国际化
- `src/components/layout/ThemeRegistry.tsx` — 接收 locale prop，动态设置 `ConfigProvider` 的 `locale`

**关键实现**：

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'zh';
  const validLocale = ['zh', 'en'].includes(locale) ? locale : 'zh';
  return {
    locale: validLocale,
    messages: (await import(`../../messages/${validLocale}.json`)).default,
  };
});
```

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "better-sqlite3", "bcrypt"],
};
export default withNextIntl(nextConfig);
```

```typescript
// ThemeRegistry.tsx — Ant Design locale 同步
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
const antLocales: Record<string, any> = { zh: zhCN, en: enUS };

// ConfigProvider locale={antLocales[locale] || zhCN}
```

**验证**：安装后 `npm run build` 确认无报错，页面正常渲染。

---

### Phase 2: 布局和导航

**修改文件**（均为 Client Component）：
- `src/components/layout/Sidebar.tsx` — "Chats", "Templates", "Project Sandbox"
- `src/components/admin/AdminSidebar.tsx` — 全部菜单文本（~15 项 + 5 分组标题）
- `src/components/layout/MyAccountMenu.tsx` — "Profile", "Billing", "Sign out", "Appearance"
- `src/components/layout/NewChatButton.tsx` — "New Chat"
- `src/components/layout/ThemeToggle.tsx` — "System", "Light", "Dark"
- `src/components/layout/TodoNavLink.tsx`
- `src/components/layout/ProjectsPanel.tsx`
- `src/components/layout/WorkspacesPanel.tsx`
- `src/components/layout/TemplatesPanel.tsx`
- `src/components/layout/ChatsHistoryPanel.tsx`

**改造模式**：所有硬编码文本替换为 `useTranslations('sidebar')` / `useTranslations('common')` 调用。

---

### Phase 3: Auth 页面

**修改文件**：
- `src/app/(auth)/login/page.tsx` — ~20 处文本
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/setup/page.tsx`
- `src/app/(auth)/verify-email/page.tsx` — 含中文 "请输入 6 位数字验证码"
- `src/app/(auth)/layout.tsx`

---

### Phase 4: 用户页面

**修改文件**：
- Chat 组件（24 个文件）
- `src/app/chats/page.tsx`
- `src/app/todos/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/billing/page.tsx`
- `src/app/cli-consent/page.tsx` — 含中文 "已授权"、"授权失败"
- `src/app/error.tsx` — "页面加载失败"、"重试"

---

### Phase 5: Admin 后台（17 个组件）

**修改文件**：
- `src/components/admin/UsersPageClient.tsx` (449 行)
- `src/components/admin/ModelsPageClient.tsx`
- `src/components/admin/ModelConfigModal.tsx`
- `src/components/admin/McpPageClient.tsx`
- `src/components/admin/SystemPromptsPageClient.tsx`
- `src/components/admin/SandboxPageClient.tsx`
- `src/components/admin/StoragePageClient.tsx`
- `src/components/admin/EmailPageClient.tsx`
- `src/components/admin/DatabasePageClient.tsx`
- `src/components/admin/InviteCodesPageClient.tsx`
- `src/components/admin/AuthPageClient.tsx`
- `src/components/admin/PlansPageClient.tsx`
- `src/components/admin/AdminGuard.tsx`
- 对应的 page.tsx 文件

---

### Phase 6: Workspace 组件（17 个文件）

**修改文件**：
- `src/components/workspace/WorkspaceDetail.tsx`
- `src/components/workspace/WorkspaceMcpPanel.tsx` — 含中英混合
- `src/components/workspace/WorkspaceSkillsPanel.tsx`
- `src/components/workspace/WorkspaceMemberManager.tsx`
- `src/components/workspace/WorkspaceActivityPanel.tsx`
- `src/components/workspace/WorkspaceSandboxManager.tsx`
- 其他 Workspace 组件

---

### Phase 7: API 层（96 个路由）

**策略**：创建 `src/lib/i18n-api.ts` 辅助函数，API 路由中通过 `cookies()` 读取 locale 后返回对应语言的错误/成功消息。

**涉及路由**（含硬编码消息的 83 个路由文件）：
- `src/app/api/auth/**` — 认证相关
- `src/app/api/models/**` — 模型配置
- `src/app/api/storage-config/**` — 含中文错误消息
- `src/app/api/templates/**` — 含中文 "系统模板不可修改"
- `src/app/api/fs/**` — 含中文 "缺少 projectId 参数"
- 其他所有 `/api/` 路由

**Zod 验证消息**（80 处）：使用 Zod 的 `errorMap` 或在 schema 中指定翻译 key。

---

### Phase 8: Ant Design locale + 最终验证

- 确认 Ant Design 内置组件中英切换（分页、日期、空数据、Modal 按钮等）
- 移除组件中手写的 `locale={{ emptyText: ... }}`
- 全量回归测试

---

## 关键代码模式

### Client Component 改造

```typescript
// 改造前
<span>Sign out</span>

// 改造后
const t = useTranslations('sidebar');
<span>{t('signOut')}</span>
```

### Server Component（generateMetadata）

```typescript
const t = await getTranslations('metadata');
return { title: `${brandName} - ${t('docManagement')}` };
```

### API 路由

```typescript
// 改造前
return NextResponse.json({ error: "User not found" }, { status: 404 });

// 改造后
const t = await getApiT();
return NextResponse.json({ error: t('userNotFound') }, { status: 404 });
```

### 语言切换

```typescript
const { switchLocale, isPending } = useLocaleSwitch();
// 设置 Cookie NEXT_LOCALE + router.refresh()
```

---

## 风险和注意事项

1. **next-intl 4.x 与 Next.js 16.2.6 兼容性** — Phase 1 需先做 smoke test
2. **Ant Design ConfigProvider locale 切换** — 语言变更时可能触发组件重渲染，通过 `router.refresh()` 整页刷新规避
3. **Zod 验证消息** — 默认错误消息是英文，需自定义 `errorMap` 或在 schema 中指定 message
4. **中英混合代码** — 当前约 20+ 处中文硬编码需统一归入翻译系统
5. **Share 公共页面** — 无需登录，也需从 Cookie 读取语言偏好
6. **默认语言**：首次访问无 Cookie 时默认中文（`'zh'`），与当前 `lang="zh-CN"` 一致

## 预估工作量

| 阶段 | 时间 | 说明 |
|------|------|------|
| Phase 1 基础设施 | 2-3 天 | 核心，后续阶段依赖 |
| Phase 2 布局导航 | 1-2 天 | 10 个组件 |
| Phase 3 Auth 页面 | 1-2 天 | 5 个页面 |
| Phase 4 用户页面 | 2-3 天 | Chat + 多个页面 |
| Phase 5 Admin 后台 | 3-4 天 | 17 个组件 |
| Phase 6 Workspace | 2-3 天 | 17 个组件 |
| Phase 7 API 层 | 3-4 天 | 83 个路由 |
| Phase 8 验证 | 0.5 天 | 回归测试 |
| **合计** | **15-22 天** | Phase 2-7 可在 Phase 1 后并行 |
