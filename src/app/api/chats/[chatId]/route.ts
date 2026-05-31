import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/chats/[chatId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const c = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}

// PATCH /api/chats/[chatId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const body = await req.json();
  const { title, modelId, templateId, projectId } = body;

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (title !== undefined) updates.title = title;
  if (modelId !== undefined) updates.modelId = modelId;
  if (templateId !== undefined) updates.templateId = templateId;
  if (projectId !== undefined) updates.projectId = projectId;

  db.update(chats).set(updates).where(eq(chats.id, parseInt(chatId))).run();

  return NextResponse.json({ success: true });
}

// DELETE /api/chats/[chatId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  db.delete(chats).where(eq(chats.id, parseInt(chatId))).run();
  return NextResponse.json({ success: true });
}
