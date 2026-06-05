import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sharedHtmlFiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { readHtmlDocument } from "@/lib/fs";
import { getApiT } from "@/lib/i18n-api";

/**
 * 解析 /api/share-html/[projectId]/[...path] 路由参数。
 * path 在这里是一个数组，join 后是相对于项目根的 htmlPath，例如 ["docs", "index.html"]。
 */
async function resolveParams(
  params: Promise<{ projectId: string; path: string[] }>
): Promise<{ projectId: string; htmlPath: string } | { error: string }> {
  const { projectId, path } = await params;
  const t = await getApiT();
  if (!projectId) return { error: t('api.projectIdRequired') };
  if (!path || path.length === 0) return { error: t('api.pathRequired') };
  const htmlPath = path.join("/");
  if (!htmlPath.endsWith(".html")) {
    return { error: "htmlPath must end with .html" };
  }
  // 简单防 `..` 段
  for (const seg of path) {
    if (seg === ".." || seg.includes("\0")) {
      return { error: t('api.notFound') };
    }
  }
  return { projectId, htmlPath };
}

/** 构造公开分享页 URL。 */
function buildShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/share-html/${token}`;
}

// POST /api/share-html/[projectId]/[...path] — 创建或重新生成分享 token
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; path: string[] }> }
) {
  const resolved = await resolveParams(params);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const { projectId, htmlPath } = resolved;

  // 确认文件存在，否则无法分享
  const content = readHtmlDocument(...htmlPath.split("/").filter(Boolean));
  if (content === null) {
    return NextResponse.json(
      { error: "HTML file not found; cannot share" }, // file-system error, keep as-is
      { status: 404 }
    );
  }

  // 查找是否已存在分享
  const existing = db
    .select()
    .from(sharedHtmlFiles)
    .where(
      and(
        eq(sharedHtmlFiles.projectId, projectId),
        eq(sharedHtmlFiles.htmlPath, htmlPath)
      )
    )
    .get();

  const now = new Date().toISOString();
  let token: string;

  if (existing) {
    // 重新生成 token，覆盖旧 token（旧的会立即失效）
    token = randomUUID();
    db.update(sharedHtmlFiles)
      .set({ token, updatedAt: now })
      .where(eq(sharedHtmlFiles.id, existing.id))
      .run();
  } else {
    token = randomUUID();
    db.insert(sharedHtmlFiles)
      .values({
        projectId,
        htmlPath,
        token,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  const shareUrl = buildShareUrl(req.nextUrl.origin, token);
  return NextResponse.json({
    token,
    url: shareUrl,
    isShared: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

// GET /api/share-html/[projectId]/[...path] — 查询分享状态
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; path: string[] }> }
) {
  const resolved = await resolveParams(params);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const { projectId, htmlPath } = resolved;

  const record = db
    .select()
    .from(sharedHtmlFiles)
    .where(
      and(
        eq(sharedHtmlFiles.projectId, projectId),
        eq(sharedHtmlFiles.htmlPath, htmlPath)
      )
    )
    .get();

  if (!record) {
    return NextResponse.json({
      isShared: false,
    });
  }

  return NextResponse.json({
    isShared: true,
    token: record.token,
    url: buildShareUrl(req.nextUrl.origin, record.token),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

// DELETE /api/share-html/[projectId]/[...path] — 取消分享
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; path: string[] }> }
) {
  const resolved = await resolveParams(params);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const { projectId, htmlPath } = resolved;

  const result = db
    .delete(sharedHtmlFiles)
    .where(
      and(
        eq(sharedHtmlFiles.projectId, projectId),
        eq(sharedHtmlFiles.htmlPath, htmlPath)
      )
    )
    .run();

  return NextResponse.json({
    isShared: false,
    deleted: result.changes ?? 0,
  });
}
