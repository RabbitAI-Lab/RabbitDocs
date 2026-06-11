import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userSubscriptions, plans, orders } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getApiT } from "@/lib/i18n-api";
import { createPlanChangedNotification } from "@/lib/payment/notification";

export const dynamic = "force-dynamic";

// GET /api/subscriptions — 获取当前用户活跃订阅
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;

  const [subscription] = await db
    .select({
      id: userSubscriptions.id,
      planId: userSubscriptions.planId,
      billingCycle: userSubscriptions.billingCycle,
      status: userSubscriptions.status,
      startedAt: userSubscriptions.startedAt,
      expiresAt: userSubscriptions.expiresAt,
      createdAt: userSubscriptions.createdAt,
      provider: userSubscriptions.provider,
      providerCustomerId: userSubscriptions.providerCustomerId,
      planTitle: plans.title,
      planDescription: plans.description,
      planPrices: plans.prices,
      planFeatures: plans.features,
      planDefaultCurrency: plans.defaultCurrency,
      planSortOrder: plans.sortOrder,
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, auth.id),
      eq(userSubscriptions.status, "active"),
    ));

  return NextResponse.json({ subscription: subscription ?? null });
}

const subscribeSchema = z.object({
  planId: z.number().int().positive(),
  billingCycle: z.enum(["monthly", "yearly"]),
});

// POST /api/subscriptions — 订阅或升级套餐
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();

  const body = await req.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { planId, billingCycle } = parsed.data;

  // 验证 Plan 存在且启用
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!plan || plan.enabled !== true) {
    return NextResponse.json(
      { error: t('api.subscriptions.planNotFoundOrDisabled') },
      { status: 404 },
    );
  }

  // 计算价格（与 checkout route 保持一致）
  const prices = JSON.parse(plan.prices || "[]");
  const priceEntry = prices.find((p: { currency: string }) => p.currency === plan.defaultCurrency) || prices[0];

  const originalAmount = priceEntry
    ? (billingCycle === "monthly"
        ? (priceEntry.monthlyPrice || 0) * 100
        : (priceEntry.yearlyPrice || 0) * 100)
    : 0;

  let discountAmount = 0;
  let amount = originalAmount;
  if (plan.discountType === "percentage" && plan.discountValue > 0) {
    discountAmount = Math.round(originalAmount * (1 - plan.discountValue / 1000));
    amount = originalAmount - discountAmount;
  } else if (plan.discountType === "fixed" && plan.discountValue > 0) {
    discountAmount = plan.discountValue;
    amount = Math.max(0, originalAmount - discountAmount);
  }

  const now = new Date();
  const expiresAt = new Date(now);
  if (billingCycle === "monthly") {
    expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }

  // 查询当前活跃订阅
  const [current] = await db
    .select()
    .from(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, auth.id),
      eq(userSubscriptions.status, "active"),
    ));

  if (current) {
    if (current.planId === planId && current.billingCycle === billingCycle) {
      return NextResponse.json(
        { error: t('api.subscriptions.alreadySubscribed') },
        { status: 400 },
      );
    }
    // 升级/降级：取消旧订阅
    await db.update(userSubscriptions)
      .set({
        status: "cancelled",
        cancelledAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .where(eq(userSubscriptions.id, current.id));
  }

  // 创建新订阅
  const id = crypto.randomUUID();
  await db.insert(userSubscriptions)
    .values({
      id,
      userId: auth.id,
      planId,
      billingCycle,
      status: "active",
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

  // 创建 order 记录，使得免费订阅也出现在 Payment History 中
  const orderId = uuidv4();
  const billingMode = (plan.billingMode as "subscription" | "one_time") || "subscription";
  await db.insert(orders).values({
    id: orderId,
    userId: auth.id,
    planId: plan.id,
    subscriptionId: id,
    amount,
    currency: plan.defaultCurrency || "CNY",
    originalAmount,
    discountAmount,
    billingCycle,
    paymentMode: billingMode,
    provider: "system",
    status: "paid",
    paidAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  // 套餐变更通知（仅升级/降级，首次订阅不触发）
  if (current) {
    const [oldPlan] = await db.select({ title: plans.title }).from(plans).where(eq(plans.id, current.planId)).limit(1);
    createPlanChangedNotification(auth.id, {
      oldPlanTitle: oldPlan?.title || "Unknown",
      newPlanTitle: plan.title,
      newBillingCycle: billingCycle,
      newExpiresAt: expiresAt.toISOString(),
      changedBy: "user",
    }).catch(err => console.error("[plan-changed-notification]", err));
  }

  return NextResponse.json(
    { subscription: { id, planId, billingCycle, status: "active", startedAt: now.toISOString(), expiresAt: expiresAt.toISOString() } },
    { status: 201 },
  );
}
