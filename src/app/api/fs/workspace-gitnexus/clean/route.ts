import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readWorkspaceMeta } from "@/lib/fs";
import { cancelGitNexus, runGitNexus } from "@/lib/gitnexus-service";
import { logOperation } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// POST /api/fs/workspace-gitnexus/clean
// Body: { dirSegments: string[], action: "clean" | "cancel" }
// 行为：清理或取消工作空间根的 GitNexus 任务。
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, action } = body;

  if (!dirSegments || !action) {
    return NextResponse.json(
      { error: t('api.dirSegmentsRequired') },
      { status: 400 }
    );
  }

  if (action !== "clean" && action !== "cancel") {
    return NextResponse.json(
      { error: t('api.gitnexus.actionMustBeCleanOrCancel') },
      { status: 400 }
    );
  }

  try {
    const meta = readWorkspaceMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });
    }

    if (action === "cancel") {
      const cancelled = cancelGitNexus("workspace", dirSegments);
      if (!cancelled) {
        return NextResponse.json(
          { error: t('api.gitnexus.noRunningTaskToCancel') },
          { status: 409 }
        );
      }
      logOperation({
        projectId: dirSegments[dirSegments.length - 1],
        category: "repository",
        action: "update",
        detail: "GitNexus cancel 工作空间根",
      });
      return NextResponse.json({ cancelled: true });
    }

    const result = runGitNexus({
      scope: "workspace",
      dirSegments,
      command: "clean",
    });

    if (!result.started) {
      if (result.reason === "already_running") {
        return NextResponse.json(
          { error: t('api.gitnexus.anotherTaskRunning') },
          { status: 409 }
        );
      }
      if (result.reason === "path_not_found") {
        return NextResponse.json(
          { error: t('api.gitnexus.workspaceRootNotFound') },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: t('api.gitnexus.failedToStartClean') }, { status: 500 });
    }

    logOperation({
      projectId: dirSegments[dirSegments.length - 1],
      category: "repository",
      action: "update",
      detail: "GitNexus clean 工作空间根",
    });

    return NextResponse.json({ started: true, status: result.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
