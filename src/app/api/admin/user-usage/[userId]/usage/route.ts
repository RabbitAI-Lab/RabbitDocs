import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { users, userSubscriptions, plans, tokenUsageLogs } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/admin/user-usage/[userId]/usage — 管理员查看指定用户 token 用量详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;

  // 查询用户是否存在
  const [targetUser] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 查询活跃订阅
  const [subscription] = await db
    .select({
      id: userSubscriptions.id,
      planId: userSubscriptions.planId,
      billingCycle: userSubscriptions.billingCycle,
      status: userSubscriptions.status,
      startedAt: userSubscriptions.startedAt,
      expiresAt: userSubscriptions.expiresAt,
      planTitle: plans.title,
      planEnabled: plans.enabled,
      tokenLimitMonthly: plans.tokenLimitMonthly,
      tokenLimitYearly: plans.tokenLimitYearly,
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, "active"),
    ));

  if (!subscription) {
    // 无订阅：仍然返回用户信息和汇总的 token 使用量（无配额信息）
    const [totalUsage] = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
        inputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
        outputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
        cacheCreationTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.cacheCreationInputTokens}), 0)`,
        cacheReadTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.cacheReadInputTokens}), 0)`,
        requestCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(tokenUsageLogs)
      .where(eq(tokenUsageLogs.userId, userId));

    return NextResponse.json({
      user: targetUser,
      subscription: null,
      quota: null,
      breakdown: {
        inputTokens: totalUsage?.inputTokens || 0,
        outputTokens: totalUsage?.outputTokens || 0,
        cacheCreationTokens: totalUsage?.cacheCreationTokens || 0,
        cacheReadTokens: totalUsage?.cacheReadTokens || 0,
      },
      requestCount: totalUsage?.requestCount || 0,
      allTimeTokens: totalUsage?.totalTokens || 0,
    });
  }

  // 确定配额
  const tokenLimit = subscription.billingCycle === "monthly"
    ? subscription.tokenLimitMonthly
    : subscription.tokenLimitYearly;

  const periodStart = subscription.startedAt;

  // 查询本周期用量
  const [usageRow] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
      inputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
      cacheCreationTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.cacheCreationInputTokens}), 0)`,
      cacheReadTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.cacheReadInputTokens}), 0)`,
      requestCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(tokenUsageLogs)
    .where(and(
      eq(tokenUsageLogs.userId, userId),
      gte(tokenUsageLogs.createdAt, periodStart),
    ));

  const used = usageRow?.totalTokens || 0;
  const unlimited = tokenLimit === 0;
  const remaining = unlimited ? Infinity : Math.max(0, tokenLimit - used);
  const percentage = unlimited || tokenLimit === 0
    ? Math.min(used / 100000 * 100, 100)
    : Math.min(Math.round((used / tokenLimit) * 10000) / 100, 100);

  return NextResponse.json({
    user: targetUser,
    subscription: {
      id: subscription.id,
      planId: subscription.planId,
      planTitle: subscription.planTitle,
      billingCycle: subscription.billingCycle,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
    },
    quota: {
      limit: tokenLimit,
      used,
      remaining,
      percentage,
      periodStart,
      unlimited,
    },
    breakdown: {
      inputTokens: usageRow?.inputTokens || 0,
      outputTokens: usageRow?.outputTokens || 0,
      cacheCreationTokens: usageRow?.cacheCreationTokens || 0,
      cacheReadTokens: usageRow?.cacheReadTokens || 0,
    },
    requestCount: usageRow?.requestCount || 0,
  });
}
