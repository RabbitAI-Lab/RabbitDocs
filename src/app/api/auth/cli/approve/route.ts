import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cliAuthorizationCodes } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import crypto from "crypto";
import { getApiT } from "@/lib/i18n-api";

const approveSchema = z.object({
  code_challenge: z.string(),
  code_challenge_method: z.string().default("S256"),
  redirect_uri: z.string(),
  state: z.string(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = await req.json();
    const parsed = approveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { code_challenge, code_challenge_method, redirect_uri, state } = parsed.data;

    // 生成授权码（64 字符 hex，10 分钟有效期）
    const code = crypto.randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.insert(cliAuthorizationCodes)
      .values({
        id: crypto.randomUUID(),
        code,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        userId: authResult.id,
        redirectUri: redirect_uri,
        expiresAt,
        createdAt: now,
      })
      .run();

    // 重定向回 CLI 的 localhost 回调
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);

    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    console.error("[auth] CLI approve error:", error);
    return NextResponse.json({ error: t('api.internalError') }, { status: 500 });
  }
}
