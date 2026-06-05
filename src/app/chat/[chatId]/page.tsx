import { db } from "@/db";
import { chats, chatMessages, documentActivities } from "@/db/schema";
import { gte, desc, eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/tokens";
import { listTree, readProjectMeta, stripTreePrefix, type TreeNode, type ProjectMeta } from "@/lib/fs";
import ChatPageContent from "@/components/chat/ChatPageContent";
import { canAccessChat } from "@/lib/auth/chat-access";

/**
 * 根据项目 ID 查找项目的实际目录段。
 * 优先从当前用户目录查找（支持 symlink），回退到遍历所有用户目录。
 */
function findProjectDirSegments(projectId: string, userId: string | null): string[] | null {
  // 1. 先查当前用户目录（通过 symlink 可能指向所有者的项目）
  if (userId) {
    const segs = ["personal", userId, "projects", projectId];
    const meta = readProjectMeta(segs);
    if (meta) return segs;
  }
  // 2. 回退到 default（兼容迁移前数据）
  const defaultSegs = ["personal", "default", "projects", projectId];
  const meta = readProjectMeta(defaultSegs);
  if (meta) return defaultSegs;
  return null;
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  // 验证用户身份
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  let currentUserId: string | null = null;
  if (accessToken) {
    const payload = await verifyToken(accessToken);
    if (payload && payload.type === "access") {
      currentUserId = payload.sub;
    }
  }

  // 查询 chat，通过 canAccessChat 做权限检查（支持项目/工作空间成员访问）
  const chat = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  if (!chat) notFound();

  if (currentUserId) {
    const auth = { id: currentUserId, isAdmin: false };
    if (!canAccessChat(auth, chat)) notFound();
  } else {
    // 未登录用户只可见旧数据（userId 为 null）
    if (chat.userId) notFound();
  }

  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, parseInt(chatId)))
    .all();

  let initialTree: TreeNode[] = [];
  let projectName: string | undefined;
  let projectMeta: ProjectMeta | null = null;
  let recentChats: Array<{ id: number; title: string; updatedAt: string }> = [];
  let recentDocuments: Array<typeof documentActivities.$inferSelect> = [];

  if (chat.projectId) {
    const projectDirSegments = findProjectDirSegments(chat.projectId, currentUserId);
    if (projectDirSegments) {
      const projectPrefix = projectDirSegments.concat("docs").join("/");
      const rawTree = listTree([...projectDirSegments, "docs"], [".md", ".html"]);
      initialTree = stripTreePrefix(rawTree, projectPrefix);
      const meta = readProjectMeta(projectDirSegments);
      projectName = meta?.name;
      projectMeta = meta;
    }

    // recentChats: 跟着项目走，该项目下所有 chat 对所有人可见
    // eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() is stable per request
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const chatFilterConditions = [
      gte(chats.updatedAt, twentyDaysAgo),
      eq(chats.projectId, chat.projectId!),
    ];
    recentChats = db
      .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
      .from(chats)
      .where(and(...chatFilterConditions))
      .orderBy(desc(chats.updatedAt))
      .all();

    recentDocuments = db
      .select()
      .from(documentActivities)
      .where(and(
        eq(documentActivities.projectId, chat.projectId),
        gte(documentActivities.createdAt, twentyDaysAgo)
      ))
      .orderBy(desc(documentActivities.createdAt))
      .limit(20)
      .all();
  }

  return (
    <ChatPageContent
      key={chat.id}
      chatId={chat.id}
      chatTitle={chat.title}
      initialMessages={messages.map((m) => ({ ...m, isError: !!m.isError }))}
      initialModelId={chat.modelId ?? undefined}
      initialTemplateId={chat.templateId ?? undefined}
      projectId={chat.projectId ?? undefined}
      initialTree={initialTree}
      projectName={projectName}
      projectMeta={projectMeta}
      recentChats={recentChats}
      recentDocuments={recentDocuments}
    />
  );
}
