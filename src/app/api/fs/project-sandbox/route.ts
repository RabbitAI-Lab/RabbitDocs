import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readProjectMeta, writeProjectMeta, type SandboxStatus } from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/fs/project-sandbox - 获取项目沙盒状态
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const dirSegments = searchParams.get("dirSegments");
  const t = await getApiT();

  if (!dirSegments) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }

  const segments = dirSegments.split(",");
  const meta = readProjectMeta(segments);

  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }

  return NextResponse.json({ sandbox: meta.sandbox ?? { enabled: false } });
}

// POST /api/fs/project-sandbox - 申请沙盒
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

  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeProjectMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "sandbox",
    action: "create",
    detail: t('api.sandbox.sandboxApply'),
  });

  return NextResponse.json({ sandbox: meta.sandbox });
}

// PUT /api/fs/project-sandbox - 释放沙盒
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

  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeProjectMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "sandbox",
    action: "delete",
    detail: t('api.sandbox.sandboxRelease'),
  });

  return NextResponse.json({ sandbox: meta.sandbox });
}