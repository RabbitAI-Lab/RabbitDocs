import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userModelConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PROVIDERS, getProviderDefaults } from "@/lib/model-constants";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/crypto";
import { verifyAnthropicApiKey } from "@/lib/verify-api-key";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/user-models — 返回当前用户的所有 BYOK 模型（apiKey 遮掩）
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const rows = db
    .select()
    .from(userModelConfigs)
    .where(eq(userModelConfigs.userId, auth.id))
    .all();

  // 遮掩 apiKey
  const safe = rows.map((row) => ({
    ...row,
    apiKeyEncrypted: undefined,
    apiKeyMasked: maskApiKey(
      (() => {
        try {
          return decryptApiKey(row.apiKeyEncrypted);
        } catch {
          return "****";
        }
      })()
    ),
  }));

  return NextResponse.json(safe);
}

// POST /api/user-models — 创建新的 BYOK 模型
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const t = await getApiT();

  const body = await req.json();
  const { provider, modelName, apiKey, name, backend } = body;

  if (!provider || !modelName || !apiKey) {
    return NextResponse.json(
      { error: t("api.userModels.requiredFields") },
      { status: 400 }
    );
  }

  // 校验 provider 在预设列表内
  if (!(PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json(
      { error: t("api.userModels.unsupportedProvider") },
      { status: 400 }
    );
  }

  // 从 PROVIDER_DEFAULTS 获取 anthropic 协议的 baseUrl 和默认 modelName
  const defaults = getProviderDefaults(provider, "anthropic");
  if (!defaults) {
    return NextResponse.json(
      { error: t("api.userModels.providerNoAnthropic") },
      { status: 400 }
    );
  }

  // 验证 API Key 连通性
  console.log("[BYOK] 验证 API Key 连通性:", defaults.baseUrl, modelName);
  const verifyResult = await verifyAnthropicApiKey({
    baseUrl: defaults.baseUrl,
    apiKey,
    modelName,
  });
  if (!verifyResult.ok) {
    console.error("[BYOK] API Key 验证失败:", verifyResult.error);
    return NextResponse.json(
      { error: t("api.userModels.verifyFailed", { reason: verifyResult.error || "Unknown error" }) },
      { status: 400 }
    );
  }
  console.log("[BYOK] API Key 验证通过");

  const now = new Date().toISOString();
  const result = db
    .insert(userModelConfigs)
    .values({
      userId: auth.id,
      provider,
      name: name || `${provider}-${modelName}`,
      baseUrl: defaults.baseUrl, // 自动填充
      apiKeyEncrypted: encryptApiKey(apiKey),
      modelName,
      backend: backend || "sdk",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({
    id: result.lastInsertRowid,
    name: name || `${provider}-${modelName}`,
  });
}
