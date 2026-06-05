import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cliAuthorizationCodes, cliTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getApiT } from "@/lib/i18n-api";

const tokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string(),
});

export async function POST(req: NextRequest) {
  const t = await getApiT();
  try {
    const body = await req.json();
    const parsed = tokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", error_description: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { code, code_verifier, redirect_uri } = parsed.data;

    // 查找授权码
    const authCode = db
      .select()
      .from(cliAuthorizationCodes)
      .where(eq(cliAuthorizationCodes.code, code))
      .get();

    if (!authCode) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: t('api.auth.cli.invalidAuthCode') },
        { status: 400 }
      );
    }

    // 检查过期
    if (new Date(authCode.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: t('api.auth.cli.authCodeExpired') },
        { status: 400 }
      );
    }

    // 检查 redirect_uri 匹配
    if (authCode.redirectUri !== redirect_uri) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: t('api.auth.cli.redirectUriMismatch') },
        { status: 400 }
      );
    }

    // PKCE 验证：SHA256(code_verifier) base64url === stored code_challenge
    const computedChallenge = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url");

    if (computedChallenge !== authCode.codeChallenge) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: t('api.auth.cli.pkceVerificationFailed') },
        { status: 400 }
      );
    }

    // 删除授权码（一次性使用）
    db.delete(cliAuthorizationCodes)
      .where(eq(cliAuthorizationCodes.id, authCode.id))
      .run();

    // 生成 CLI token
    const tokenValue = `cli_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.insert(cliTokens)
      .values({
        id: crypto.randomUUID(),
        name: "CLI Token",
        token: tokenValue,
        prefix: tokenValue.slice(0, 8),
        userId: authCode.userId,
        createdAt: now,
      })
      .run();

    return NextResponse.json({
      token_type: "Bearer",
      access_token: tokenValue,
    });
  } catch (error) {
    console.error("[auth] CLI token exchange error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: t('api.internalError') },
      { status: 500 }
    );
  }
}
