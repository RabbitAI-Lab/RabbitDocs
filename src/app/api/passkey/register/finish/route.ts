import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@/db";
import { passkeys } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getSetting, setSetting } from "@/lib/auth/settings";
import type { AuthUser } from "@/lib/auth/session";
import crypto from "crypto";
import { getApiT } from "@/lib/i18n-api";

function getDeviceName(aaguid: string): string {
  const known: Record<string, string> = {
    "08966078-d3fc-4c5c-9a39-7e1c50bf9888": "Windows Hello",
    "adce0002-35bc-c60a-648b-0b25f1f05503": "Android",
    "6d44ba9b-f3c7-44c6-a723-a3a53e1b4076": "Apple Touch ID",
    "0ea242b2-5f01-4164-bd72-1de5ee0d20ea": "Apple Face ID",
  };
  return known[aaguid] || "Security Key";
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult as AuthUser;

  const t = await getApiT();
  try {
    const body = await req.json();
    const credential = typeof body.credential === "string"
      ? JSON.parse(body.credential)
      : body.credential;

    const challengeStr = getSetting(`passkey_challenge_${user.id}`);
    if (!challengeStr) {
      return NextResponse.json({ error: t('api.passkey.noPendingRegistration') }, { status: 400 });
    }

    const rpID = getSetting("passkey_rp_id") || req.headers.get("host")?.split(":")[0] || "localhost";
    const origin = req.headers.get("origin") || `https://${rpID}`;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeStr,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: t('api.passkey.verificationFailed') }, { status: 400 });
    }

    const info = verification.registrationInfo;
    const cred = info.credential;
    const now = new Date().toISOString();

    db.insert(passkeys)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey).toString("base64url"),
        signCount: cred.counter,
        transports: cred.transports ? JSON.stringify(cred.transports) : null,
        deviceName: getDeviceName(info.aaguid),
        aaguid: info.aaguid,
        createdAt: now,
        lastUsedAt: now,
      })
      .run();

    // 清理 challenge
    setSetting(`passkey_challenge_${user.id}`, "");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[passkey] Register finish error:", error);
    return NextResponse.json({ error: t('api.passkey.registrationFailed') }, { status: 500 });
  }
}
