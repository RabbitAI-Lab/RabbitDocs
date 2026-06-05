import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";

export async function GET(req: NextRequest) {
  const t = await getApiT();
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // 从 DB 获取最新数据（authResult 中的数据来自 JWT 时间点）
  const row = db
    .select()
    .from(users)
    .where(eq(users.id, authResult.id))
    .get();

  if (!row) {
    return NextResponse.json({ error: t('api.auth.userNotFound') }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified === 1,
    accountType: row.accountType,
    enterpriseId: row.enterpriseId,
    positions: row.positions ? JSON.parse(row.positions) : null,
    isAdmin: isAdmin(row.id),
    createdAt: row.createdAt,
  });
}

const updateProfileSchema = z.object({
  name: z.string().max(50).optional(),
  positions: z
    .object({
      preset: z.array(z.string()).optional(),
      custom: z.array(z.string()).max(20).optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const t = await getApiT();
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updates: Record<string, string> = {};
    const now = new Date().toISOString();

    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name;
    }
    if (parsed.data.positions !== undefined) {
      updates.positions = JSON.stringify(parsed.data.positions);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: t('api.auth.noFieldsToUpdate') }, { status: 400 });
    }

    db.update(users)
      .set({ ...updates, updatedAt: now })
      .where(eq(users.id, authResult.id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth] Update profile error:", error);
    return NextResponse.json({ error: t('api.internalError') }, { status: 500 });
  }
}
