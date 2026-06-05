import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { getApiT } from "@/lib/i18n-api";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const t = await getApiT();
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    // 获取当前密码哈希
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, authResult.id))
      .get();

    if (!user) {
      return NextResponse.json({ error: t('api.auth.userNotFound') }, { status: 404 });
    }

    // 验证旧密码
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: t('api.auth.currentPasswordIncorrect') },
        { status: 400 }
      );
    }

    // 更新密码
    const newHash = await hashPassword(newPassword);
    db.update(users)
      .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, authResult.id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth] Change password error:", error);
    return NextResponse.json({ error: t('api.internalError') }, { status: 500 });
  }
}
