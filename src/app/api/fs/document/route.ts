import { NextRequest, NextResponse } from "next/server";
import { readDocument, writeDocument, deleteDocument, renameDocument } from "@/lib/fs";

// GET /api/fs/document?path=personal/default/my-project/doc-title
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path") || "";

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  const content = readDocument(...segments);

  if (content === null) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ content });
}

// POST /api/fs/document - create/update document
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { path: filePath, content } = body;

  if (!filePath || content === undefined) {
    return NextResponse.json({ error: "path and content are required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  writeDocument(content, ...segments);
  return NextResponse.json({ success: true });
}

// DELETE /api/fs/document - delete document
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { path: filePath } = body;

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  deleteDocument(...segments);
  return NextResponse.json({ success: true });
}

// PATCH /api/fs/document - rename document
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { path: filePath, newTitle } = body;

  if (!filePath || !newTitle) {
    return NextResponse.json({ error: "path and newTitle are required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  renameDocument(newTitle, ...segments);
  return NextResponse.json({ success: true });
}
