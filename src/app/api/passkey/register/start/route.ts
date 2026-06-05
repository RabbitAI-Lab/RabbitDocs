import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/db";
import { passkeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { getSetting, setSetting } from "@/lib/auth/settings";
import type { AuthUser } from "@/lib/auth/session";
import { getApiT } from "@/lib/i18n-api";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult as AuthUser;

  const enabled = getSetting("passkey_enabled") === "true";
  if (!enabled) {
    const t = await getApiT();
    return NextResponse.json({ error: t('api.passkey.registrationDisabled') }, { status: 400 });
  }

  const rpID = getSetting("passkey_rp_id") || req.headers.get("host")?.split(":")[0] || "localhost";
  const rpName = getSetting("passkey_rp_name") || "RabbitDocs";

  // 获取已有凭证（用于排除）
  const existingPasskeys = db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))
    .all();

  const excludeCredentials = existingPasskeys.map((p) => ({
    id: p.credentialId as `${string}${string}`,
    transports: p.transports ? JSON.parse(p.transports) : undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.email,
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // 存储 challenge（直接存 base64url 字符串）
  setSetting(`passkey_challenge_${user.id}`, options.challenge as unknown as string);

  return NextResponse.json(options);
}
