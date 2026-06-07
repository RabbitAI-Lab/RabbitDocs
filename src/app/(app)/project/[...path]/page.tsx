import { listTree, readDocument, readProjectMeta, stripTreePrefix } from "@/lib/fs";
import { db } from "@/db";
import { chats, documentActivities, users } from "@/db/schema";
import { gte, desc, eq, and } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/tokens";
import ProjectWorkspace from "@/components/project/ProjectWorkspace";
import { getRecentCutoff } from "@/lib/time";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ file?: string; chatId?: string; tab?: string; openChat?: string }>;
}) {
  const { path: rawPath } = await params;
  const path = rawPath.map(decodeURIComponent);
  const { file: rawFile, chatId: chatIdParam, tab: rawTab, openChat: rawOpenChat } = await searchParams;

  // 验证用户身份（从 cookie 获取 access token）
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  let currentUserId: string | null = null;
  if (accessToken) {
    const payload = await verifyToken(accessToken);
    if (payload && payload.type === "access") {
      currentUserId = payload.sub;
    }
  }
  void currentUserId; // reserved for future per-project access control

  // path = ["{projectId}"]
  if (path.length < 1) notFound();

  const projectId = path[0];
  const projectDirSegments = ["projects", projectId];
  const docsDirSegments = [...projectDirSegments, "docs"];
  const docsPrefix = docsDirSegments.join("/"); // "projects/{projectId}/docs"

  // Get file tree (paths are like "projects/{projectId}/docs/subdir/file.md")
  const rawTree = listTree(docsDirSegments, [".md", ".html"])

  // Strip docs prefix and .md extension from tree paths
  const tree = stripTreePrefix(rawTree, docsPrefix);

  // Build root tree for workspace view (all file types)
  const projectPrefix = projectDirSegments.join("/");
  const rawRootTree = listTree(projectDirSegments, []);
  const rootTree = stripTreePrefix(rawRootTree, projectPrefix);

  // Get selected file content (only when explicitly requested via ?file=)
  let selectedFile: string | null = null;
  let fileContent: string | null = null;

  if (rawFile) {
    selectedFile = decodeURIComponent(rawFile);
    const fileSegments = [...projectDirSegments, "docs", ...selectedFile.split("/")];
    fileContent = readDocument(...fileSegments);
  }

  // Read project metadata
  const projectMeta = readProjectMeta(projectDirSegments);
  const projectName = projectMeta?.name || projectId;

  // Resolve owner user info (name + email fallback)
  let ownerUser: { name: string | null; email: string } | null = null;
  if (projectMeta?.ownerId) {
    ownerUser = db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, projectMeta.ownerId))
      .get() ?? null;
  }

  // Resolve account info
  const accountInfo = {
    accountName: projectMeta?.accountId || projectId,
    orgName: undefined as string | undefined,
    enterpriseName: undefined as string | undefined,
  };

  // Fetch recent chats for this project (last 20 days)
  // 跟着项目走：该项目下所有 chat 对所有访问者可见
  const twentyDaysAgo = getRecentCutoff();
  const chatConditions = [
    gte(chats.updatedAt, twentyDaysAgo),
    eq(chats.projectId, projectId),
  ];
  const modifierUser = aliasedTable(users, "modifier_user");

  const recentChats = db
    .select({
      id: chats.id,
      title: chats.title,
      updatedAt: chats.updatedAt,
      projectId: chats.projectId,
      creatorName: users.name,
      creatorEmail: users.email,
      modifierName: modifierUser.name,
      modifierEmail: modifierUser.email,
    })
    .from(chats)
    .leftJoin(users, eq(chats.userId, users.id))
    .leftJoin(modifierUser, eq(chats.updatedBy, modifierUser.id))
    .where(and(...chatConditions))
    .orderBy(desc(chats.updatedAt))
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt,
      projectId: row.projectId,
      creatorName: row.creatorName ?? row.creatorEmail,
      modifierName: row.modifierName ?? row.modifierEmail,
    }));

  // Fetch recent document activities for this project (last 20 days)
  const recentDocuments = db
    .select({
      id: documentActivities.id,
      projectId: documentActivities.projectId,
      documentPath: documentActivities.documentPath,
      documentTitle: documentActivities.documentTitle,
      action: documentActivities.action,
      oldTitle: documentActivities.oldTitle,
      userId: documentActivities.userId,
      userName: users.name,
      userEmail: users.email,
      createdAt: documentActivities.createdAt,
    })
    .from(documentActivities)
    .leftJoin(users, eq(documentActivities.userId, users.id))
    .where(and(
      eq(documentActivities.projectId, projectId),
      gte(documentActivities.createdAt, twentyDaysAgo)
    ))
    .orderBy(desc(documentActivities.createdAt))
    .limit(20)
    .all()
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      documentPath: row.documentPath,
      documentTitle: row.documentTitle,
      action: row.action,
      oldTitle: row.oldTitle,
      userId: row.userId,
      userName: row.userName ?? row.userEmail,
      createdAt: row.createdAt,
    }));

  const PROJECT_SUB_TABS = ["activity", "integration", "skills", "mcp", "members", "log"] as const;
  const initialSubTab = PROJECT_SUB_TABS.includes(rawTab as typeof PROJECT_SUB_TABS[number])
    ? rawTab as typeof PROJECT_SUB_TABS[number]
    : "activity";

  return (
    <ProjectWorkspace
      projectName={projectName}
      projectPath={projectDirSegments.join("/")}
      docsPath={docsPrefix}
      tree={tree}
      rootTree={rootTree}
      rootPath={projectPrefix}
      selectedFile={selectedFile}
      initialContent={fileContent || ""}
      projectMeta={projectMeta}
      accountInfo={accountInfo}
      recentChats={recentChats}
      recentDocuments={recentDocuments}
      ownerUser={ownerUser}
      initialChatId={chatIdParam ? parseInt(chatIdParam) : undefined}
      initialSubTab={initialSubTab}
      autoOpenChat={rawOpenChat === "true"}
    />
  );
}
