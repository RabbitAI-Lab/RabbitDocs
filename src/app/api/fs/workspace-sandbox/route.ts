import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readWorkspaceMeta, writeWorkspaceMeta, type SandboxStatus } from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/fs/workspace-sandbox - 获取工作区沙盒状态
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const dirSegments = searchParams.get("dirSegments");
  const t = await getApiT();

  if (!dirSegments) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }

  const segments = dirSegments.split(",");
  const meta = readWorkspaceMeta(segments);

  if (!meta) {
    return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });
  }

  return NextResponse.json({ sandbox: meta.sandbox ?? { enabled: false } });
}

// POST /api/fs/workspace-sandbox - 申请沙盒
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, sandbox } = body as {
    dirSegments: string[];
    sandbox: SandboxStatus;
  };

  if (!dirSegments || !sandbox) {
    return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });
  }

  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeWorkspaceMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "sandbox",
    action: "create",
    detail: t('api.sandbox.sandboxApply'),
  });

  return NextResponse.json({ sandbox: meta.sandbox });
}

// PUT /api/fs/workspace-sandbox - 释放沙盒
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, sandbox } = body as {
    dirSegments: string[];
    sandbox: SandboxStatus;
  };

  if (!dirSegments || !sandbox) {
    return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });
  }

  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.workspaceNotFound') }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeWorkspaceMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "sandbox",
    action: "delete",
    detail: t('api.sandbox.sandboxRelease'),
  });

  return NextResponse.json({ sandbox: meta.sandbox });
}
