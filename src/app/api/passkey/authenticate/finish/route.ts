import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db } from "@/db";
import { passkeys, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateTokenPair } from "@/lib/auth/tokens";
import { getSetting, setSetting } from "@/lib/auth/settings";
import { isAdmin } from "@/lib/auth/settings";
import { getApiT } from "@/lib/i18n-api";

export async function POST(req: NextRequest) {
  const t = await getApiT();
  try {
    const body = await req.json();
    const credential = typeof body.credential === "string"
      ? JSON.parse(body.credential)
      : body.credential;
    const challengeKey = body._challengeKey as string;

    if (!challengeKey) {
      return NextResponse.json({ error: t('api.passkey.missingChallengeKey') }, { status: 400 });
    }

    const challengeStr = getSetting(challengeKey);
    if (!challengeStr) {
      return NextResponse.json({ error: t('api.passkey.noPendingAuthentication') }, { status: 400 });
    }

    // 根据 credentialId 查找 passkey
    const credentialId = credential.id as string;
    const passkey = db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, credentialId))
      .get();

    if (!passkey) {
      return NextResponse.json({ error: t('api.passkey.passkeyNotFound') }, { status: 400 });
    }

    const rpID = getSetting("passkey_rp_id") || req.headers.get("host")?.split(":")[0] || "localhost";
    const origin = req.headers.get("origin") || `https://${rpID}`;

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeStr,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId as `${string}${string}`,
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: passkey.signCount,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: t('api.passkey.verificationFailed') }, { status: 400 });
    }

    // 更新 signCount 和 lastUsedAt
    const now = new Date().toISOString();
    db.update(passkeys)
      .set({
        signCount: Number(verification.authenticationInfo.newCounter),
        lastUsedAt: now,
      })
      .where(eq(passkeys.id, passkey.id))
      .run();

    // 获取用户信息
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, passkey.userId))
      .get();

    if (!user) {
      return NextResponse.json({ error: t('api.auth.userNotFound') }, { status: 400 });
    }

    // 签发 JWT
    const tokens = await generateTokenPair(user.id, user.email);

    // 清理 challenge
    setSetting(challengeKey, "");

    const response = NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified === 1,
        accountType: user.accountType,
        isAdmin: isAdmin(user.id),
      },
    });

    response.cookies.set("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[passkey] Authenticate finish error:", error);
    return NextResponse.json({ error: t('api.passkey.authenticationFailed') }, { status: 500 });
  }
}
