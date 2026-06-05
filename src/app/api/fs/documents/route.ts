import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listDocuments, listTree } from "@/lib/fs";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/documents?path=personal/default/my-project
// GET /api/fs/documents?path=personal/default/my-project&tree=true
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { searchParams } = new URL(req.url);
  const dirPath = searchParams.get("path") || "";
  const tree = searchParams.get("tree") === "true";

  if (!dirPath) {
    return NextResponse.json({ error: t('api.pathRequired') }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);

  if (tree) {
    const treeData = listTree(segments, [".md", ".html"])
    return NextResponse.json(treeData);
  }

  const docs = listDocuments(...segments);
  return NextResponse.json(docs);
}
