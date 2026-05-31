import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mcpConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/mcp-config
export async function GET() {
  const config = db.select().from(mcpConfig).get();
  return NextResponse.json({
    configJson: config?.configJson ?? "{}",
    updatedAt: config?.updatedAt ?? null,
  });
}

// PUT /api/mcp-config
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { configJson } = body;

  if (typeof configJson !== "string") {
    return NextResponse.json(
      { error: "configJson 必须是字符串" },
      { status: 400 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configJson);
  } catch {
    return NextResponse.json(
      { error: "JSON 格式无效，请检查输入" },
      { status: 400 }
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json(
      { error: "JSON 必须是一个对象 {}" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const existing = db.select().from(mcpConfig).get();

  if (existing) {
    db.update(mcpConfig)
      .set({ configJson, updatedAt: now })
      .where(eq(mcpConfig.id, existing.id))
      .run();
  } else {
    db.insert(mcpConfig)
      .values({ configJson, createdAt: now, updatedAt: now })
      .run();
  }

  return NextResponse.json({ success: true, updatedAt: now });
}
