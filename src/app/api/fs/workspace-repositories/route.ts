import { NextRequest, NextResponse } from "next/server";
import {
  readWorkspaceMeta,
  addWorkspaceRepository,
  removeWorkspaceRepository,
  updateWorkspaceRepository,
} from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";

// GET /api/fs/workspace-repositories?dirSegments=personal,default,workspace,{id}
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  if (!dirSegmentsStr) {
    return NextResponse.json({ error: "dirSegments is required" }, { status: 400 });
  }
  const dirSegments = dirSegmentsStr.split(",");
  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return NextResponse.json(meta.repositories || []);
}

// POST /api/fs/workspace-repositories - add a repository
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, repository } = body;
  if (!dirSegments || !repository) {
    return NextResponse.json({ error: "dirSegments and repository are required" }, { status: 400 });
  }
  try {
    const repositories = addWorkspaceRepository(dirSegments, repository);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "repository",
      action: "create",
      detail: `添加了代码库 ${repository.name}`,
    });
    return NextResponse.json(repositories);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// PATCH /api/fs/workspace-repositories - update a repository
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, repoId, updates } = body;
  if (!dirSegments || !repoId || !updates) {
    return NextResponse.json({ error: "dirSegments, repoId and updates are required" }, { status: 400 });
  }
  try {
    const updated = updateWorkspaceRepository(dirSegments, repoId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "repository",
      action: "update",
      detail: `更新了代码库 ${updated.name}`,
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// DELETE /api/fs/workspace-repositories - remove a repository
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, repoId } = body;
  if (!dirSegments || !repoId) {
    return NextResponse.json({ error: "dirSegments and repoId are required" }, { status: 400 });
  }
  try {
    const meta = readWorkspaceMeta(dirSegments);
    const repoName = meta?.repositories?.find((r) => r.id === repoId)?.name || repoId;
    removeWorkspaceRepository(dirSegments, repoId);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "repository",
      action: "delete",
      detail: `删除了代码库 ${repoName}`,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
