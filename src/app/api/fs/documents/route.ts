import { NextRequest, NextResponse } from "next/server";
import { listDocuments, listTree } from "@/lib/fs";

// GET /api/fs/documents?path=personal/default/my-project
// GET /api/fs/documents?path=personal/default/my-project&tree=true
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirPath = searchParams.get("path") || "";
  const tree = searchParams.get("tree") === "true";

  if (!dirPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);

  if (tree) {
    const treeData = listTree(segments);
    return NextResponse.json(treeData);
  }

  const docs = listDocuments(...segments);
  return NextResponse.json(docs);
}
