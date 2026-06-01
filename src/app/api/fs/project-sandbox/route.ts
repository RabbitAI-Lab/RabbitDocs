import { NextRequest, NextResponse } from "next/server";
import { readProjectMeta, writeProjectMeta, type ProjectMeta, type SandboxStatus } from "@/lib/fs";

export const dynamic = "force-dynamic";

// GET /api/fs/project-sandbox - 获取项目沙盒状态
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegments = searchParams.get("dirSegments");

  if (!dirSegments) {
    return NextResponse.json({ error: "缺少 dirSegments 参数" }, { status: 400 });
  }

  const segments = dirSegments.split(",");
  const meta = readProjectMeta(segments);

  if (!meta) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  return NextResponse.json({ sandbox: meta.sandbox ?? { enabled: false } });
}

// POST /api/fs/project-sandbox - 申请沙盒
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, sandbox } = body as {
    dirSegments: string[];
    sandbox: SandboxStatus;
  };

  if (!dirSegments || !sandbox) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeProjectMeta(meta, dirSegments);

  return NextResponse.json({ sandbox: meta.sandbox });
}

// PUT /api/fs/project-sandbox - 释放沙盒
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, sandbox } = body as {
    dirSegments: string[];
    sandbox: SandboxStatus;
  };

  if (!dirSegments || !sandbox) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  meta.sandbox = sandbox;
  writeProjectMeta(meta, dirSegments);

  return NextResponse.json({ sandbox: meta.sandbox });
}