import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSubscriptions, plans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { AuthUser } from "./session";

interface PlanFeature {
  name: string;
  included: boolean;
}

/**
 * 模糊匹配 feature key：精确匹配优先，不匹配时做 case-insensitive 的包含匹配
 * 例如 key="workspace" 可匹配 "workspace"、"5 workspaces"、"Support Workspaces" 等
 */
function matchFeatureKey(featureName: string, key: string): boolean {
  if (featureName === key) return true;
  return featureName.toLowerCase().includes(key.toLowerCase());
}

/**
 * 检查用户是否拥有指定功能权限（纯逻辑判断，不返回 HTTP 响应）
 *
 * 逻辑：
 * 1. 查询用户活跃订阅（status=active）
 * 2. join plans 表获取 features JSON
 * 3. 解析 features，检查是否存在匹配 featureKey 的条目 && included === true
 * 4. 额外防护：plan 被禁用 或 订阅已过期 → 不通过
 */
export function hasFeature(userId: string, featureKey: string): boolean {
  const subscription = db
    .select({
      planFeatures: plans.features,
      planEnabled: plans.enabled,
      expiresAt: userSubscriptions.expiresAt,
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, "active"),
    ))
    .get();

  // 无活跃订阅
  if (!subscription) return false;

  // plan 被禁用
  if (subscription.planEnabled !== 1) return false;

  // 订阅过期（双重保险）
  if (new Date(subscription.expiresAt) < new Date()) return false;

  // 解析 features JSON
  let features: PlanFeature[] = [];
  try {
    features = JSON.parse(subscription.planFeatures || "[]");
  } catch {
    return false;
  }

  return features.some(f => matchFeatureKey(f.name, featureKey) && f.included === true);
}

/**
 * 获取用户已启用的所有功能 key 列表
 */
export function getUserFeatures(userId: string): string[] {
  const subscription = db
    .select({
      planFeatures: plans.features,
      planEnabled: plans.enabled,
      expiresAt: userSubscriptions.expiresAt,
    })
    .from(userSubscriptions)
    .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, "active"),
    ))
    .get();

  if (!subscription) return [];
  if (subscription.planEnabled !== 1) return [];
  if (new Date(subscription.expiresAt) < new Date()) return [];

  let features: PlanFeature[] = [];
  try {
    features = JSON.parse(subscription.planFeatures || "[]");
  } catch {
    return [];
  }

  return features.filter(f => f.included).map(f => f.name);
}

/**
 * 获取系统中所有已定义的 feature name（去重），用于 admin 用户
 */
export function getAllFeatureNames(): string[] {
  const allPlans = db
    .select({ features: plans.features })
    .from(plans)
    .all();

  const nameSet = new Set<string>();
  for (const plan of allPlans) {
    let features: PlanFeature[] = [];
    try {
      features = JSON.parse(plan.features || "[]");
    } catch {
      continue;
    }
    for (const f of features) {
      if (f.name) nameSet.add(f.name);
    }
  }

  return Array.from(nameSet);
}

/**
 * API 路由守卫：要求用户拥有指定功能，否则返回 403
 *
 * 典型用法:
 *   const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
 *   const featureErr = requireFeature(auth, "workspace");
 *   if (featureErr) return featureErr;
 */
export function requireFeature(
  auth: AuthUser,
  featureKey: string,
): NextResponse | null {
  // admin 跳过检查
  if (auth.isAdmin) return null;

  const allowed = hasFeature(auth.id, featureKey);
  if (allowed) return null;

  return NextResponse.json(
    { error: "Feature not available in your current plan", featureKey, upgradeRequired: true },
    { status: 403 },
  );
}
