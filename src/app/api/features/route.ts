import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getUserFeatures, getAllFeatureNames } from "@/lib/auth/feature-gate";

export const dynamic = "force-dynamic";

// GET /api/features — 返回当前用户已启用的功能 key 列表
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // admin 用户拥有所有已定义的功能
  if (auth.isAdmin) {
    const allFeatures = getAllFeatureNames();
    return NextResponse.json({ features: allFeatures });
  }

  // 普通用户：查订阅 → 过滤 included 的 feature names
  const features = getUserFeatures(auth.id);
  return NextResponse.json({ features });
}
