import { NextRequest, NextResponse } from "next/server";
import { readWorkspaceMeta, writeWorkspaceMeta } from "@/lib/fs";
import {
  cloneRepository,
  pullRepository,
  checkSyncStatus,
  getRepoLocalPath,
} from "@/lib/git-service";
import type { Repository } from "@/lib/fs";

// GET /api/fs/workspace-repositories/sync?dirSegments=...&repoId=...
// 获取单个仓库的同步状态
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  const repoId = searchParams.get("repoId");

  if (!dirSegmentsStr || !repoId) {
    return NextResponse.json(
      { error: "dirSegments and repoId are required" },
      { status: 400 }
    );
  }

  const dirSegments = dirSegmentsStr.split(",");

  try {
    const meta = readWorkspaceMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const repo = meta.repositories?.find((r) => r.id === repoId);
    if (!repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const localPath = getRepoLocalPath(dirSegments, repoId);
    const result = await checkSyncStatus(localPath, repo.credentials);

    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/fs/workspace-repositories/sync
// 执行同步操作 (clone 或 pull)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, repoId, action } = body;

  if (!dirSegments || !repoId || !action) {
    return NextResponse.json(
      { error: "dirSegments, repoId and action are required" },
      { status: 400 }
    );
  }

  if (action !== "clone" && action !== "pull") {
    return NextResponse.json(
      { error: "action must be 'clone' or 'pull'" },
      { status: 400 }
    );
  }

  try {
    const meta = readWorkspaceMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const repos = meta.repositories || [];
    const repoIndex = repos.findIndex((r) => r.id === repoId);
    if (repoIndex === -1) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const repo = repos[repoIndex];
    const localPath = getRepoLocalPath(dirSegments, repoId);

    let result;
    if (action === "clone") {
      result = await cloneRepository(repo.url, localPath, repo.credentials);
    } else {
      result = await pullRepository(localPath, repo.credentials);
    }

    // 更新 Repository 状态
    const now = new Date().toISOString();
    const updatedRepo: Repository = {
      ...repo,
      syncStatus: result.success ? "synced" : "error",
      lastSyncAt: result.success ? now : repo.lastSyncAt,
      lastCheckedAt: now,
      localCommitHash: result.commitHash || repo.localCommitHash,
      errorMessage: result.error,
    };

    // 更新工作区元数据
    repos[repoIndex] = updatedRepo;
    meta.repositories = repos;
    writeWorkspaceMeta(meta, dirSegments);

    return NextResponse.json({
      success: result.success,
      syncStatus: updatedRepo.syncStatus,
      commitHash: result.commitHash,
      error: result.error,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
