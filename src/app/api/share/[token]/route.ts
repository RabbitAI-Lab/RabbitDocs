import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sharedChats, chats, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

// GET /api/share/[token] — 公开获取分享的聊天内容
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const t = await getApiT();

  const share = db
    .select()
    .from(sharedChats)
    .where(eq(sharedChats.token, token))
    .get();
  if (!share) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });

  const chat = db.select().from(chats).where(eq(chats.id, share.chatId)).get();
  if (!chat) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });

  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chat.id))
    .all();

  return NextResponse.json({
    title: chat.title,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
