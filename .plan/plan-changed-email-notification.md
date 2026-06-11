# 套餐变更邮件通知实现方案

## Context

当前系统中套餐变更（用户自助升级/降级、管理员手动变更）是唯一没有邮件通知的环节。已有的通知覆盖了：待支付、催付、支付成功/失败、续费预告、续费成功、退款全流程、Token充值、沙箱审批等，但套餐变更本身没有通知用户。

需要为两种场景添加 `plan_changed` 邮件通知：
- 用户自助变更套餐（billing 页面）
- 管理员在后台手动变更用户套餐

## 修改清单

### Task 1: schema.ts — 添加 `plan_changed` enum 值
- **文件**: `src/db/schema.ts` (第 461 行 `"sandbox_rejected"` 之后)
- 在 `notificationJobs.type` enum 数组中添加 `"plan_changed"`
- 注意：PGlite 使用 `text` 类型 + 应用层 enum，不需要数据库 migration

### Task 2: scheduler.ts — 添加 `plan_changed` 邮件模板
- **文件**: `src/lib/payment/scheduler.ts` (第 175 行 `token_top_up` 模板之后，`};` 之前)
- 新增 `plan_changed` 模板，包含：旧套餐名、新套餐名、计费周期、到期时间
- 邮件默认文案为英文

### Task 3: notification.ts — 添加 `createPlanChangedNotification()` 函数
- **文件**: `src/lib/payment/notification.ts` (文件末尾追加)
- 参数：userId, data(旧套餐名/新套餐名/新计费周期/新到期时间/操作来源)
- 内部查询用户邮箱、格式化数据、调用 `createNotificationJob`

### Task 4: 用户自助变更入口集成
- **文件**: `src/app/api/subscriptions/route.ts` (第 163 行 order insert 之后、return 之前)
- 添加 import `createPlanChangedNotification`
- 仅当 `current`（旧订阅）存在时触发通知，首次订阅不触发
- fire-and-forget 调用（.catch），不影响主流程

### Task 5: 管理员手动变更入口集成
- **文件**: `src/app/api/admin/user-usage/[userId]/subscribe/route.ts` (第 100 行 insert 之后、return 之前)
- 添加 import `createPlanChangedNotification`
- 仅当 `current`（旧订阅）存在时触发通知
- fire-and-forget 调用

## 验证方式
1. 启动开发服务器 `pnpm dev`
2. 用管理员账号在后台为某用户变更套餐，确认 `notification_jobs` 表中生成 `plan_changed` 类型的 pending 记录
3. 配置 SMTP 后，确认邮件正确发送并包含旧/新套餐信息
4. 确认首次开通套餐（无旧订阅）不触发 `plan_changed` 通知
