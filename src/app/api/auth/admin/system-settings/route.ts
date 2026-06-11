import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { bulkSetSettings, getSetting, setSetting } from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";
import { parseColorScheme, mergeColorScheme, type ColorScheme } from "@/lib/color-scheme";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal("transparent"));
const colorModeSchema = z.object({
  primaryBtn: hexColor.optional(),
  primaryBtnHover: hexColor.optional(),
  accent: hexColor.optional(),
  sidebarBg: hexColor.optional(),
  mainBg: hexColor.optional(),
  foreground: hexColor.optional(),
  background: hexColor.optional(),
  senderBg: hexColor.optional(),
});

const updateSettingsSchema = z.object({
  openRegistration: z.boolean().optional(),
  requireInviteCode: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  notifyAdminOnRegistration: z.boolean().optional(),
  passkeyEnabled: z.boolean().optional(),
  passkeyRpId: z.string().trim().max(253).optional(),
  passkeyRpName: z.string().trim().max(128).optional(),
  brandName: z.string().trim().max(64).optional(),
  siteUrl: z.string().trim().max(253).optional(),
  adminEmail: z.string().trim().max(254).email().optional().or(z.literal("")),
  emailTemplates: z
    .object({
      verifySubject: z.string().trim().max(500).optional(),
      verifyHtml: z.string().max(50000).optional(),
    })
    .optional(),
  smtp: z
    .object({
      host: z.string().trim().min(1).optional(),
      port: z.coerce.number().int().min(1).max(65535).optional(),
      user: z.string().trim().min(1).optional(),
      pass: z.string().optional(), // empty string = keep existing
      fromEmail: z
        .string()
        .trim()
        .max(254)
        .optional()
        .or(z.literal("")),
      secure: z.boolean().optional(),
    })
    .optional(),
  colorScheme: z
    .object({
      light: colorModeSchema.optional(),
      dark: colorModeSchema.optional(),
    })
    .optional(),
});

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  fromEmail: string;
  secure: boolean;
  hasPassword: boolean;
}

async function readSmtpConfig(): Promise<SmtpConfig | null> {
  const host = await getSetting("smtp_host");
  const user = await getSetting("smtp_user");
  const pass = await getSetting("smtp_pass");
  // 至少 host+user+pass 三个都存在才算"已配置"
  if (!host || !user || !pass) return null;
  return {
    host,
    port: parseInt((await getSetting("smtp_port")) || "465", 10),
    user,
    fromEmail: (await getSetting("smtp_from_email")) || `noreply@${host}`,
    secure: (await getSetting("smtp_secure")) !== "false",
    hasPassword: pass.length > 0,
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  return NextResponse.json({
    openRegistration: (await getSetting("open_registration")) !== "false",
    requireInviteCode: (await getSetting("require_invite_code")) === "true",
    requireEmailVerification: (await getSetting("require_email_verification")) === "true",
    notifyAdminOnRegistration: (await getSetting("notify_admin_on_registration")) === "true",
    passkeyEnabled: (await getSetting("passkey_enabled")) === "true",
    passkeyRpId: (await getSetting("passkey_rp_id")) ?? "",
    passkeyRpName: (await getSetting("passkey_rp_name")) ?? "",
    siteUrl: (await getSetting("site_url")) ?? "",
    adminEmail: (await getSetting("admin_email")) ?? "",
    brandName: (await getSetting("brand_name")) || "RabbitDocs",
    emailTemplates: {
      verifySubject: (await getSetting("email_verify_subject")) || "",
      verifyHtml: (await getSetting("email_verify_html")) || "",
    },
    smtp: await readSmtpConfig(),
    colorScheme: parseColorScheme(await getSetting("color_scheme")),
  });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updates: Array<{ key: string; value: string }> = [];
    if (parsed.data.openRegistration !== undefined) {
      updates.push({
        key: "open_registration",
        value: parsed.data.openRegistration ? "true" : "false",
      });
    }
    if (parsed.data.requireInviteCode !== undefined) {
      updates.push({
        key: "require_invite_code",
        value: parsed.data.requireInviteCode ? "true" : "false",
      });
    }
    if (parsed.data.requireEmailVerification !== undefined) {
      updates.push({
        key: "require_email_verification",
        value: parsed.data.requireEmailVerification ? "true" : "false",
      });
    }
    if (parsed.data.notifyAdminOnRegistration !== undefined) {
      updates.push({
        key: "notify_admin_on_registration",
        value: parsed.data.notifyAdminOnRegistration ? "true" : "false",
      });
    }
    if (parsed.data.passkeyEnabled !== undefined) {
      updates.push({
        key: "passkey_enabled",
        value: parsed.data.passkeyEnabled ? "true" : "false",
      });
    }
    if (parsed.data.passkeyRpId !== undefined) {
      // 空字符串视为清除（路由层会用 Host 头自动检测回退）
      updates.push({
        key: "passkey_rp_id",
        value: parsed.data.passkeyRpId,
      });
    }
    if (parsed.data.passkeyRpName !== undefined) {
      // 空字符串由路由层回退为 "RabbitDocs"
      updates.push({
        key: "passkey_rp_name",
        value: parsed.data.passkeyRpName,
      });
    }

    // Site URL
    if (parsed.data.siteUrl !== undefined) {
      updates.push({ key: "site_url", value: parsed.data.siteUrl });
    }

    // Brand name
    if (parsed.data.brandName !== undefined) {
      updates.push({ key: "brand_name", value: parsed.data.brandName });
    }

    // Admin email
    if (parsed.data.adminEmail !== undefined) {
      updates.push({ key: "admin_email", value: parsed.data.adminEmail });
    }

    // Email templates
    if (parsed.data.emailTemplates) {
      const tpl = parsed.data.emailTemplates;
      if (tpl.verifySubject !== undefined) {
        updates.push({ key: "email_verify_subject", value: tpl.verifySubject });
      }
      if (tpl.verifyHtml !== undefined) {
        updates.push({ key: "email_verify_html", value: tpl.verifyHtml });
      }
    }

    // SMTP：只把用户实际传过来的字段写入；pass 留空 = 保留旧密码
    if (parsed.data.smtp) {
      const smtp = parsed.data.smtp;
      if (smtp.host !== undefined) {
        updates.push({ key: "smtp_host", value: smtp.host });
      }
      if (smtp.port !== undefined) {
        updates.push({ key: "smtp_port", value: String(smtp.port) });
      }
      if (smtp.user !== undefined) {
        updates.push({ key: "smtp_user", value: smtp.user });
      }
      if (typeof smtp.pass === "string" && smtp.pass.length > 0) {
        updates.push({ key: "smtp_pass", value: smtp.pass });
      }
      if (smtp.fromEmail !== undefined) {
        // 允许空字符串（视为使用默认 noreply@host）
        updates.push({ key: "smtp_from_email", value: smtp.fromEmail });
      }
      if (smtp.secure !== undefined) {
        updates.push({
          key: "smtp_secure",
          value: smtp.secure ? "true" : "false",
        });
      }
    }

    // Color scheme
    if (parsed.data.colorScheme) {
      const existingRaw = await getSetting("color_scheme");
      const existing = existingRaw ? parseColorScheme(existingRaw) : null;
      const merged = mergeColorScheme(existing, parsed.data.colorScheme as Partial<ColorScheme>);
      await setSetting("color_scheme", JSON.stringify(merged));
    }

    if (updates.length > 0) {
      await bulkSetSettings(updates);
    }

    return NextResponse.json({ success: true, updated: updates.length + (parsed.data.colorScheme ? 1 : 0) });
  } catch (error) {
    console.error("[auth] Update system settings error:", error);
    return NextResponse.json({ error: t('api.internalError') }, { status: 500 });
  }
}
