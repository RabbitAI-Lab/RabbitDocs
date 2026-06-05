import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { requireAdmin } from "@/lib/auth/session";
import {
  getGeneralRegistrationKey,
  setGeneralRegistrationKey,
} from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";

const updateSchema = z.object({
  key: z.string().min(4).max(64).optional(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/auth/general-registration-key
 * Returns whether a general key is configured and a masked preview.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const key = getGeneralRegistrationKey();
  const enabled = !!key && key.length > 0;

  return NextResponse.json({
    enabled,
    // For security, never return the full key once set — only a masked preview.
    // Use POST to rotate/replace the key.
    maskedKey: enabled ? maskKey(key!) : null,
  });
}

/**
 * POST /api/auth/general-registration-key
 * Body: { key?: string, enabled?: boolean }
 * - If `key` is provided, replaces the current key.
 * - If `enabled === false`, clears the key.
 * - Otherwise generates a new random key.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { key, enabled } = parsed.data;

    if (enabled === false) {
      setGeneralRegistrationKey(null);
      return NextResponse.json({ enabled: false, key: null });
    }

    const newKey = key && key.length >= 4 ? key : generateKey();
    setGeneralRegistrationKey(newKey);
    // Only return the full key once (right after generation/rotation).
    return NextResponse.json({ enabled: true, key: newKey });
  } catch (error) {
    console.error("[auth] General registration key error:", error);
    return NextResponse.json(
      { error: t('api.internalError') },
      { status: 500 }
    );
  }
}

function generateKey(): string {
  // 12-char alphanumeric, easy to type and share
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  // Format as 4-char groups for readability: XXXX-XXXX-XXXX
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

function maskKey(key: string): string {
  if (key.length <= 4) return "****";
  const visible = key.slice(-4);
  return `${"*".repeat(Math.max(4, key.length - 4))}${visible}`;
}
