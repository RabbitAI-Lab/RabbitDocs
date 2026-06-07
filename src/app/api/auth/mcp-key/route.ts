import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSystemKey, createSystemKey, regenerateSystemKey } from "@/lib/auth/api-key";

/**
 * GET /api/auth/mcp-key — 获取当前用户的 MCP API Key（不存在则自动创建）
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  let row = getSystemKey(authResult.id);
  if (!row) {
    // 遗留用户首次访问，按需创建
    createSystemKey(authResult.id);
    row = getSystemKey(authResult.id);
  }

  if (!row) {
    return NextResponse.json({ error: "Failed to create MCP API key" }, { status: 500 });
  }

  return NextResponse.json({
    key: row.keyField,
    prefix: row.prefix,
    createdAt: row.createdAt,
  });
}

/**
 * POST /api/auth/mcp-key — 重新生成 MCP API Key
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const result = regenerateSystemKey(authResult.id);

  return NextResponse.json({
    key: result.key,
    prefix: result.prefix,
    createdAt: result.createdAt,
  });
}
