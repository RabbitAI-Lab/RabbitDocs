import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { sandboxApplications } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/sandbox-applications - 查询当前用户的所有沙箱申请
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const applications = await db
    .select()
    .from(sandboxApplications)
    .where(eq(sandboxApplications.userId, auth.id))
    .orderBy(desc(sandboxApplications.createdAt));

  return NextResponse.json({ applications });
}

// POST /api/sandbox-applications - 提交新的沙箱申请
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const t = await getApiT();

  const body = await req.json();
  const { reason } = body as { reason?: string };

  // 检查是否有 pending 状态的申请
  const pendingList = await db
    .select()
    .from(sandboxApplications)
    .where(and(
      eq(sandboxApplications.userId, auth.id),
      eq(sandboxApplications.status, "pending")
    ))
    .limit(1);

  if (pendingList.length > 0) {
    return NextResponse.json(
      { error: t('api.sandbox.alreadyApplied') },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // 直接创建新申请
  const [application] = await db
    .insert(sandboxApplications)
    .values({
      userId: auth.id,
      status: "pending",
      reason: reason || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // 异步通知管理员
  notifyAdmins(auth.id, auth.name || auth.email, auth.email, reason).catch(
    (err) => console.error("[sandbox] Failed to notify admins:", err)
  );

  return NextResponse.json({ application });
}

// PATCH /api/sandbox-applications - 更新沙箱备注名/绑定
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { id, remark, bindEntityId } = body as { id: number; remark?: string; bindEntityId?: string | null };

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // 确认记录属于当前用户
  const [existing] = await db
    .select()
    .from(sandboxApplications)
    .where(and(
      eq(sandboxApplications.id, id),
      eq(sandboxApplications.userId, auth.id)
    ))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (remark !== undefined) updates.remark = remark;
  if (bindEntityId !== undefined) updates.bindEntityId = bindEntityId;

  await db
    .update(sandboxApplications)
    .set(updates)
    .where(eq(sandboxApplications.id, id));

  return NextResponse.json({ success: true });
}

async function notifyAdmins(
  userId: string,
  userName: string,
  userEmail: string,
  reason?: string
) {
  const { createSandboxAppliedAdminNotification } = await import(
    "@/lib/payment/notification"
  );
  await createSandboxAppliedAdminNotification(userId, {
    userName,
    userEmail,
    reason: reason || "",
  });
}
