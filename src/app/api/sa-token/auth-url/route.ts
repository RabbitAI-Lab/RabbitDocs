import { NextResponse } from "next/server";
import { isSaTokenEnabled, getAuthUrl } from "@/lib/auth/sa-token";
import { getAppUrl } from "@/lib/auth/env";
import { getApiT } from "@/lib/i18n-api";

export async function GET() {
  const t = await getApiT();
  if (!isSaTokenEnabled()) {
    return NextResponse.json({ error: t('api.sso.ssoNotEnabled') }, { status: 400 });
  }

  const callbackUrl = `${getAppUrl()}/login`;
  const authUrl = getAuthUrl(callbackUrl);

  return NextResponse.json({ url: authUrl });
}
