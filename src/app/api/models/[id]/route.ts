import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { PROTOCOLS } from "@/lib/model-constants";
import { eq } from "drizzle-orm";

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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(model);
}

// PATCH /api/models/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { provider, name, baseUrl, apiKey, modelName, protocol, isDefault } = body;

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
        { error: `protocol must be one of: ${validProtocols.join(", ")}` },
        { status: 400 }
      );
    }
    updateData.protocol = protocol;
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
