import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getDatabaseInfo } from "@/lib/db-dump";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const info = getDatabaseInfo();
    return NextResponse.json(info);
  } catch (error) {
    console.error("[database] info error:", error);
    return NextResponse.json(
      { error: "Failed to get database info" },
      { status: 500 }
    );
  }
}
