// ── 通知调度器 ──
// 定时扫描 notification_jobs 表，发送到期的通知邮件

import { db } from "@/db";
import { notificationJobs, userSubscriptions, users } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { renderTemplate, getTransporter, getFromAddress } from "@/lib/auth/mail";
import { getBrandName } from "@/lib/auth/settings";
import { getAppUrl } from "@/lib/auth/env";
import { getRenewalReminderDays, getCheckoutTimeoutHours } from "./config";

const MAX_ATTEMPTS = 3;

// ── 邮件模板 ──

const EMAIL_TEMPLATES: Record<string, { subject: string; html: string }> = {
  order_pending: {
    subject: "{{brandName}} - Order Pending Payment",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Payment Required</h2>
      <p style="color:#555;line-height:1.6">Your order for <strong>{{planTitle}}</strong> is waiting for payment.</p>
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:600">Amount: {{currency}} {{amount}}</p>
        <p style="margin:4px 0 0;color:#666">Billing Cycle: {{billingCycle}}</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="{{checkoutUrl}}" style="display:inline-block;padding:12px 32px;background:#1677ff;color:white;text-decoration:none;border-radius:6px;font-weight:500">Complete Payment</a>
      </div>
      <p style="color:#999;font-size:12px">This order will expire in 24 hours.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  order_pending_reminder: {
    subject: "{{brandName}} - Payment Reminder ({{reminderNumber}}/{{totalReminders}})",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#e67e22">Payment Reminder</h2>
      <p style="color:#555;line-height:1.6">Your order for <strong>{{planTitle}}</strong> is still pending payment.</p>
      <div style="background:#fef3e2;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:600">Amount: {{currency}} {{amount}}</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="{{checkoutUrl}}" style="display:inline-block;padding:12px 32px;background:#e67e22;color:white;text-decoration:none;border-radius:6px;font-weight:500">Pay Now</a>
      </div>
      <p style="color:#999;font-size:12px">This order will expire soon. Please complete payment to avoid cancellation.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  order_paid: {
    subject: "{{brandName}} - Payment Confirmation",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Payment Successful</h2>
      <p style="color:#555;line-height:1.6">You have successfully subscribed to <strong>{{planTitle}}</strong>.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:600">Amount: {{currency}} {{amount}}</p>
        <p style="margin:4px 0 0;color:#666">Billing Cycle: {{billingCycle}}</p>
        <p style="margin:4px 0 0;color:#666">Valid Until: {{expiresAt}}</p>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  order_failed: {
    subject: "{{brandName}} - Payment Failed",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#e74c3c">Payment Failed</h2>
      <p style="color:#555;line-height:1.6">Your payment for <strong>{{planTitle}}</strong> was not successful.</p>
      <div style="background:#fde8e8;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:600">Amount: {{currency}} {{amount}}</p>
      </div>
      <p style="color:#555">Please try again or contact support if the issue persists.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  subscription_renewal_upcoming: {
    subject: "{{brandName}} - Upcoming Renewal",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Subscription Renewal Reminder</h2>
      <p style="color:#555;line-height:1.6">Your subscription to <strong>{{planTitle}}</strong> will renew on {{renewalDate}}.</p>
      <div style="background:#e3f2fd;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;color:#666">Renewal Amount: {{currency}} {{amount}}</p>
        <p style="margin:4px 0 0;color:#666">Billing Cycle: {{billingCycle}}</p>
      </div>
      <p style="color:#555">If you wish to cancel, you can do so before the renewal date.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="{{cancelUrl}}" style="display:inline-block;padding:10px 24px;background:#999;color:white;text-decoration:none;border-radius:6px">Manage Subscription</a>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  subscription_renewed: {
    subject: "{{brandName}} - Renewal Confirmation",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Subscription Renewed</h2>
      <p style="color:#555;line-height:1.6">Your subscription to <strong>{{planTitle}}</strong> has been renewed.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;color:#666">New Expiry: {{newExpiresAt}}</p>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  refund_requested_admin: {
    subject: "{{brandName}} - New Refund Request",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#e67e22">New Refund Request</h2>
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0"><strong>User:</strong> {{userName}} ({{userEmail}})</p>
        <p style="margin:4px 0 0"><strong>Amount:</strong> {{currency}} {{amount}}</p>
        <p style="margin:4px 0 0"><strong>Reason:</strong> {{reason}}</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="{{reviewUrl}}" style="display:inline-block;padding:12px 32px;background:#1677ff;color:white;text-decoration:none;border-radius:6px;font-weight:500">Review Request</a>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  refund_approved: {
    subject: "{{brandName}} - Refund Approved",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Refund Approved</h2>
      <p style="color:#555;line-height:1.6">Your refund request has been approved.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:600">Refund Amount: {{currency}} {{amount}}</p>
      </div>
      <p style="color:#555">The refund will be processed to your original payment method within 5-10 business days.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  refund_completed: {
    subject: "{{brandName}} - Refund Completed",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Refund Completed</h2>
      <p style="color:#555;line-height:1.6">Your refund has been processed.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:600">Refund Amount: {{currency}} {{amount}}</p>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  refund_rejected: {
    subject: "{{brandName}} - Refund Request Rejected",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#e74c3c">Refund Request Rejected</h2>
      <p style="color:#555;line-height:1.6">Your refund request has been rejected.</p>
      <div style="background:#fde8e8;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0"><strong>Amount:</strong> {{currency}} {{amount}}</p>
        <p style="margin:4px 0 0"><strong>Reason:</strong> {{reason}}</p>
      </div>
      <p style="color:#555">If you have questions, please contact support.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  token_top_up: {
    subject: "{{brandName}} - Token Top-Up Successful",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Token Top-Up Successful</h2>
      <p style="color:#555;line-height:1.6">Your account has been credited with additional tokens.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:600">Tokens Added: {{tokens}}</p>
        <p style="margin:4px 0 0;color:#666">Reason: {{reasonLabel}}</p>
        {{noteBlock}}
        <p style="margin:4px 0 0;color:#666">Valid Until: {{expiresAt}}</p>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  plan_changed: {
    subject: "{{brandName}} - Your Plan Has Been Updated",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Plan Updated</h2>
      <p style="color:#555;line-height:1.6">Your subscription plan has been updated.</p>
      <div style="background:#e3f2fd;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;color:#666"><strong>Previous Plan:</strong> {{oldPlanTitle}}</p>
        <p style="margin:4px 0 0"><strong>New Plan:</strong> {{newPlanTitle}}</p>
        <p style="margin:4px 0 0;color:#666">Billing Cycle: {{billingCycle}}</p>
        <p style="margin:4px 0 0;color:#666">Valid Until: {{expiresAt}}</p>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  sandbox_applied_admin: {
    subject: "{{brandName}} - New Sandbox Application",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#e67e22">New Sandbox Application</h2>
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0"><strong>User:</strong> {{userName}} ({{userEmail}})</p>
        <p style="margin:4px 0 0"><strong>Reason:</strong> {{reason}}</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="{{reviewUrl}}" style="display:inline-block;padding:12px 32px;background:#1677ff;color:white;text-decoration:none;border-radius:6px;font-weight:500">Review Application</a>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  sandbox_approved: {
    subject: "{{brandName}} - Sandbox Application Approved",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333">Sandbox Application Approved</h2>
      <p style="color:#555;line-height:1.6">Your sandbox application has been approved.</p>
      <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0"><strong>Sandbox URL:</strong> <a href="{{sandboxUrl}}">{{sandboxUrl}}</a></p>
      </div>
      <p style="color:#555">You can now access your sandbox environment through the Project Sandbox page.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
  sandbox_rejected: {
    subject: "{{brandName}} - Sandbox Application Rejected",
    html: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#e74c3c">Sandbox Application Rejected</h2>
      <p style="color:#555;line-height:1.6">Your sandbox application has been rejected.</p>
      <div style="background:#fde8e8;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0"><strong>Reason:</strong> {{reviewNote}}</p>
      </div>
      <p style="color:#555">If you have questions, please contact support.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#bbb;font-size:11px;text-align:center">{{brandName}}</p>
    </div>`,
  },
};

// ── 发送单条通知 ──

async function sendNotification(job: typeof notificationJobs.$inferSelect): Promise<boolean> {
  const template = EMAIL_TEMPLATES[job.type];
  if (!template) {
    console.warn(`[notification] No template for type: ${job.type}`);
    return false;
  }

  const transporter = await getTransporter();
  if (!transporter) {
    console.log(`[notification] SMTP not configured, skipping: ${job.type}`);
    return false;
  }

  const data = JSON.parse(job.data || "{}");
  data.brandName = data.brandName || await getBrandName();
  data.appUrl = data.appUrl || await getAppUrl();

  const subject = renderTemplate(template.subject, data);
  const html = renderTemplate(template.html, data);

  try {
    await transporter.sendMail({
      from: await getFromAddress(),
      to: job.email,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error(`[notification] Failed to send to ${job.email}:`, error);
    throw error;
  }
}

// ── 调度器核心 ──

async function processPendingNotifications() {
  const now = new Date().toISOString();
  const jobs = await db
    .select()
    .from(notificationJobs)
    .where(and(
      eq(notificationJobs.status, "pending"),
      lte(notificationJobs.scheduledAt, now),
    ))
    .limit(50);

  for (const job of jobs) {
    try {
      const success = await sendNotification(job);
      if (success) {
        await db.update(notificationJobs)
          .set({ status: "sent", sentAt: new Date().toISOString() })
          .where(eq(notificationJobs.id, job.id));
      }
    } catch (error) {
      const attempts = job.attempts + 1;
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      await db.update(notificationJobs)
        .set({
          attempts,
          lastError: errMsg,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        })
        .where(eq(notificationJobs.id, job.id));
    }
  }
}

// ── 兜底：确保活跃订阅都有续费预告 ──

async function ensureRenewalReminders() {
  const reminderDays = await getRenewalReminderDays();
  const now = new Date();

  // 查询所有活跃的订阅制订阅
  const activeSubs = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.status, "active"));

  for (const sub of activeSubs) {
    if (!sub.expiresAt) continue;

    const expiresDate = new Date(sub.expiresAt);
    const reminderDate = new Date(expiresDate.getTime() - reminderDays * 24 * 3600 * 1000);

    // 只关注 7 天内需要创建预告的
    if (reminderDate > new Date(now.getTime() + 7 * 24 * 3600 * 1000)) continue;
    if (reminderDate < now) continue; // 已过期

    // 检查是否已有预告任务
    const [existing] = await db
      .select()
      .from(notificationJobs)
      .where(and(
        eq(notificationJobs.subscriptionId, sub.id),
        eq(notificationJobs.type, "subscription_renewal_upcoming"),
        eq(notificationJobs.status, "pending"),
      ))
      .limit(1);

    if (!existing) {
      const [user] = await db.select().from(users).where(eq(users.id, sub.userId)).limit(1);
      if (!user) continue;

      const { plans } = await import("@/db/schema");
      const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);

      const appUrl = await getAppUrl();
      // 直接插入
      await db.insert(notificationJobs).values({
        type: "subscription_renewal_upcoming",
        subscriptionId: sub.id,
        userId: sub.userId,
        email: user.email,
        data: JSON.stringify({
          planTitle: plan?.title || "",
          renewalDate: expiresDate.toISOString().split("T")[0],
          cancelUrl: `${appUrl}/billing`,
          brandName: await getBrandName(),
        }),
        status: "pending",
        scheduledAt: reminderDate.toISOString(),
        createdAt: now.toISOString(),
      });
    }
  }
}

// ── 过期未支付订单清理 ──

async function expireStaleOrders() {
  const timeoutHours = await getCheckoutTimeoutHours();
  const cutoff = new Date(Date.now() - timeoutHours * 3600 * 1000).toISOString();
  const { orders } = await import("@/db/schema");

  await db.update(orders)
    .set({ status: "cancelled", cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(
      eq(orders.status, "pending"),
      lte(orders.createdAt, cutoff),
    ));

  // 同时 skip 超期的催付通知
  await db.update(notificationJobs)
    .set({ status: "skipped" as const })
    .where(and(
      eq(notificationJobs.status, "pending"),
      eq(notificationJobs.type, "order_pending_reminder"),
    ));
}

// ── 启动调度器 ──

let schedulerStarted = false;

export function startNotificationScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log("[notification-scheduler] Starting...");

  // 立即执行一次
  setTimeout(async () => {
    try {
      await processPendingNotifications();
      await ensureRenewalReminders();
      await expireStaleOrders();
    } catch (err) {
      console.error("[notification-scheduler] Initial run error:", err);
    }
  }, 5000);

  // 每 60 秒执行一次
  setInterval(async () => {
    try {
      await processPendingNotifications();
    } catch (err) {
      console.error("[notification-scheduler] Error:", err);
    }
  }, 60_000);

  // 每 6 小时执行一次兜底任务
  setInterval(async () => {
    try {
      await ensureRenewalReminders();
      await expireStaleOrders();
    } catch (err) {
      console.error("[notification-scheduler] Maintenance error:", err);
    }
  }, 6 * 3600 * 1000);
}
