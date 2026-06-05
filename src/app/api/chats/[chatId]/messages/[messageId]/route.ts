import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { chatMessages, chats } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { canAccessChat } from "@/lib/auth/chat-access";
import { getApiT } from "@/lib/i18n-api";

// DELETE /api/chats/[chatId]/messages/[messageId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string; messageId: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { chatId, messageId } = await params;
  const t = await getApiT();

  // 校验 chat 访问权限
  const chat = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  if (!chat) return NextResponse.json({ error: t('api.chat.chatNotFound') }, { status: 404 });
  if (!canAccessChat(auth, chat)) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });

  // 删除消息（验证消息属于该 chat）
  db.delete(chatMessages)
    .where(and(
      eq(chatMessages.id, parseInt(messageId)),
      eq(chatMessages.chatId, parseInt(chatId))
    ))
    .run();

  return NextResponse.json({ success: true });
}
