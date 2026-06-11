import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { users, userSubscriptions, plans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { createPlanChangedNotification } from "@/lib/payment/notification";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  planId: z.number().int().positive(),
  billingCycle: z.enum(["monthly", "yearly"]),
});

// POST /api/admin/user-usage/[userId]/subscribe — 管理员为用户开通/变更套餐
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;

  // 验证用户存在
  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId));

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 验证请求体
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
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (plan.enabled !== true) {
    return NextResponse.json({ error: "Plan is disabled" }, { status: 400 });
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
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, "active"),
    ));

  // 如果已有活跃订阅，取消旧的
  if (current) {
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
      userId,
      planId,
      billingCycle,
      status: "active",
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      provider: "admin",
      paymentMode: "subscription",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

  // 套餐变更通知（仅变更，首次开通不触发）
  if (current) {
    const [oldPlan] = await db.select({ title: plans.title }).from(plans).where(eq(plans.id, current.planId)).limit(1);
    createPlanChangedNotification(userId, {
      oldPlanTitle: oldPlan?.title || "Unknown",
      newPlanTitle: plan.title,
      newBillingCycle: billingCycle,
      newExpiresAt: expiresAt.toISOString(),
      changedBy: "admin",
    }).catch(err => console.error("[plan-changed-notification]", err));
  }

  return NextResponse.json(
    {
      success: true,
      subscription: {
        id,
        planId,
        planTitle: plan.title,
        billingCycle,
        status: "active",
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        provider: "admin",
      },
    },
    { status: 201 },
  );
}
