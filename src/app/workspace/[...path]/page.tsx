import { readWorkspaceMeta, listWorkspaceProjects } from "@/lib/fs";
import { db } from "@/db";
import { chats, documentActivities } from "@/db/schema";
import { gte, desc, inArray, and, isNotNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import WorkspaceDetail from "@/components/workspace/WorkspaceDetail";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: rawPath } = await params;
  const urlPath = rawPath.map(decodeURIComponent);

  // urlPath = ["personal", "default", "{workspaceId}"]
  if (urlPath.length < 3) notFound();

  const accountType = urlPath[0];
  const accountId = urlPath[1];
  const workspaceId = urlPath[2];

  // Build FS path: ["personal", "default", "workspace", "{workspaceId}"]
  const workspaceDirSegments = [accountType, accountId, "workspace", workspaceId];

  const workspaceMeta = readWorkspaceMeta(workspaceDirSegments);
  if (!workspaceMeta) notFound();

  const linkedProjects = listWorkspaceProjects(
    accountType as "personal" | "enterprise",
    accountId,
    workspaceId,
  );

  const projectIds = linkedProjects.map((p) => p.id);

  // 预取最近 20 天的聊天（聚合 workspace 下所有 linked projects）
  // 注意: projectId 列也是 text, workspaceId 同样可存, 但这里只查 project
  const twentyDaysAgo = new Date(
    Date.now() - 20 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const recentChats =
    projectIds.length === 0
      ? []
      : db
          .select({
            id: chats.id,
            title: chats.title,
            updatedAt: chats.updatedAt,
            projectId: chats.projectId,
          })
          .from(chats)
          .where(
            and(
              isNotNull(chats.projectId),
              inArray(chats.projectId, projectIds),
              gte(chats.updatedAt, twentyDaysAgo),
            ),
          )
          .orderBy(desc(chats.updatedAt))
          .all();

  // 预取最近 20 天的文档活动（聚合 workspace 下所有 linked projects）
  const recentDocuments =
    projectIds.length === 0
      ? []
      : db
          .select()
          .from(documentActivities)
          .where(
            and(
              inArray(documentActivities.projectId, projectIds),
              gte(documentActivities.createdAt, twentyDaysAgo),
            ),
          )
          .orderBy(desc(documentActivities.createdAt))
          .limit(20)
          .all();

  return (
    <WorkspaceDetail
      workspaceMeta={workspaceMeta}
      linkedProjects={linkedProjects}
      recentChats={recentChats}
      recentDocuments={recentDocuments}
      accountType={accountType}
      accountId={accountId}
    />
  );
}
