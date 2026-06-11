import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { sandboxApplications, users } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/admin/sandbox-applications - 获取所有沙箱申请列表
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const t = await getApiT();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const conditions = [];
  if (status && status !== "all") {
    conditions.push(eq(sandboxApplications.status, status as "pending" | "approved" | "rejected"));
  }

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sandboxApplications)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  const total = countResult[0]?.count || 0;

  // 查询列表
  const items = await db
    .select({
      id: sandboxApplications.id,
      userId: sandboxApplications.userId,
      status: sandboxApplications.status,
      sandboxUrl: sandboxApplications.sandboxUrl,
      reason: sandboxApplications.reason,
      reviewedBy: sandboxApplications.reviewedBy,
      reviewedAt: sandboxApplications.reviewedAt,
      reviewNote: sandboxApplications.reviewNote,
      createdAt: sandboxApplications.createdAt,
      updatedAt: sandboxApplications.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(sandboxApplications)
    .leftJoin(users, eq(sandboxApplications.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sandboxApplications.createdAt))
    .limit(pageSize)
    .offset(offset);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
