import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userSubscriptions, plans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET /api/subscriptions — 获取当前用户活跃订阅
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;

  const subscription = db
    .select({
      id: userSubscriptions.id,
      planId: userSubscriptions.planId,
      billingCycle: userSubscriptions.billingCycle,
      status: userSubscriptions.status,
      startedAt: userSubscriptions.startedAt,
      expiresAt: userSubscriptions.expiresAt,
      createdAt: userSubscriptions.createdAt,
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
    ))
    .get();

  return NextResponse.json({ subscription: subscription ?? null });
}

const subscribeSchema = z.object({
  planId: z.number().int().positive(),
  billingCycle: z.enum(["monthly", "yearly"]),
});

// POST /api/subscriptions — 订阅或升级套餐
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;

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
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan || plan.enabled !== 1) {
    return NextResponse.json(
      { error: "Plan not found or disabled" },
      { status: 404 },
    );
  }

  const now = new Date();
  const expiresAt = new Date(now);
  if (billingCycle === "monthly") {
    expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }

  // 查询当前活跃订阅
  const current = db
    .select()
    .from(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, auth.id),
      eq(userSubscriptions.status, "active"),
    ))
    .get();

  if (current) {
    if (current.planId === planId && current.billingCycle === billingCycle) {
      return NextResponse.json(
        { error: "Already subscribed to this plan" },
        { status: 400 },
      );
    }
    // 升级/降级：取消旧订阅
    db.update(userSubscriptions)
      .set({
        status: "cancelled",
        cancelledAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .where(eq(userSubscriptions.id, current.id))
      .run();
  }

  // 创建新订阅
  const id = crypto.randomUUID();
  db.insert(userSubscriptions)
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
    })
    .run();

  return NextResponse.json(
    { subscription: { id, planId, billingCycle, status: "active", startedAt: now.toISOString(), expiresAt: expiresAt.toISOString() } },
    { status: 201 },
  );
}
