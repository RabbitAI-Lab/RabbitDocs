import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { testSmtpConnection } from "@/lib/auth/mail";
import { getApiT } from "@/lib/i18n-api";

const testSmtpSchema = z.object({
  toEmail: z.string().email().max(254),
});

/**
 * POST /api/auth/admin/system-settings/test-smtp
 *
 * Send a test email using the currently configured SMTP settings
 * (read from system_settings, with env var fallback).
 *
 * Always returns HTTP 200 with `{ success, message }`; the success flag
 * is in the body so the UI can show the SMTP server's actual error.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = testSmtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await testSmtpConnection(parsed.data.toEmail);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[auth] test-smtp error:", error);
    return NextResponse.json(
      { success: false, message: t('api.internalError') },
      { status: 500 }
    );
  }
}
