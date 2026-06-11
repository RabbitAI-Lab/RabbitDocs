// ── 订单通知服务 ──
// 创建各类通知任务到 notification_jobs 队列表

import { db } from "@/db";
import { notificationJobs, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getPendingReminderIntervalHours,
  getPendingReminderMaxCount,
  getRenewalReminderDays,
  getRefundAdminEmails,
} from "./config";
import { getBrandName } from "@/lib/auth/settings";
import { getAppUrl } from "@/lib/auth/env";

// ── 创建通知任务 ──

async function createNotificationJob(params: {
  type: string;
  orderId?: string;
  subscriptionId?: string;
  userId: string;
  email: string;
  data: Record<string, string>;
  scheduledAt: string;
}) {
  const now = new Date().toISOString();
  await db.insert(notificationJobs).values({
    type: params.type as "order_pending",
    orderId: params.orderId || null,
    subscriptionId: params.subscriptionId || null,
    userId: params.userId,
    email: params.email,
    data: JSON.stringify(params.data),
    status: "pending",
    scheduledAt: params.scheduledAt,
    createdAt: now,
  });
}

// ── 订单待支付通知 (1条即时 + N条催付) ──

export async function createOrderPendingNotifications(
  orderId: string,
  userId: string,
  userEmail: string,
  data: { planTitle: string; amount: string; currency: string; billingCycle: string; checkoutUrl: string }
) {
  const now = new Date();
  const intervalHours = await getPendingReminderIntervalHours();
  const maxCount = await getPendingReminderMaxCount();
  const brandName = await getBrandName();
  const appUrl = await getAppUrl();

  // 1. 即时通知
  await createNotificationJob({
    type: "order_pending",
    orderId,
    userId,
    email: userEmail,
    data: { ...data, brandName, appUrl },
    scheduledAt: now.toISOString(),
  });

  // 2. 催付通知（间隔 N 小时，最多 maxCount 条）
  for (let i = 1; i <= maxCount; i++) {
    const scheduledAt = new Date(now.getTime() + i * intervalHours * 3600 * 1000);
    await createNotificationJob({
      type: "order_pending_reminder",
      orderId,
      userId,
      email: userEmail,
      data: {
        ...data,
        brandName,
        appUrl,
        reminderNumber: String(i),
        totalReminders: String(maxCount),
      },
      scheduledAt: scheduledAt.toISOString(),
    });
  }
}

// ── 支付成功通知 ──

export async function createOrderPaidNotifications(
  orderId: string,
  userId: string,
  data: { planTitle: string; amount: string; currency: string; billingCycle: string; expiresAt: string; paymentMode: string },
  providerSubscriptionId?: string,
  expiresAt?: string
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const brandName = await getBrandName();
  const appUrl = await getAppUrl();

  // 1. 支付成功通知
  await createNotificationJob({
    type: "order_paid",
    orderId,
    userId,
    email: user.email,
    data: { ...data, brandName, appUrl },
    scheduledAt: new Date().toISOString(),
  });

  // 2. 如果是订阅制，创建续费预告任务
  if (data.paymentMode === "subscription" && expiresAt) {
    const reminderDays = await getRenewalReminderDays();
    const expiresDate = new Date(expiresAt);
    const reminderDate = new Date(expiresDate.getTime() - reminderDays * 24 * 3600 * 1000);

    // 只有预告时间在未来才创建
    if (reminderDate > new Date()) {
      await createNotificationJob({
        type: "subscription_renewal_upcoming",
        subscriptionId: providerSubscriptionId,
        orderId,
        userId,
        email: user.email,
        data: {
          planTitle: data.planTitle,
          renewalDate: expiresDate.toISOString().split("T")[0],
          amount: data.amount,
          currency: data.currency,
          billingCycle: data.billingCycle,
          cancelUrl: `${appUrl}/billing`,
          brandName,
        },
        scheduledAt: reminderDate.toISOString(),
      });
    }
  }
}

// ── 支付失败通知 ──

export async function createOrderFailedNotification(
  orderId: string,
  userId: string,
  data: { planTitle: string; amount: string; currency: string }
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  await createNotificationJob({
    type: "order_failed",
    orderId,
    userId,
    email: user.email,
    data: { ...data, brandName: await getBrandName() },
    scheduledAt: new Date().toISOString(),
  });
}

// ── 续费成功通知 + 下次预告 ──

export async function createSubscriptionRenewedNotifications(
  subscriptionId: string,
  userId: string,
  data: { planTitle: string; newExpiresAt: string },
  nextExpiresAt: string
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const brandName = await getBrandName();
  const appUrl = await getAppUrl();

  // 1. 续费成功通知
  await createNotificationJob({
    type: "subscription_renewed",
    subscriptionId,
    userId,
    email: user.email,
    data: { ...data, brandName, appUrl },
    scheduledAt: new Date().toISOString(),
  });

  // 2. 为下一周期创建续费预告
  const reminderDays = await getRenewalReminderDays();
  const nextExpires = new Date(nextExpiresAt);
  const reminderDate = new Date(nextExpires.getTime() - reminderDays * 24 * 3600 * 1000);

  if (reminderDate > new Date()) {
    await createNotificationJob({
      type: "subscription_renewal_upcoming",
      subscriptionId,
      userId,
      email: user.email,
      data: {
        planTitle: data.planTitle,
        renewalDate: nextExpires.toISOString().split("T")[0],
        cancelUrl: `${appUrl}/billing`,
        brandName,
      },
      scheduledAt: reminderDate.toISOString(),
    });
  }
}

// ── 退款申请通知管理员 ──

export async function createRefundRequestedNotifications(
  refundId: string,
  orderId: string,
  userId: string,
  data: { userName: string; userEmail: string; amount: string; currency: string; reason: string }
) {
  const adminEmails = await getRefundAdminEmails();
  const brandName = await getBrandName();
  const appUrl = await getAppUrl();
  const now = new Date().toISOString();

  for (const email of adminEmails) {
    await createNotificationJob({
      type: "refund_requested_admin",
      orderId,
      userId,
      email,
      data: {
        ...data,
        brandName,
        reviewUrl: `${appUrl}/admin/orders`,
      },
      scheduledAt: now,
    });
  }
}

// ── 退款状态变更通知用户 ──

export async function createRefundStatusNotification(
  userId: string,
  orderId: string,
  type: "refund_approved" | "refund_completed" | "refund_rejected",
  data: { amount: string; currency: string; reason?: string }
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  await createNotificationJob({
    type,
    orderId,
    userId,
    email: user.email,
    data: { ...data, brandName: await getBrandName() },
    scheduledAt: new Date().toISOString(),
  });
}

// ── 取消催付通知 ──

export async function cancelPendingReminders(orderId: string) {
  const { eq: eqOp } = await import("drizzle-orm");
  await db.update(notificationJobs)
    .set({ status: "skipped" as const })
    .where(and(
      eqOp(notificationJobs.orderId, orderId),
      eqOp(notificationJobs.type, "order_pending_reminder"),
      eqOp(notificationJobs.status, "pending"),
    ));
}

// ── 取消续费预告 ──

export async function cancelRenewalReminders(subscriptionId: string) {
  const { eq: eqOp } = await import("drizzle-orm");
  await db.update(notificationJobs)
    .set({ status: "skipped" as const })
    .where(and(
      eqOp(notificationJobs.subscriptionId, subscriptionId),
      eqOp(notificationJobs.type, "subscription_renewal_upcoming"),
      eqOp(notificationJobs.status, "pending"),
    ));
}

// ── Token 充值通知 ──

const TOKEN_TOP_UP_REASON_LABELS: Record<string, string> = {
  system_gift: "System Gift",
  promotion: "Promotional Bonus",
  compensation: "Compensation",
  manual: "Manual Top-Up",
};

export async function createTokenTopUpNotification(
  userId: string,
  data: {
    tokens: number;
    reason: string;
    note?: string | null;
    expiresAt: string;
  }
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const tokensFormatted = data.tokens.toLocaleString();
  const reasonLabel = TOKEN_TOP_UP_REASON_LABELS[data.reason] || data.reason;
  const noteBlock = data.note
    ? `<p style="margin:4px 0 0;color:#666">Note: ${data.note}</p>`
    : "";
  const expiresAtFormatted = new Date(data.expiresAt).toISOString().split("T")[0];

  await createNotificationJob({
    type: "token_top_up",
    userId,
    email: user.email,
    data: {
      tokens: tokensFormatted,
      reasonLabel,
      noteBlock,
      expiresAt: expiresAtFormatted,
      brandName: await getBrandName(),
    },
    scheduledAt: new Date().toISOString(),
  });
}

// ── 沙箱申请通知管理员 ──

export async function createSandboxAppliedAdminNotification(
  userId: string,
  data: { userName: string; userEmail: string; reason: string }
) {
  const adminEmails = await getRefundAdminEmails();
  const brandName = await getBrandName();
  const appUrl = await getAppUrl();
  const now = new Date().toISOString();

  for (const email of adminEmails) {
    await createNotificationJob({
      type: "sandbox_applied_admin",
      userId,
      email,
      data: {
        ...data,
        brandName,
        reviewUrl: `${appUrl}/admin/sandbox-applications`,
      },
      scheduledAt: now,
    });
  }
}

// ── 沙箱审批状态通知用户 ──

export async function createSandboxStatusNotification(
  userId: string,
  type: "sandbox_approved" | "sandbox_rejected",
  data: { sandboxUrl: string; reviewNote: string }
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  await createNotificationJob({
    type,
    userId,
    email: user.email,
    data: { ...data, brandName: await getBrandName() },
    scheduledAt: new Date().toISOString(),
  });
}

// ── 套餐变更通知 ──

export async function createPlanChangedNotification(
  userId: string,
  data: {
    oldPlanTitle: string;
    newPlanTitle: string;
    newBillingCycle: string;
    newExpiresAt: string;
    changedBy: "user" | "admin";
  }
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const newExpiresAtFormatted = new Date(data.newExpiresAt).toISOString().split("T")[0];
  const billingCycleLabel =
    data.newBillingCycle === "monthly" ? "Monthly" : "Yearly";

  await createNotificationJob({
    type: "plan_changed",
    userId,
    email: user.email,
    data: {
      oldPlanTitle: data.oldPlanTitle,
      newPlanTitle: data.newPlanTitle,
      billingCycle: billingCycleLabel,
      expiresAt: newExpiresAtFormatted,
      changedBy: data.changedBy,
      brandName: await getBrandName(),
    },
    scheduledAt: new Date().toISOString(),
  });
}
