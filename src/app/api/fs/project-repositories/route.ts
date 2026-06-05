import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  readProjectMeta,
  addRepository,
  removeRepository,
  updateRepository,
} from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/project-repositories?dirSegments=personal,default,projects,{id}
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  const t = await getApiT();
  if (!dirSegmentsStr) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }
  const dirSegments = dirSegmentsStr.split(",");
  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }
  return NextResponse.json(meta.repositories || []);
}

// POST /api/fs/project-repositories - add a repository
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, repository } = body;
  if (!dirSegments || !repository) {
    return NextResponse.json({ error: t('api.repositories.dirSegmentsAndRepoRequired') }, { status: 400 });
  }
  try {
    const repositories = addRepository(dirSegments, repository);
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

// PATCH /api/fs/project-repositories - update a repository
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, repoId, updates } = body;
  if (!dirSegments || !repoId || !updates) {
    return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });
  }
  try {
    const updated = updateRepository(dirSegments, repoId, updates);
    if (!updated) {
      return NextResponse.json({ error: t('api.repositoryNotFound') }, { status: 404 });
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

// DELETE /api/fs/project-repositories - remove a repository
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, repoId } = body;
  if (!dirSegments || !repoId) {
    return NextResponse.json({ error: t('api.repositories.dirSegmentsRepoIdRequired') }, { status: 400 });
  }
  try {
    const meta = readProjectMeta(dirSegments);
    const repoName = meta?.repositories?.find((r) => r.id === repoId)?.name || repoId;
    removeRepository(dirSegments, repoId);
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
