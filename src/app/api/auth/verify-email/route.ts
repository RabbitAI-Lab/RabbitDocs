import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "api.auth.verificationCodeRequired");

/**
 * GET /api/auth/verify-email?token=<uuid>     — 来自邮件链接
 * GET /api/auth/verify-email?code=<6digits>   — 用户手动输入验证码
 */
export async function GET(req: NextRequest) {
  const t = await getApiT();
  return handleVerify(req.nextUrl.searchParams, t);
}

/**
 * POST /api/auth/verify-email  body: { code: "123456" }
 * 方便无法把验证码放 query 的客户端（如某些移动 WebView）
 */
export async function POST(req: NextRequest) {
  const t = await getApiT();
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = codeSchema.safeParse(body?.code);
    if (!parsed.success) {
      return NextResponse.json(
        { error: t(parsed.error.issues[0].message) },
        { status: 400 }
      );
    }
    return handleVerify({ get: (k: string) => (k === "code" ? parsed.data : null) }, t);
  } catch (error) {
    console.error("[auth] Verify email error:", error);
    return NextResponse.json(
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}

function handleVerify(
  searchParams: URLSearchParams | { get: (k: string) => string | null },
  t: (key: string, params?: Record<string, string | number>) => string
) {
  try {
    const token = searchParams.get("token");
    const code = searchParams.get("code");

    if (!token && !code) {
      return NextResponse.json(
        { error: t('api.auth.tokenOrCodeRequired') },
        { status: 400 }
      );
    }

    // 构造查询：先按 token 或 code 查
    const where = token
      ? eq(emailVerifications.token, token)
      : eq(emailVerifications.code, code!);

    const verification = db
      .select()
      .from(emailVerifications)
      .where(where)
      .get();

    if (!verification) {
      return NextResponse.json(
        { error: t('api.auth.invalidOrExpiredToken') },
        { status: 400 }
      );
    }

    if (new Date(verification.expiresAt) < new Date()) {
      // 清理过期记录
      db.delete(emailVerifications)
        .where(eq(emailVerifications.userId, verification.userId))
        .run();
      return NextResponse.json(
        { error: t('api.auth.tokenExpired') },
        { status: 400 }
      );
    }

    // 标记邮箱已验证 + 删除该用户的所有验证令牌
    db.transaction(() => {
      db.update(users)
        .set({ emailVerified: 1, updatedAt: new Date().toISOString() })
        .where(eq(users.id, verification.userId))
        .run();

      db.delete(emailVerifications)
        .where(eq(emailVerifications.userId, verification.userId))
        .run();
    });

    return NextResponse.json({
      success: true,
      message: t('api.auth.emailVerified'),
    });
  } catch (error) {
    console.error("[auth] Verify email error:", error);
    return NextResponse.json(
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}
