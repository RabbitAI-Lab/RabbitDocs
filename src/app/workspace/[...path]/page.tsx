import { readWorkspaceMeta, listWorkspaceProjects } from "@/lib/fs";
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

  const projects = listWorkspaceProjects(
    accountType as "personal" | "enterprise",
    accountId,
    workspaceId,
  );

  return (
    <WorkspaceDetail
      workspaceMeta={workspaceMeta}
      projects={projects}
      accountType={accountType}
      accountId={accountId}
    />
  );
}
