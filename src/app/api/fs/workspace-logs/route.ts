import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { operationLogs } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/fs/workspace-logs?projectId={workspaceId}&category=xxx&page=1&pageSize=20
// 注意：复用 operation_logs 表，projectId 参数实际是 workspaceId
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  if (!projectId) {
    return NextResponse.json({ error: t('api.projectIdRequired') }, { status: 400 });
  }

  const conditions = [eq(operationLogs.projectId, projectId)];
  if (category) {
    conditions.push(eq(operationLogs.category, category as "repository" | "sandbox" | "skills" | "mcp" | "member"));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const logs = db.select()
    .from(operationLogs)
    .where(whereClause)
    .orderBy(desc(operationLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const countResult = db.select({ count: sql<number>`count(*)` })
    .from(operationLogs)
    .where(whereClause)
    .get();

  const total = countResult?.count ?? 0;

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize,
  });
}
