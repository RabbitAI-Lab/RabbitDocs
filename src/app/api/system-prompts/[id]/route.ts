import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemPrompts } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/system-prompts/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, parseInt(id)))
    .get();
  if (!record)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

// PATCH /api/system-prompts/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.content !== undefined) updateData.content = body.content;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  db.update(systemPrompts)
    .set(updateData)
    .where(eq(systemPrompts.id, parseInt(id)))
    .run();
  return NextResponse.json({ success: true });
}

// DELETE /api/system-prompts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 禁止删除内置系统提示词
  const record = db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, parseInt(id)))
    .get();
  if (!record)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.isSystem === 1)
    return NextResponse.json({ error: "Cannot delete built-in system prompt" }, { status: 403 });

  db.delete(systemPrompts)
    .where(eq(systemPrompts.id, parseInt(id)))
    .run();
  return NextResponse.json({ success: true });
}
