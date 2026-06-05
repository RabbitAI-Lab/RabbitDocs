import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { chatMessages, chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessChat } from "@/lib/auth/chat-access";
import { getApiT } from "@/lib/i18n-api";

// GET /api/chats/[chatId]/messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { chatId } = await params;
  const t = await getApiT();

  // 校验 chat 访问权限
  const chat = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  if (!chat) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (!canAccessChat(auth, chat)) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });

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
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { chatId } = await params;
  const t = await getApiT();

  // 校验 chat 访问权限
  const existing = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  if (!existing) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (!canAccessChat(auth, existing)) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });

  const body = await req.json();
  const { role, content, thinking, thinkingSignature, isError } = body;

  if (!role || !content) {
    return NextResponse.json({ error: t('api.chat.roleAndContentRequired') }, { status: 400 });
  }

  const result = db.insert(chatMessages).values({
    chatId: parseInt(chatId),
    role,
    content,
    // Extended Thinking 字段（可选，仅 assistant 会有值）
    thinking: thinking ?? null,
    thinkingSignature: thinkingSignature ?? null,
    // 标记错误消息
    isError: isError ? 1 : 0,
    createdAt: new Date().toISOString(),
  }).run();

  // Update chat's updatedAt
  db.update(chats)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(chats.id, parseInt(chatId)))
    .run();

  return NextResponse.json({
    id: result.lastInsertRowid,
    role,
    content,
    thinking: thinking ?? null,
    thinkingSignature: thinkingSignature ?? null,
    isError: isError ? 1 : 0,
  });
}
