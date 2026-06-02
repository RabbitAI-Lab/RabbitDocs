import { NextRequest, NextResponse } from "next/server";
import {
  readDocument,
  writeDocument,
  deleteDocument,
  renameDocument,
  buildPath,
  buildHtmlPath,
  readHtmlDocument,
  writeHtmlDocument,
  deleteHtmlDocument,
  renameHtmlDocument,
} from "@/lib/fs";
import fs from "fs";
import { db } from "@/db";
import { documentActivities, sharedHtmlFiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * 从 path 段识别文件类型：".html" -> "html"；其他（含 ".md"）-> "md"。
 * 若没有有效后缀返回 null。
 */
function getFileKind(segments: string[]): "md" | "html" | null {
  const last = segments[segments.length - 1];
  if (!last) return null;
  if (last.endsWith(".html")) return "html";
  if (last.endsWith(".md")) return "md";
  return null;
}

function readAnyDocument(...segments: string[]): string | null {
  return getFileKind(segments) === "html"
    ? readHtmlDocument(...segments)
    : readDocument(...segments);
}

function writeAnyDocument(content: string, ...segments: string[]): void {
  if (getFileKind(segments) === "html") {
    writeHtmlDocument(content, ...segments);
  } else {
    writeDocument(content, ...segments);
  }
}

function deleteAnyDocument(...segments: string[]): void {
  if (getFileKind(segments) === "html") {
    deleteHtmlDocument(...segments);
  } else {
    deleteDocument(...segments);
  }
}

/** 构造新文件路径，按原始后缀类型决定。 */
function buildNewPath(
  originalSegments: string[],
  newTitle: string
): string {
  const tail = originalSegments[originalSegments.length - 1] || "";
  const isHtml = tail.endsWith(".html");
  const titleWithExt = newTitle.endsWith(".html") || newTitle.endsWith(".md")
    ? newTitle
    : isHtml
      ? `${newTitle}.html`
      : `${newTitle}.md`;
  const dirSegments = originalSegments.slice(0, -1);
  return isHtml
    ? buildHtmlPath(...dirSegments, titleWithExt)
    : buildPath(...dirSegments, titleWithExt);
}

function parseDocumentMeta(segments: string[]) {
  // segments: ["personal", "default", "projects", "{projectId}", "docs", ...pathParts]
  if (segments.length >= 6 && segments[3] && segments[4] === "docs") {
    const projectId = segments[3];
    const docSegments = segments.slice(5);
    const documentPath = docSegments.join("/");
    const last = docSegments[docSegments.length - 1] || "";
    const documentTitle = last.replace(/\.(md|html)$/, "");
    return { projectId, documentPath, documentTitle };
  }
  return null;
}

// GET /api/fs/document?path=personal/default/my-project/doc-title
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path") || "";

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  const content = readAnyDocument(...segments);

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
  const meta = parseDocumentMeta(segments);

  if (meta) {
    const existing = readAnyDocument(...segments);
    writeAnyDocument(content, ...segments);
    db.insert(documentActivities).values({
      projectId: meta.projectId,
      documentPath: meta.documentPath,
      documentTitle: meta.documentTitle,
      action: existing !== null ? "update" : "create",
      createdAt: new Date().toISOString(),
    }).run();
  } else {
    writeAnyDocument(content, ...segments);
  }

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
  const meta = parseDocumentMeta(segments);

  deleteAnyDocument(...segments);

  if (meta) {
    db.insert(documentActivities).values({
      projectId: meta.projectId,
      documentPath: meta.documentPath,
      documentTitle: meta.documentTitle,
      action: "delete",
      createdAt: new Date().toISOString(),
    }).run();

    // HTML 文件额外清理分享记录
    if (getFileKind(segments) === "html") {
      db.delete(sharedHtmlFiles)
        .where(
          and(
            eq(sharedHtmlFiles.projectId, meta.projectId),
            eq(sharedHtmlFiles.htmlPath, meta.documentPath)
          )
        )
        .run();
    }
  }

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
  const newPath = buildNewPath(segments, newTitle);
  if (fs.existsSync(newPath)) {
    return NextResponse.json({ error: "A file with this name already exists" }, { status: 409 });
  }

  const meta = parseDocumentMeta(segments);
  const isHtml = getFileKind(segments) === "html";

  if (meta) {
    const oldTitle = meta.documentTitle;
    if (isHtml) {
      // 使用 HTML 专属 rename
      renameHtmlDocument(newTitle, ...segments);
    } else {
      renameDocument(newTitle, ...segments);
    }
    db.insert(documentActivities).values({
      projectId: meta.projectId,
      documentPath: meta.documentPath.replace(/\/[^/]*$/, "/" + (newTitle.replace(/\.(md|html)$/, ""))),
      documentTitle: newTitle.replace(/\.(md|html)$/, ""),
      action: "rename",
      oldTitle,
      createdAt: new Date().toISOString(),
    }).run();

    // HTML 文件额外同步分享记录的 htmlPath
    if (isHtml) {
      const dirParts = meta.documentPath.split("/").slice(0, -1);
      const newHtmlPath = [...dirParts, `${newTitle.replace(/\.html$/, "")}.html`].join("/");
      const now = new Date().toISOString();
      db.update(sharedHtmlFiles)
        .set({ htmlPath: newHtmlPath, updatedAt: now })
        .where(
          and(
            eq(sharedHtmlFiles.projectId, meta.projectId),
            eq(sharedHtmlFiles.htmlPath, meta.documentPath)
          )
        )
        .run();
    }
  } else {
    if (isHtml) {
      renameHtmlDocument(newTitle, ...segments);
    } else {
      renameDocument(newTitle, ...segments);
    }
  }

  return NextResponse.json({ success: true });
}
