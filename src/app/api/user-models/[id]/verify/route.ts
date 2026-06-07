import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userModelConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptApiKey } from "@/lib/crypto";
import { verifyAnthropicApiKey } from "@/lib/verify-api-key";

export const dynamic = "force-dynamic";

// POST /api/user-models/[id]/verify — 测试已有模型的 API 连通性
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  // 查询模型配置（需属于当前用户）
  const row = db
    .select()
    .from(userModelConfigs)
    .where(
      and(eq(userModelConfigs.id, parseInt(id)), eq(userModelConfigs.userId, auth.id))
    )
    .get();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 解密 API Key
  let apiKey: string;
  try {
    apiKey = decryptApiKey(row.apiKeyEncrypted);
  } catch {
    return NextResponse.json(
      { ok: false, error: "API Key 解密失败，请重新配置" },
      { status: 200 }
    );
  }

  // 调用验证
  console.log("[BYOK] 测试连接: id=", id, "baseUrl=", row.baseUrl, "model=", row.modelName);
  const result = await verifyAnthropicApiKey({
    baseUrl: row.baseUrl,
    apiKey,
    modelName: row.modelName,
  });

  return NextResponse.json(result);
}
