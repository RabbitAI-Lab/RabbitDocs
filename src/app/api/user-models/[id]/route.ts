import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { userModelConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { PROVIDERS, getProviderDefaults } from "@/lib/model-constants";
import { encryptApiKey, maskApiKey, decryptApiKey } from "@/lib/crypto";
import { verifyAnthropicApiKey } from "@/lib/verify-api-key";
import { getApiT } from "@/lib/i18n-api";

// GET /api/user-models/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

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

  return NextResponse.json({
    ...row,
    apiKeyEncrypted: undefined,
    apiKeyMasked: (() => {
      try {
        return maskApiKey(decryptApiKey(row.apiKeyEncrypted));
      } catch {
        return "****";
      }
    })(),
  });
}

// PATCH /api/user-models/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { id } = await params;

  // 验证所有权
  const existing = db
    .select()
    .from(userModelConfigs)
    .where(
      and(eq(userModelConfigs.id, parseInt(id)), eq(userModelConfigs.userId, auth.id))
    )
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (body.provider !== undefined) {
    if (!(PROVIDERS as readonly string[]).includes(body.provider)) {
      return NextResponse.json(
        { error: t("api.userModels.unsupportedProvider") },
        { status: 400 }
      );
    }
    updateData.provider = body.provider;
    // 同步更新 baseUrl
    const defaults = getProviderDefaults(body.provider, "anthropic");
    if (defaults) {
      updateData.baseUrl = defaults.baseUrl;
    }
  }

  if (body.name !== undefined) updateData.name = body.name;
  if (body.modelName !== undefined) updateData.modelName = body.modelName;
  // 如果更新了 apiKey，需要验证连通性
  if (body.apiKey !== undefined) {
    const effectiveModelName = body.modelName || existing.modelName;
    const effectiveBaseUrl = (updateData.baseUrl as string) || existing.baseUrl;

    console.log("[BYOK] 更新模型，验证 API Key:", effectiveBaseUrl, effectiveModelName);
    const verifyResult = await verifyAnthropicApiKey({
      baseUrl: effectiveBaseUrl,
      apiKey: body.apiKey,
      modelName: effectiveModelName,
    });
    if (!verifyResult.ok) {
      console.error("[BYOK] API Key 验证失败:", verifyResult.error);
      return NextResponse.json(
        { error: t("api.userModels.verifyFailed", { reason: verifyResult.error || "Unknown error" }) },
        { status: 400 }
      );
    }
    console.log("[BYOK] API Key 验证通过");
    updateData.apiKeyEncrypted = encryptApiKey(body.apiKey);
  }
  if (body.backend !== undefined) updateData.backend = body.backend;

  db.update(userModelConfigs)
    .set(updateData)
    .where(eq(userModelConfigs.id, parseInt(id)))
    .run();

  return NextResponse.json({ success: true });
}

// DELETE /api/user-models/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  // 只删除自己的模型
  db.delete(userModelConfigs)
    .where(
      and(eq(userModelConfigs.id, parseInt(id)), eq(userModelConfigs.userId, auth.id))
    )
    .run();

  return NextResponse.json({ success: true });
}
