import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { getSaTokenConfig } from "@/lib/auth/sa-token";
import { setSetting } from "@/lib/auth/settings";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const config = getSaTokenConfig();
  return NextResponse.json({
    enabled: config.enabled,
    endpoint: config.endpoint,
    secretkey: config.secretkey ? "***" : "",
    timeout: config.timeout,
  });
}

const configSchema = z.object({
  enabled: z.boolean().optional(),
  endpoint: z.string().url().optional().or(z.literal("")),
  secretkey: z.string().optional(),
  timeout: z.number().min(60).optional(),
});

export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const parsed = configSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  if (parsed.data.enabled !== undefined) {
    setSetting("satoken_enabled", parsed.data.enabled ? "true" : "false");
  }
  if (parsed.data.endpoint !== undefined) {
    setSetting("satoken_endpoint", parsed.data.endpoint);
  }
  if (parsed.data.secretkey !== undefined) {
    setSetting("satoken_secretkey", parsed.data.secretkey);
  }
  if (parsed.data.timeout !== undefined) {
    setSetting("satoken_timeout", String(parsed.data.timeout));
  }

  return NextResponse.json({ success: true });
}
