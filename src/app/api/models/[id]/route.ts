import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { PROTOCOLS } from "@/lib/model-constants";
import { parseExtraEnv, serializeExtraEnv } from "@/lib/model-env";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

// GET /api/models/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const model = db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.id, parseInt(id)))
    .get();
  if (!model)
    return NextResponse.json({ error: "Not found" }, { status: 404 }); // keep English for non-authed GET
  return NextResponse.json(model);
}

// PATCH /api/models/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { id } = await params;
  const body = await req.json();
  const { provider, name, baseUrl, apiKey, modelName, protocol, isDefault, extraEnvJson, backend } = body;

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (provider !== undefined) updateData.provider = provider;
  if (name !== undefined) updateData.name = name;
  if (baseUrl !== undefined)
    updateData.baseUrl = (baseUrl as string).replace(/\/+$/, "");
  if (apiKey !== undefined) updateData.apiKey = apiKey;
  if (modelName !== undefined) updateData.modelName = modelName;
  if (protocol !== undefined) {
    const validProtocols = PROTOCOLS as readonly string[];
    if (!validProtocols.includes(protocol)) {
      return NextResponse.json(
        { error: t('api.models.protocolMustBeOneOf') + ': ' + validProtocols.join(", ") },
        { status: 400 }
      );
    }
    updateData.protocol = protocol;
  }

  if (extraEnvJson !== undefined) {
    // 客户端按表单状态重新生成 extraEnvJson 后再传过来
    // 二次规范化（去空 key、确保 string value）保证 DB 存的是合法 JSON
    updateData.extraEnvJson = serializeExtraEnv(parseExtraEnv(extraEnvJson));
  }

  if (backend !== undefined) {
    updateData.backend = backend;
  }

  if (isDefault !== undefined) {
    if (isDefault === 1) {
      db.update(modelConfigs).set({ isDefault: 0 }).run();
    }
    updateData.isDefault = isDefault;
  }

  db.update(modelConfigs)
    .set(updateData)
    .where(eq(modelConfigs.id, parseInt(id)))
    .run();
  return NextResponse.json({ success: true });
}

// DELETE /api/models/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.delete(modelConfigs)
    .where(eq(modelConfigs.id, parseInt(id)))
    .run();
  return NextResponse.json({ success: true });
}
