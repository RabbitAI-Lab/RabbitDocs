import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listTree } from "@/lib/fs";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/tree?path=personal/default/my-project
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { searchParams } = new URL(req.url);
  const dirPath = searchParams.get("path") || "";

  if (!dirPath) {
    return NextResponse.json({ error: t('api.pathRequired') }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);
  const tree = listTree(segments, [".md", ".html"])
  return NextResponse.json(tree);
}
