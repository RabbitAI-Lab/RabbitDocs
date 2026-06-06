import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { PROTOCOLS } from "@/lib/model-constants";
import {
  parseExtraEnv,
  serializeExtraEnv,
  defaultExtraEnvForCreate,
} from "@/lib/model-env";
import { getApiT } from "@/lib/i18n-api";

// GET /api/models
export async function GET() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  const all = db.select().from(modelConfigs).all();
  return NextResponse.json(all);
}

// POST /api/models
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { provider, name, baseUrl, apiKey, modelName, protocol, extraEnvJson, backend } = body;

  if (!provider || !name || !baseUrl || !apiKey || !modelName) {
    return NextResponse.json(
      { error: t('api.models.requiredFields') },
      { status: 400 }
    );
  }

  const resolvedProtocol = protocol || "openai";
  const validProtocols = PROTOCOLS as readonly string[];
  if (!validProtocols.includes(resolvedProtocol)) {
    return NextResponse.json(
      { error: t('api.models.protocolMustBeOneOf') + ': ' + validProtocols.join(", ") },
      { status: 400 }
    );
  }

  // 规范化 extraEnvJson：缺失则填国产默认；提供则二次规范化（去空 key、确保 string value）
  let resolvedExtraEnvJson: string;
  if (extraEnvJson === undefined || extraEnvJson === null || extraEnvJson === "") {
    resolvedExtraEnvJson = JSON.stringify(defaultExtraEnvForCreate());
  } else {
    resolvedExtraEnvJson = serializeExtraEnv(parseExtraEnv(extraEnvJson));
  }

  const now = new Date().toISOString();
  const result = db
    .insert(modelConfigs)
    .values({
      provider,
      protocol: resolvedProtocol,
      name,
      baseUrl: baseUrl.replace(/\/+$/, ""),
      apiKey,
      modelName,
      extraEnvJson: resolvedExtraEnvJson,
      backend: backend || "sdk",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ id: result.lastInsertRowid, name });
}
