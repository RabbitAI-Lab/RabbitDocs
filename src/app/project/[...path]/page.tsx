import { listTree, readDocument, readProjectMeta, stripTreePrefix } from "@/lib/fs";
import { db } from "@/db";
import { chats, accounts, documentActivities } from "@/db/schema";
import { gte, desc, eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/tokens";
import ProjectWorkspace from "@/components/project/ProjectWorkspace";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { path: rawPath } = await params;
  const path = rawPath.map(decodeURIComponent);
  const { file: rawFile } = await searchParams;

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

  // path = ["personal", "{accountId}", "projects", "{projectId}"]
  if (path.length < 4) notFound();

  const projectId = path[3];
  const projectDirSegments = path; // personal/default/projects/{projectId}
  const docsDirSegments = [...projectDirSegments, "docs"];
  const docsPrefix = docsDirSegments.join("/"); // "personal/default/projects/{projectId}/docs"

  // Get file tree (paths are like "personal/default/projects/{projectId}/docs/subdir/file.md")
  const rawTree = listTree(docsDirSegments, [".md", ".html"])

  // Strip docs prefix and .md extension from tree paths
  const tree = stripTreePrefix(rawTree, docsPrefix);

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

  // Resolve account info
  const _accountType = path[0]; // "personal" or "enterprise"
  void _accountType;
  const accountId = path[1];
  let accountName = accountId;
  try {
    const accountRow = db.select().from(accounts).where(eq(accounts.id, Number(accountId))).get();
    if (accountRow) accountName = accountRow.name;
  } catch {
    // fallback to accountId
  }

  const accountInfo = {
    accountName,
    orgName: undefined as string | undefined,
    enterpriseName: undefined as string | undefined,
  };

  // Fetch recent chats for this project (last 20 days)
  // 跟着项目走：该项目下所有 chat 对所有访问者可见
  // eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() is stable per request
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const chatConditions = [
    gte(chats.updatedAt, twentyDaysAgo),
    eq(chats.projectId, projectId),
  ];
  const recentChats = db
    .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .where(and(...chatConditions))
    .orderBy(desc(chats.updatedAt))
    .all();

  // Fetch recent document activities for this project (last 20 days)
  const recentDocuments = db
    .select()
    .from(documentActivities)
    .where(and(
      eq(documentActivities.projectId, projectId),
      gte(documentActivities.createdAt, twentyDaysAgo)
    ))
    .orderBy(desc(documentActivities.createdAt))
    .limit(20)
    .all();

  return (
    <ProjectWorkspace
      projectName={projectName}
      projectPath={projectDirSegments.join("/")}
      docsPath={docsPrefix}
      tree={tree}
      selectedFile={selectedFile}
      initialContent={fileContent || ""}
      projectMeta={projectMeta}
      accountInfo={accountInfo}
      recentChats={recentChats}
      recentDocuments={recentDocuments}
    />
  );
}
