import { NextRequest, NextResponse } from "next/server";
import { getApiT } from "@/lib/i18n-api";

export async function GET(req: NextRequest) {
  const t = await getApiT();
  const codeChallenge = req.nextUrl.searchParams.get("code_challenge");
  const codeChallengeMethod = req.nextUrl.searchParams.get("code_challenge_method") || "S256";
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri");
  const state = req.nextUrl.searchParams.get("state");

  if (!codeChallenge || !redirectUri || !state) {
    return NextResponse.json(
      { error: t('api.auth.cli.missingRequiredParams') },
      { status: 400 }
    );
  }

  // 验证 redirect_uri 是 localhost
  try {
    const url = new URL(redirectUri);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json(
        { error: t('api.auth.cli.redirectUriMustBeLocalhost') },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: t('api.auth.cli.invalidRedirectUri') },
      { status: 400 }
    );
  }

  // 重定向到前端同意页面
  const consentUrl = new URL("/cli-consent", req.url);
  consentUrl.searchParams.set("code_challenge", codeChallenge);
  consentUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("state", state);

  return NextResponse.redirect(consentUrl);
}
