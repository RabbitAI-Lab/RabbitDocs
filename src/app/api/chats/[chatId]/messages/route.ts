import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages, chats } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/chats/[chatId]/messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, parseInt(chatId)))
    .all();

  return NextResponse.json(messages);
}

// POST /api/chats/[chatId]/messages
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const body = await req.json();
  const { role, content } = body;

  if (!role || !content) {
    return NextResponse.json({ error: "role and content are required" }, { status: 400 });
  }

  const result = db.insert(chatMessages).values({
    chatId: parseInt(chatId),
    role,
    content,
    createdAt: new Date().toISOString(),
  }).run();

  // Update chat's updatedAt
  db.update(chats)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(chats.id, parseInt(chatId)))
    .run();

  return NextResponse.json({ id: result.lastInsertRowid, role, content });
}
