import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, inviteCodes, emailVerifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
// generateTokenPair — kept for future token-on-registration feature
// import { generateTokenPair } from "@/lib/auth/tokens";
import {
  isOpenRegistration,
  isInviteCodeRequired,
  isValidGeneralRegistrationKey,
} from "@/lib/auth/settings";
import { getAppUrl } from "@/lib/auth/env";
import {
  sendVerificationEmail,
  generateVerificationCode,
  isSmtpConfigured,
} from "@/lib/auth/mail";
import { getApiT } from "@/lib/i18n-api";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().max(50).optional(),
  inviteCode: z.string().optional(),
  generalKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const t = await getApiT();
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name, inviteCode, generalKey } = parsed.data;

    // 检查注册是否开放
    if (!isOpenRegistration()) {
      return NextResponse.json(
        { error: t('api.auth.registrationClosed') },
        { status: 403 }
      );
    }

    // Determine whether either credential was supplied
    const hasGeneralKey = isValidGeneralRegistrationKey(generalKey);
    const hasInviteCode = !!inviteCode;

    // 邀请码要求检查：通用秘钥可作为邀请码的替代
    const requireCode = isInviteCodeRequired();
    if (requireCode && !hasInviteCode && !hasGeneralKey) {
      return NextResponse.json(
        { error: t('api.auth.inviteCodeOrKeyRequired') },
        { status: 400 }
      );
    }

    // 验证邀请码
    if (hasInviteCode) {
      const codeRow = db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, inviteCode!))
        .get();

      if (!codeRow || codeRow.usedById) {
        return NextResponse.json(
          { error: t('api.auth.invalidInviteCode') },
          { status: 400 }
        );
      }
    }

    // 检查邮箱唯一性
    const existingUser = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existingUser) {
      return NextResponse.json(
        { error: t('api.auth.emailAlreadyRegistered') },
        { status: 409 }
      );
    }

    // 创建用户
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    db.insert(users)
      .values({
        id: userId,
        email,
        passwordHash,
        name: name || null,
        emailVerified: 0,
        accountType: "personal",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 认领邀请码（原子操作）—— 通用秘钥可重复使用，不需标记
    if (hasInviteCode) {
      db.update(inviteCodes)
        .set({ usedById: userId, usedAt: now })
        .where(eq(inviteCodes.code, inviteCode!))
        .run();
    }

    // 创建邮箱验证令牌（含 6 位数字验证码）
    const verificationToken = crypto.randomUUID();
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.insert(emailVerifications)
      .values({
        id: crypto.randomUUID(),
        userId,
        token: verificationToken,
        code: verificationCode,
        expiresAt,
        createdAt: now,
      })
      .run();

    // 发送验证邮件（未配置 SMTP 时 mail.ts 内部回退到控制台输出）
    const smtpEnabled = isSmtpConfigured();
    try {
      await sendVerificationEmail(email, verificationToken, verificationCode);
    } catch (error) {
      // 邮件发送失败不应阻塞注册，但需要日志告警
      console.error(
        `[auth] Failed to send verification email to ${email}:`,
        error
      );
    }

    // SMTP 未配置时，把验证链接与验证码直接返回给前端，方便本地开发
    const verifyUrl = `${getAppUrl()}/verify-email?token=${verificationToken}`;

    return NextResponse.json({
      message: t('api.auth.registrationSuccess'),
      ...(smtpEnabled
        ? {}
        : {
            verificationUrl: verifyUrl,
            verificationCode,
            devHint: t('api.auth.smtpNotConfigured'),
          }),
    });
  } catch (error) {
    console.error("[auth] Registration error:", error);
    return NextResponse.json(
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}
