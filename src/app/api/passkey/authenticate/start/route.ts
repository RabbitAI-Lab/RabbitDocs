import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions, type AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { db } from "@/db";
import { passkeys, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSetting, setSetting } from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";

export async function POST(req: NextRequest) {
  const enabled = getSetting("passkey_enabled") === "true";
  if (!enabled) {
    const t = await getApiT();
    return NextResponse.json({ error: t('api.passkey.authenticationDisabled') }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const email = body.email as string | undefined;

  let allowCredentials: Array<{
    id: `${string}${string}`;
    transports?: AuthenticatorTransportFuture[];
  }> = [];

  if (email) {
    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (user) {
      const userPasskeys = db
        .select()
        .from(passkeys)
        .where(eq(passkeys.userId, user.id))
        .all();

      allowCredentials = userPasskeys.map((p) => ({
        id: p.credentialId as `${string}${string}`,
        transports: p.transports
          ? (JSON.parse(p.transports) as AuthenticatorTransportFuture[])
          : undefined,
      }));
    }
  }

  const rpID = getSetting("passkey_rp_id") || req.headers.get("host")?.split(":")[0] || "localhost";

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });

  // 存储 challenge
  const challengeKey = `passkey_auth_challenge_${Date.now()}`;
  setSetting(challengeKey, options.challenge as unknown as string);

  return NextResponse.json({ ...options, _challengeKey: challengeKey });
}
