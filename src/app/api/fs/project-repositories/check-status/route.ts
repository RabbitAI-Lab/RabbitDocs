import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readProjectMeta, writeProjectMeta } from "@/lib/fs";
import { checkSyncStatus, getRepoLocalPath } from "@/lib/git-service";
import type { Repository } from "@/lib/fs";
import { getApiT } from "@/lib/i18n-api";

// POST /api/fs/project-repositories/check-status
// 批量检查项目所有仓库的同步状态
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments } = body;

  if (!dirSegments) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }

  try {
    const meta = readProjectMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
    }

    const repos = meta.repositories || [];

    if (repos.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 并行检查所有仓库状态
    const results = await Promise.all(
      repos.map(async (repo) => {
        const localPath = getRepoLocalPath(dirSegments, repo.id);
        const statusResult = await checkSyncStatus(localPath, repo.credentials);

        return {
          repoId: repo.id,
          ...statusResult,
        };
      })
    );

    // 更新所有仓库的状态
    const now = new Date().toISOString();
    const updatedRepos: Repository[] = repos.map((repo, index) => {
      const result = results[index];
      return {
        ...repo,
        syncStatus: result.status,
        lastCheckedAt: now,
        localCommitHash: result.localHash,
        remoteCommitHash: result.remoteHash,
        errorMessage: result.error,
      };
    });

    // 保存更新后的元数据
    meta.repositories = updatedRepos;
    writeProjectMeta(meta, dirSegments);

    return NextResponse.json({
      results: results.map((r, i) => ({
        repoId: r.repoId,
        status: r.status,
        localHash: r.localHash,
        remoteHash: r.remoteHash,
        error: r.error,
        repoName: repos[i].name,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}