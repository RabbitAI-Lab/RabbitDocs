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
  getSetting,
  getBrandName,
} from "@/lib/auth/settings";
import { getAppUrl } from "@/lib/auth/env";
import {
  sendVerificationEmail,
  generateVerificationCode,
  isSmtpConfigured,
  getTransporter,
  getFromAddress,
} from "@/lib/auth/mail";
import { getApiT } from "@/lib/i18n-api";
import { createSystemKey } from "@/lib/auth/api-key";

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
    if (!(await isOpenRegistration())) {
      return NextResponse.json(
        { error: t('api.auth.registrationClosed') },
        { status: 403 }
      );
    }

    // Determine whether either credential was supplied
    const hasGeneralKey = await isValidGeneralRegistrationKey(generalKey);
    const hasInviteCode = !!inviteCode;

    // 邀请码要求检查：通用秘钥可作为邀请码的替代
    const requireCode = await isInviteCodeRequired();
    if (requireCode && !hasInviteCode && !hasGeneralKey) {
      return NextResponse.json(
        { error: t('api.auth.inviteCodeOrKeyRequired') },
        { status: 400 }
      );
    }

    // 验证邀请码
    if (hasInviteCode) {
      const [codeRow] = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, inviteCode!));

      if (!codeRow || codeRow.usedById) {
        return NextResponse.json(
          { error: t('api.auth.invalidInviteCode') },
          { status: 400 }
        );
      }
    }

    // 检查邮箱唯一性
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

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

    await db.insert(users)
      .values({
        id: userId,
        email,
        passwordHash,
        name: name || null,
        emailVerified: false,
        accountType: "personal",
        createdAt: now,
        updatedAt: now,
      });

    // 自动创建 MCP API Key
    await createSystemKey(userId);

    // 异步通知管理员有新用户注册（不阻塞响应）
    sendRegistrationNotification({
      userEmail: email,
      userName: name || null,
      userId,
    }).catch((err) => {
      console.error("[auth] Failed to send registration notification:", err);
    });

    // 认领邀请码（原子操作）—— 通用秘钥可重复使用，不需标记
    if (hasInviteCode) {
      await db.update(inviteCodes)
        .set({ usedById: userId, usedAt: now })
        .where(eq(inviteCodes.code, inviteCode!));
    }

    // 创建邮箱验证令牌（含 6 位数字验证码）
    const verificationToken = crypto.randomUUID();
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.insert(emailVerifications)
      .values({
        id: crypto.randomUUID(),
        userId,
        token: verificationToken,
        code: verificationCode,
        expiresAt,
        createdAt: now,
      });

    // 发送验证邮件（未配置 SMTP 时 mail.ts 内部回退到控制台输出）
    const smtpEnabled = await isSmtpConfigured();
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
    const verifyUrl = `${await getAppUrl()}/verify-email?token=${verificationToken}`;

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

/**
 * 异步发送新用户注册通知邮件给管理员
 */
async function sendRegistrationNotification(data: {
  userEmail: string;
  userName: string | null;
  userId: string;
}) {
  // 检查是否启用了注册通知
  const enabled = (await getSetting("notify_admin_on_registration")) === "true";
  if (!enabled) return;

  const transporter = await getTransporter();
  if (!transporter) return;

  const adminEmail =
    (await getSetting("admin_email")) ||
    (await getSetting("smtp_from_email")) ||
    (await getSetting("smtp_user"));
  if (!adminEmail) return;

  const brandName = await getBrandName();
  const displayName = data.userName || data.userEmail;
  const now = new Date().toISOString();

  const subject = `[${brandName}] New User Registration`;
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333;margin-bottom:16px">New User Registered</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#888;width:120px">User:</td><td style="padding:8px 0">${displayName}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Email:</td><td style="padding:8px 0">${data.userEmail}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Time:</td><td style="padding:8px 0">${now}</td></tr>
      </table>
      <p style="color:#999;font-size:12px;margin-top:24px">This email was sent automatically by ${brandName}.</p>
    </div>
  `;

  await transporter.sendMail({
    from: await getFromAddress(),
    to: adminEmail,
    subject,
    html,
  });
}
