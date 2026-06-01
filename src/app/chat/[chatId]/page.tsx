import { db } from "@/db";
import { chats, chatMessages } from "@/db/schema";
import { gte, desc, eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { listTree, readProjectMeta, stripTreePrefix, TreeNode, type ProjectMeta } from "@/lib/fs";
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
  let projectMeta: ProjectMeta | null = null;
  let recentChats: Array<{ id: number; title: string; updatedAt: string }> = [];

  if (chat.projectId) {
    const projectPrefix = `personal/default/projects/${chat.projectId}/docs`;
    const rawTree = listTree(["personal", "default", "projects", chat.projectId, "docs"]);
    initialTree = stripTreePrefix(rawTree, projectPrefix);
    const meta = readProjectMeta(["personal", "default", "projects", chat.projectId]);
    projectName = meta?.name;
    projectMeta = meta;

    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    recentChats = db
      .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
      .from(chats)
      .where(and(gte(chats.updatedAt, twentyDaysAgo), eq(chats.projectId, chat.projectId)))
      .orderBy(desc(chats.updatedAt))
      .all();
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
      projectMeta={projectMeta}
      recentChats={recentChats}
    />
  );
}
