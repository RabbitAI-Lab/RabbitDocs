# 新用户注册通知管理员邮件功能

## Context

系统管理员需要及时了解新用户注册情况。当前注册流程中没有任何通知机制，管理员只能主动查看用户列表。本功能在系统设置页面新增一个开关 `notifyAdminOnRegistration`，开启后每次有新用户注册都会异步发送邮件通知管理员。

**无需数据库 migration**——复用现有 `systemSettings` 表的 key-value 模式，新增 key `notify_admin_on_registration`。

## 修改文件清单

| 文件 | 修改类型 |
|------|---------|
| `src/components/admin/SettingsPageClient.tsx` | 修改 |
| `src/app/api/auth/admin/system-settings/route.ts` | 修改 |
| `src/app/api/auth/register/route.ts` | 修改 |
| `messages/en.json` | 修改 |
| `messages/zh.json` | 修改 |

---

## Task 1: API 层 — 设置读写

**文件**: `src/app/api/auth/admin/system-settings/route.ts`

1. `updateSettingsSchema` 添加字段:
   ```typescript
   notifyAdminOnRegistration: z.boolean().optional(),
   ```
2. GET 返回值添加:
   ```typescript
   notifyAdminOnRegistration: (await getSetting("notify_admin_on_registration")) === "true",
   ```
3. PATCH 写入逻辑（与 `requireEmailVerification` 同模式）:
   ```typescript
   if (parsed.data.notifyAdminOnRegistration !== undefined) {
     updates.push({ key: "notify_admin_on_registration", value: parsed.data.notifyAdminOnRegistration ? "true" : "false" });
   }
   ```

## Task 2: 前端 — SettingsPageClient

**文件**: `src/components/admin/SettingsPageClient.tsx`

1. `SystemSettings` 接口添加 `notifyAdminOnRegistration: boolean`
2. `dirty` 检查添加该字段比较
3. `handleSave` payload 添加该字段
4. 在 `cardRegVerification` Card 中的 `requireEmailVerification` SettingRow 后面添加新的 SettingRow:
   ```tsx
   <Divider className="my-4" />
   <SettingRow
     title={t('notifyAdminOnRegTitle')}
     description={t('notifyAdminOnRegDesc')}
     value={draft.notifyAdminOnRegistration}
     onChange={(v) => update("notifyAdminOnRegistration", v)}
     current={settings.notifyAdminOnRegistration}
   />
   ```
5. （可选）在 `cardCurrentConfig` 中添加状态标签

## Task 3: 注册路由 — 触发邮件通知

**文件**: `src/app/api/auth/register/route.ts`

1. 新增 import: `getTransporter`, `getFromAddress` from `@/lib/auth/mail`; `getBrandName` from `@/lib/auth/settings`
2. 用户创建成功后（第 110 行之后），异步调用通知函数（fire-and-forget，不阻塞响应）:
   ```typescript
   sendRegistrationNotification({ userEmail: email, userName: name || null, userId })
     .catch((err) => console.error("[auth] Failed to send registration notification:", err));
   ```
3. 文件末尾新增 `sendRegistrationNotification` 函数，参考 `sendFeedbackNotification` 模式:
   - 检查 `notify_admin_on_registration` 设置是否开启
   - 检查 SMTP 和管理员邮箱是否可用
   - 构造邮件（包含用户名、邮箱、注册时间）
   - 发送到管理员邮箱

## Task 4: i18n 翻译

**en.json** (`admin.authSettingsPage` 内):
```json
"notifyAdminOnRegTitle": "Notify Admin on Registration",
"notifyAdminOnRegDesc": "When enabled, an email notification will be sent to the administrator when a new user registers. Requires SMTP to be configured.",
"labelNotifyAdminOn": "Admin Notification"
```

**zh.json** (`admin.authSettingsPage` 内):
```json
"notifyAdminOnRegTitle": "注册通知管理员",
"notifyAdminOnRegDesc": "开启后，新用户注册时将发送邮件通知管理员。需要已配置 SMTP 邮件服务。",
"labelNotifyAdminOn": "管理员通知"
```

## 验证方式

1. 启动 dev server，进入系统管理 → 系统设置页面
2. 确认 "注册通知管理员" 开关出现在 "注册与验证" 卡片中
3. 开启开关并保存，刷新页面确认状态持久化
4. 配置 SMTP 后，注册一个新用户，检查管理员邮箱是否收到通知邮件
5. 关闭开关后注册用户，确认不再收到通知邮件
6. 未配置 SMTP 或管理员邮箱时，注册流程不受影响（静默跳过通知）
