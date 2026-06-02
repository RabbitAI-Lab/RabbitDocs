import { db } from "@/db";
import { sharedChats, chats, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import SharedChatView from "@/components/chat/SharedChatView";

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = db
    .select()
    .from(sharedChats)
    .where(eq(sharedChats.token, token))
    .get();
  if (!share) notFound();

  const chat = db.select().from(chats).where(eq(chats.id, share.chatId)).get();
  if (!chat) notFound();

  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chat.id))
    .all();

  return (
    <SharedChatView
      title={chat.title}
      messages={messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))}
    />
  );
}
