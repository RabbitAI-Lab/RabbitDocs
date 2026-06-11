import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { sandboxApplications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// PATCH /api/admin/sandbox-applications/[id] - 审批沙箱申请
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { id } = await params;

  const body = await req.json();
  const { status, sandboxUrl, reviewNote } = body as {
    status: "approved" | "rejected";
    sandboxUrl?: string;
    reviewNote?: string;
  };

  if (!status || !["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: t('api.sandbox.invalidStatus') },
      { status: 400 }
    );
  }

  // 审批通过时 sandboxUrl 必填
  if (status === "approved" && (!sandboxUrl || !sandboxUrl.trim())) {
    return NextResponse.json(
      { error: t('api.sandbox.sandboxUrlRequired') },
      { status: 400 }
    );
  }

  // 查询申请记录
  const [existing] = await db
    .select()
    .from(sandboxApplications)
    .where(eq(sandboxApplications.id, parseInt(id, 10)))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: t('api.sandbox.applicationNotFound') },
      { status: 404 }
    );
  }

  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: t('api.sandbox.alreadyReviewed') },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // 更新申请记录
  await db
    .update(sandboxApplications)
    .set({
      status,
      sandboxUrl: status === "approved" ? (sandboxUrl || "").trim() : null,
      reviewedBy: auth.id,
      reviewedAt: now,
      reviewNote: reviewNote || null,
      updatedAt: now,
    })
    .where(eq(sandboxApplications.id, existing.id));

  // 异步通知用户
  notifyUser(existing.userId, status, sandboxUrl, reviewNote).catch((err) =>
    console.error("[sandbox] Failed to notify user:", err)
  );

  const [updated] = await db
    .select()
    .from(sandboxApplications)
    .where(eq(sandboxApplications.id, existing.id))
    .limit(1);

  return NextResponse.json({ application: updated });
}

async function notifyUser(
  userId: string,
  status: "approved" | "rejected",
  sandboxUrl?: string,
  reviewNote?: string
) {
  const { createSandboxStatusNotification } = await import(
    "@/lib/payment/notification"
  );
  await createSandboxStatusNotification(
    userId,
    status === "approved" ? "sandbox_approved" : "sandbox_rejected",
    {
      sandboxUrl: sandboxUrl || "",
      reviewNote: reviewNote || "",
    }
  );
}
