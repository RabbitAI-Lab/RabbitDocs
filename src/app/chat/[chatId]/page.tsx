import { db } from "@/db";
import { chats, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { listTree, readProjectMeta, stripTreePrefix, TreeNode } from "@/lib/fs";
import ChatPageContent from "@/components/chat/ChatPageContent";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const chat = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  if (!chat) notFound();

  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, parseInt(chatId)))
    .all();

  let initialTree: TreeNode[] = [];
  let projectName: string | undefined;

  if (chat.projectId) {
    const projectPrefix = `personal/default/projects/${chat.projectId}`;
    const rawTree = listTree(["personal", "default", "projects", chat.projectId]);
    initialTree = stripTreePrefix(rawTree, projectPrefix);
    const meta = readProjectMeta(["personal", "default", "projects", chat.projectId]);
    projectName = meta?.name;
  }

  return (
    <ChatPageContent
      chatId={chat.id}
      chatTitle={chat.title}
      initialMessages={messages}
      initialModelId={chat.modelId ?? undefined}
      initialTemplateId={chat.templateId ?? undefined}
      projectId={chat.projectId ?? undefined}
      initialTree={initialTree}
      projectName={projectName}
    />
  );
}
