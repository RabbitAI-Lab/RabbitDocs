import nodemailer from "nodemailer";
import crypto from "crypto";
import { getSmtpConfig, getAppUrl } from "./env";
import { getSetting, getBrandName } from "./settings";

// ─── Default email templates ────────────────────────────────────────

export const DEFAULT_EMAIL_TEMPLATES = {
  verifySubject: "{{brandName}} - Verify Your Email",
  verifyHtml: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <h2 style="color:#333;margin-bottom:16px">Verify Your Email</h2>
  <p style="color:#555;line-height:1.6">Welcome to {{brandName}}! Please click the link below or enter the verification code to verify your email address:</p>
  {{codeBlock}}
  <div style="text-align:center;margin:24px 0">
    <a href="{{verifyUrl}}" style="display:inline-block;padding:12px 32px;background:#1677ff;color:white;text-decoration:none;border-radius:6px;font-weight:500">Verify Email</a>
    <p style="color:#999;font-size:12px;margin-top:12px;word-break:break-all">Or copy this link: <a href="{{verifyUrl}}" style="color:#1677ff">{{verifyUrl}}</a></p>
  </div>
  <p style="color:#999;font-size:12px;margin-top:16px;line-height:1.5">This link expires in 24 hours. If you did not request this, please ignore this email.</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
  <p style="color:#bbb;font-size:11px;text-align:center">This email was sent automatically by {{brandName}}. Please do not reply.</p>
</div>`,
};

// ─── Template helpers ───────────────────────────────────────────────

export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in vars ? vars[key] : match
  );
}

export function getCodeBlockHtml(code: string): string {
  return `<div style="margin:24px 0;padding:20px;background:#f5f5f5;border-radius:8px;text-align:center">
    <div style="font-size:13px;color:#666;margin-bottom:8px;letter-spacing:.5px">Your verification code (6 digits)</div>
    <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1677ff;font-family:'Courier New',monospace">${code}</div>
    <div style="font-size:12px;color:#999;margin-top:8px">Code expires in 24 hours</div>
  </div>
  <p style="color:#666;font-size:13px;text-align:center">You can also click the button below to verify directly:</p>`;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedConfigHash: string = "";

function configHash(cfg: SmtpConfig): string {
  return `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.pass}`;
}

function getTransporter(): nodemailer.Transporter | null {
  // 优先从系统设置读取，fallback 到环境变量
  const envConfig = getSmtpConfig();
  const settingsConfig: SmtpConfig | null = (() => {
    const host = getSetting("smtp_host");
    const user = getSetting("smtp_user");
    const pass = getSetting("smtp_pass");
    if (!host || !user || !pass) return null;
    return {
      host,
      port: parseInt(getSetting("smtp_port") || "465", 10),
      secure: getSetting("smtp_secure") !== "false",
      user,
      pass,
      fromEmail: getSetting("smtp_from_email") || `noreply@${host}`,
    };
  })();

  const config = settingsConfig || envConfig;
  if (!config) return null;

  const hash = configHash(config);
  if (cachedTransporter && cachedConfigHash === hash) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  cachedConfigHash = hash;

  return cachedTransporter;
}

function getFromAddress(): string {
  // 优先使用系统设置的 fromEmail
  const sysFrom = getSetting("smtp_from_email");
  if (sysFrom) return sysFrom;
  const sysHost = getSetting("smtp_host");
  if (sysHost) return `noreply@${sysHost}`;
  return getSmtpConfig()?.fromEmail || "noreply@chatwiki.app";
}

export function isSmtpConfigured(): boolean {
  return getTransporter() !== null;
}

/**
 * 发送邮箱验证邮件。
 *
 * @param email 收件人邮箱
 * @param token 用于一次性链接的长 token（UUID）
 * @param code  6 位数字验证码（用户在邮箱中可直接输入；可选）
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  code?: string
): Promise<void> {
  const transporter = getTransporter();
  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`;

  if (!transporter) {
    console.log(`[mail] SMTP not configured. Verify URL: ${verifyUrl}`);
    if (code) console.log(`[mail] Verify code: ${code}`);
    return;
  }

  const brandName = getBrandName();
  const subjectTpl = getSetting("email_verify_subject") || DEFAULT_EMAIL_TEMPLATES.verifySubject;
  const htmlTpl = getSetting("email_verify_html") || DEFAULT_EMAIL_TEMPLATES.verifyHtml;
  const codeBlockHtml = code ? getCodeBlockHtml(code) : "";

  const vars = {
    brandName,
    code: code || "",
    verifyUrl,
    codeBlock: codeBlockHtml,
  };
  const subject = renderTemplate(subjectTpl, vars);
  const html = renderTemplate(htmlTpl, vars);

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      html,
    });
    console.log(`[mail] Verification email sent to: ${email}`);
  } catch (error) {
    console.error("[mail] Failed to send verification email:", error);
    throw error;
  }
}

/**
 * 生成 6 位数字验证码。
 * 使用加密随机数生成；首位不为 0 便于显示。
 */
export function generateVerificationCode(): string {
  // 6 位数字，crypto.randomInt 拒绝模数偏差
  // 取 0..999999 然后格式化；为简单起见直接拼接 6 个 0-9 数字
  const digits: string[] = [];
  // Node 22 全局 crypto
  const randInt = (max: number) => crypto.randomInt(0, max);
  for (let i = 0; i < 6; i++) {
    digits.push(String(randInt(10)));
  }
  return digits.join("");
}

export async function testSmtpConnection(
  toEmail: string
): Promise<{ success: boolean; message: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, message: "SMTP not configured" };
  }

  try {
    await transporter.verify();
    const brandName = getBrandName();
    await transporter.sendMail({
      from: getFromAddress(),
      to: toEmail,
      subject: `${brandName} - SMTP Test`,
      text: "This is a test email to verify your SMTP configuration.",
    });
    return { success: true, message: "Test email sent successfully" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
