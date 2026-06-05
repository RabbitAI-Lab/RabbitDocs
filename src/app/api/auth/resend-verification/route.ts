import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, emailVerifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  sendVerificationEmail,
  generateVerificationCode,
} from "@/lib/auth/mail";
import { getApiT } from "@/lib/i18n-api";

const resendSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const t = await getApiT();
  try {
    const body = await req.json();
    const parsed = resendSchema.safeParse(body);

    if (!parsed.success) {
      // 防止邮箱枚举，始终返回成功
      return NextResponse.json({
        message: t('api.auth.resendVerificationMessage'),
      });
    }

    const { email } = parsed.data;

    // 查找用户
    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    // 防止枚举：无论用户是否存在，都返回相同消息
    if (!user || user.emailVerified === 1) {
      return NextResponse.json({
        message: t('api.auth.resendVerificationMessage'),
      });
    }

    // 删除旧的验证令牌
    db.delete(emailVerifications)
      .where(eq(emailVerifications.userId, user.id))
      .run();

    // 创建新令牌（含 6 位数字验证码）
    const token = crypto.randomUUID();
    const code = generateVerificationCode();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.insert(emailVerifications)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        token,
        code,
        expiresAt,
        createdAt: now,
      })
      .run();

    // 发送邮件（SMTP 未配置时 mail.ts 内部回退到控制台输出）
    try {
      await sendVerificationEmail(email, token, code);
    } catch (error) {
      console.error(
        `[auth] Failed to resend verification email to ${email}:`,
        error
      );
    }

    return NextResponse.json({
      message: t('api.auth.resendVerificationMessage'),
    });
  } catch (error) {
    console.error("[auth] Resend verification error:", error);
    // 即使出错也返回成功，防止信息泄露
    return NextResponse.json({
      message: t('api.auth.resendVerificationMessage'),
    });
  }
}
