import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

// GET /api/templates/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const t = db.select().from(templates).where(eq(templates.id, parseInt(id))).get();
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 }); // non-authed GET
  return NextResponse.json(t);
}

// PATCH /api/templates/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { id } = await params;
  const body = await req.json();
  const { name, description, content, icon, agentPrompt } = body;

  // 检查是否为系统模板
  const existing = db.select().from(templates).where(eq(templates.id, parseInt(id))).get();
  if (!existing) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (existing.isSystem === 1) {
    return NextResponse.json({ error: t('api.templates.systemTemplateCannotModify') }, { status: 403 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (content !== undefined) updateData.content = content;
  if (icon !== undefined) updateData.icon = icon;
  if (agentPrompt !== undefined) updateData.agentPrompt = agentPrompt;

  db.update(templates).set(updateData).where(eq(templates.id, parseInt(id))).run();
  return NextResponse.json({ success: true });
}

// DELETE /api/templates/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 检查是否为系统模板
  const existing = db.select().from(templates).where(eq(templates.id, parseInt(id))).get();
  const t = await getApiT();
  if (!existing) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (existing.isSystem === 1) {
    return NextResponse.json({ error: t('api.templates.systemTemplateCannotDelete') }, { status: 403 });
  }

  db.delete(templates).where(eq(templates.id, parseInt(id))).run();
  return NextResponse.json({ success: true });
}
