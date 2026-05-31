import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { storageConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/storage-config
export async function GET() {
  const config = db.select().from(storageConfig).get();
  return NextResponse.json({
    storagePath: config?.storagePath ?? "",
    updatedAt: config?.updatedAt ?? null,
  });
}

// PUT /api/storage-config
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { storagePath } = body;

  if (typeof storagePath !== "string") {
    return NextResponse.json(
      { error: "storagePath 必须是字符串" },
      { status: 400 }
    );
  }

  const trimmed = storagePath.trim();

  // 允许清空（恢复默认）
  if (trimmed !== "") {
    if (!trimmed.startsWith("/")) {
      return NextResponse.json(
        { error: "存储路径必须是绝对路径，以 / 开头" },
        { status: 400 }
      );
    }

    if (trimmed.startsWith("/.") || trimmed.includes("/..")) {
      return NextResponse.json(
        { error: "存储路径不能包含 . 或 .. 目录片段" },
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
        { error: "目录不可写或无法创建，请检查路径和权限" },
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
