import { listTree, readDocument, readProjectMeta, stripTreePrefix, TreeNode } from "@/lib/fs";
import { db } from "@/db";
import { chats, accounts } from "@/db/schema";
import { gte, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
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

  // path = ["personal", "default", "projects", "{projectId}"]
  if (path.length < 4) notFound();

  const projectId = path[3];
  const projectDirSegments = path; // personal/default/projects/{projectId}
  const projectPrefix = projectDirSegments.join("/"); // "personal/default/projects/{projectId}"

  // Get file tree (paths are like "personal/default/projects/{projectId}/subdir/file.md")
  const rawTree = listTree(projectDirSegments);

  // Strip project prefix and .md extension from tree paths
  const tree = stripTreePrefix(rawTree, projectPrefix);

  // Get selected file content (only when explicitly requested via ?file=)
  let selectedFile: string | null = null;
  let fileContent: string | null = null;

  if (rawFile) {
    selectedFile = decodeURIComponent(rawFile);
    const fileSegments = [...projectDirSegments, ...selectedFile.split("/")];
    fileContent = readDocument(...fileSegments);
  }

  // Read project metadata
  const projectMeta = readProjectMeta(projectDirSegments);
  const projectName = projectMeta?.name || projectId;

  // Resolve account info
  const accountType = path[0]; // "personal" or "enterprise"
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

  // Fetch recent chats (last 20 days)
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const recentChats = db
    .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .where(gte(chats.updatedAt, twentyDaysAgo))
    .orderBy(desc(chats.updatedAt))
    .all();

  return (
    <ProjectWorkspace
      projectName={projectName}
      projectPath={projectPrefix}
      tree={tree}
      selectedFile={selectedFile}
      initialContent={fileContent || ""}
      projectMeta={projectMeta}
      accountInfo={accountInfo}
      recentChats={recentChats}
    />
  );
}
