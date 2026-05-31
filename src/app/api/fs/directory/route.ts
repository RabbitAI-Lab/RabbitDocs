import { NextRequest, NextResponse } from "next/server";
import { createDir, deleteDir } from "@/lib/fs";

// POST /api/fs/directory - create a directory
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { path: dirPath } = body;
  if (!dirPath || typeof dirPath !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);
  createDir(segments);
  return NextResponse.json({ success: true, path: dirPath });
}

// DELETE /api/fs/directory - delete a directory
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { path: dirPath } = body;
  if (!dirPath || typeof dirPath !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);
  deleteDir(segments);
  return NextResponse.json({ success: true });
}
