import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { saTokenLogout } from "@/lib/auth/sa-token";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const loginId = body.loginId as string | undefined;

    // 查找用户的 satoken login ID
    if (!loginId) {
      const user = db
        .select({ satokenLoginId: users.satokenLoginId })
        .from(users)
        .where(eq(users.id, authResult.id))
        .get();

      if (user?.satokenLoginId) {
        await saTokenLogout(user.satokenLoginId);
      }
    } else {
      await saTokenLogout(loginId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sa-token] Logout error:", error);
    return NextResponse.json({ success: true }); // 不阻塞登出
  }
}
