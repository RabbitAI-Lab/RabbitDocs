import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminUserId } from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";

const updateUserSchema = z.object({
  name: z.string().max(50).optional(),
  emailVerified: z.boolean().optional(),
  disabled: z.boolean().optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const { id: userId } = await params;

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) {
      return NextResponse.json({ error: t('api.auth.userNotFound') }, { status: 404 });
    }

    // 禁止禁用系统超级管理员
    const adminId = getAdminUserId();
    if (adminId && adminId === userId && parsed.data.disabled === true) {
      return NextResponse.json(
        { error: t('api.auth.admin.cannotDisableSystemAdmin') },
        { status: 400 }
      );
    }

    // 禁止管理员移除自己的管理员角色
    if (parsed.data.role && authResult.id === userId) {
      return NextResponse.json(
        { error: t('api.auth.admin.cannotChangeOwnRole') },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.emailVerified !== undefined) {
      updates.emailVerified = parsed.data.emailVerified ? 1 : 0;
    }
    if (parsed.data.disabled !== undefined) {
      updates.disabled = parsed.data.disabled ? 1 : 0;
    }
    if (parsed.data.role !== undefined) {
      updates.role = parsed.data.role;
    }

    db.update(users).set(updates).where(eq(users.id, userId)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth] Admin update user error:", error);
    return NextResponse.json({ error: t('api.internalError') }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const { id: userId } = await params;

    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) {
      return NextResponse.json({ error: t('api.auth.userNotFound') }, { status: 404 });
    }

    const adminId = getAdminUserId();
    if (adminId && adminId === userId) {
      return NextResponse.json(
        { error: t('api.auth.admin.cannotDisableSystemAdmin') },
        { status: 400 }
      );
    }

    db.update(users)
      .set({ disabled: 1, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .run();

    return NextResponse.json({ success: true, message: t('api.auth.admin.userDisabled') });
  } catch (error) {
    console.error("[auth] Admin disable user error:", error);
    return NextResponse.json({ error: t('api.internalError') }, { status: 500 });
  }
}
