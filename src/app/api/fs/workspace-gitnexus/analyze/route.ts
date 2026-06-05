import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readWorkspaceMeta } from "@/lib/fs";
import { runGitNexus } from "@/lib/gitnexus-service";
import { logOperation } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// POST /api/fs/workspace-gitnexus/analyze
// Body: { dirSegments: string[] }
// 行为：在工作空间根目录上启动 gitnexus analyze。
//       --force 与 --skip-git 由 API 强制启用。
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments } = body;

  if (!dirSegments) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }

  try {
    const meta = readWorkspaceMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });
    }

    const result = runGitNexus({
      scope: "workspace",
      dirSegments,
      command: "analyze",
      force: true,
      skipGit: true,
    });

    if (!result.started) {
      if (result.reason === "already_running") {
        return NextResponse.json(
          { error: t('api.gitnexus.analyzeAlreadyRunning'), status: result.status },
          { status: 409 }
        );
      }
      if (result.reason === "path_not_found") {
        return NextResponse.json(
          { error: t('api.gitnexus.workspaceRootNotFound') },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: t('api.gitnexus.failedToStartAnalyze') }, { status: 500 });
    }

    logOperation({
      projectId: dirSegments[dirSegments.length - 1],
      category: "repository",
      action: "update",
      detail: "GitNexus analyze 工作空间根 (force, skip-git)",
    });

    return NextResponse.json({ started: true, status: result.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
