import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readProjectMeta } from "@/lib/fs";
import { runGitNexus } from "@/lib/gitnexus-service";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// POST /api/fs/project-gitnexus/analyze
// Body: { dirSegments: string[] }
// 行为：在项目根目录（data/personal/default/projects/{projectId}）上启动 gitnexus analyze。
//       --force 与 --skip-git 由 API 强制启用，不再由前端传入。
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

    const result = runGitNexus({
      scope: "project",
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
          { error: t('api.gitnexus.projectRootNotFound') },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: t('api.gitnexus.failedToStartAnalyze') }, { status: 500 });
    }

    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "repository",
      action: "update",
      detail: "GitNexus analyze 项目根 (force, skip-git)",
    });

    return NextResponse.json({ started: true, status: result.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
