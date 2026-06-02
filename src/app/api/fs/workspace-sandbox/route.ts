import { NextRequest, NextResponse } from "next/server";
import { readWorkspaceMeta, writeWorkspaceMeta, type SandboxStatus } from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";

export const dynamic = "force-dynamic";

// GET /api/fs/workspace-sandbox - 获取工作区沙盒状态
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegments = searchParams.get("dirSegments");

  if (!dirSegments) {
    return NextResponse.json({ error: "缺少 dirSegments 参数" }, { status: 400 });
  }

  const segments = dirSegments.split(",");
  const meta = readWorkspaceMeta(segments);

  if (!meta) {
    return NextResponse.json({ error: "工作区不存在" }, { status: 404 });
  }

  return NextResponse.json({ sandbox: meta.sandbox ?? { enabled: false } });
}

// POST /api/fs/workspace-sandbox - 申请沙盒
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, sandbox } = body as {
    dirSegments: string[];
    sandbox: SandboxStatus;
  };

  if (!dirSegments || !sandbox) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "工作区不存在" }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeWorkspaceMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "sandbox",
    action: "create",
    detail: "申请了沙盒环境",
  });

  return NextResponse.json({ sandbox: meta.sandbox });
}

// PUT /api/fs/workspace-sandbox - 释放沙盒
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, sandbox } = body as {
    dirSegments: string[];
    sandbox: SandboxStatus;
  };

  if (!dirSegments || !sandbox) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "工作区不存在" }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeWorkspaceMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "sandbox",
    action: "delete",
    detail: "释放了沙盒环境",
  });

  return NextResponse.json({ sandbox: meta.sandbox });
}
