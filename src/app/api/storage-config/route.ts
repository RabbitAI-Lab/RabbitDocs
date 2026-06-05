import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { storageConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/storage-config
export async function GET() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  const config = db.select().from(storageConfig).get();
  return NextResponse.json({
    storagePath: config?.storagePath ?? "",
    updatedAt: config?.updatedAt ?? null,
  });
}

// PUT /api/storage-config
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { storagePath } = body;

  if (typeof storagePath !== "string") {
    return NextResponse.json(
      { error: t('api.storage.storagePathMustBeString') },
      { status: 400 }
    );
  }

  const trimmed = storagePath.trim();

  // 允许清空（恢复默认）
  if (trimmed !== "") {
    if (!trimmed.startsWith("/")) {
      return NextResponse.json(
        { error: t('api.storage.storagePathMustBeAbsolute') },
        { status: 400 }
      );
    }

    if (trimmed.startsWith("/.") || trimmed.includes("/..")) {
      return NextResponse.json(
        { error: t('api.storage.storagePathNoDotDot') },
        { status: 400 }
      );
    }

    // 检查路径是否存在且可写，不存在则尝试创建
    try {
      if (!fs.existsSync(trimmed)) {
        fs.mkdirSync(trimmed, { recursive: true });
      }
      // 测试写入权限
      const testFile = path.join(trimmed, ".storage-test");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
    } catch {
      return NextResponse.json(
        { error: t('api.storage.directoryNotWritable') },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const existing = db.select().from(storageConfig).get();

  if (existing) {
    db.update(storageConfig)
      .set({ storagePath: trimmed, updatedAt: now })
      .where(eq(storageConfig.id, existing.id))
      .run();
  } else {
    db.insert(storageConfig)
      .values({ storagePath: trimmed, createdAt: now, updatedAt: now })
      .run();
  }

  return NextResponse.json({ success: true, updatedAt: now });
}
