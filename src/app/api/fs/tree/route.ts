import { NextRequest, NextResponse } from "next/server";
import { listTree } from "@/lib/fs";

// GET /api/fs/tree?path=personal/default/my-project
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirPath = searchParams.get("path") || "";

  if (!dirPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);
  const tree = listTree(segments);
  return NextResponse.json(tree);
}
