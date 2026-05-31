import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { PROTOCOLS } from "@/lib/model-constants";

// GET /api/models
export async function GET() {
  const all = db.select().from(modelConfigs).all();
  return NextResponse.json(all);
}

// POST /api/models
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { provider, name, baseUrl, apiKey, modelName, protocol } = body;

  if (!provider || !name || !baseUrl || !apiKey || !modelName) {
    return NextResponse.json(
      { error: "provider, name, baseUrl, apiKey, modelName are required" },
      { status: 400 }
    );
  }

  const resolvedProtocol = protocol || "openai";
  const validProtocols = PROTOCOLS as readonly string[];
  if (!validProtocols.includes(resolvedProtocol)) {
    return NextResponse.json(
      { error: `protocol must be one of: ${validProtocols.join(", ")}` },
      { status: 400 }
    );
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
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ id: result.lastInsertRowid, name });
}
