import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readWorkspaceMeta, writeWorkspaceMeta } from "@/lib/fs";
import { refreshIndexExists, isGitNexusRunning } from "@/lib/gitnexus-service";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/fs/workspace-gitnexus?dirSegments=...
// 返回 { status: GitNexusStatus | null, indexExists: boolean }
// 工作空间级单例：不再 per-repo 拆分。
// 额外：孤儿状态自愈 — 若 phase 是 analyzing/cleaning 但内存 tasks 中无对应任务
// （dev server 重启 / 进程崩溃导致），自动重置为 idle 并附提示。
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  const t = await getApiT();
  if (!dirSegmentsStr) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }
  const dirSegments = dirSegmentsStr.split(",");

  try {
    const meta = readWorkspaceMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });
    }

    const indexExists = refreshIndexExists("workspace", dirSegments);

    // 孤儿状态自愈：phase 还在 in-progress，但内存里已经没有任务在跑了
    let status = meta.gitnexusStatus || null;
    if (
      status &&
      (status.phase === "analyzing" || status.phase === "cleaning") &&
      !isGitNexusRunning(dirSegments)
    ) {
      console.log(
        `[gitnexus] reconcile orphan status: scope=workspace dirSegments=${JSON.stringify(dirSegments)} phase=${status.phase} -> idle`
      );
      status = {
        ...status,
        phase: "idle",
        lastError: "Process interrupted (server restart or crash). Please retry.",
      };
      meta.gitnexusStatus = status;
      writeWorkspaceMeta(meta, dirSegments);
    }

    return NextResponse.json({
      status,
      indexExists,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
