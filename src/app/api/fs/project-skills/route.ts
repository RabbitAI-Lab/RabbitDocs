import { NextRequest, NextResponse } from "next/server";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  readProjectMeta,
  writeProjectMeta,
  getDataRoot,
  type ProjectMeta,
  type ProjectSkills,
} from "@/lib/fs";

export const dynamic = "force-dynamic";

const CLAUDE_CLI = "/Users/xujialiang/.local/bin/claude";
const ECC_MARKETPLACE_PATH = path.join(process.cwd(), "vendor", "ECC-1.10.0");
const ECC_VERSION = "1.10.0";
const COMMAND_TIMEOUT = 120_000;

// GET /api/fs/project-skills - 获取项目 Skills 状态
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegments = searchParams.get("dirSegments");

  if (!dirSegments) {
    return NextResponse.json(
      { error: "缺少 dirSegments 参数" },
      { status: 400 }
    );
  }

  const segments = dirSegments.split(",");
  const meta = readProjectMeta(segments);

  if (!meta) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  return NextResponse.json({
    skills: meta.skills || { ecc: { enabled: false } },
  });
}

// PUT /api/fs/project-skills - 启用/禁用 Skill
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, skillId, enabled } = body as {
    dirSegments: string[];
    skillId: "ecc";
    enabled: boolean;
  };

  if (!dirSegments || !skillId) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    );
  }

  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const projectDir = path.join(getDataRoot(), ...dirSegments);

  try {
    if (enabled) {
      // 启用 ECC：先添加 marketplace，再安装 plugin
      execSync(
        `"${CLAUDE_CLI}" plugins marketplace add --scope project "${ECC_MARKETPLACE_PATH}"`,
        { cwd: projectDir, timeout: COMMAND_TIMEOUT, stdio: "pipe" }
      );
      execSync(
        `"${CLAUDE_CLI}" plugins install --scope project everything-claude-code@everything-claude-code`,
        { cwd: projectDir, timeout: COMMAND_TIMEOUT, stdio: "pipe" }
      );
    } else {
      // 禁用 ECC：卸载 plugin
      execSync(
        `"${CLAUDE_CLI}" plugins uninstall everything-claude-code@everything-claude-code`,
        { cwd: projectDir, timeout: COMMAND_TIMEOUT, stdio: "pipe" }
      );
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error";
    return NextResponse.json(
      { error: `${enabled ? "安装" : "卸载"}失败`, details: message },
      { status: 500 }
    );
  }

  // CLI 命令执行成功，更新状态
  if (!meta.skills) meta.skills = {};
  if (enabled) {
    meta.skills[skillId] = {
      enabled: true,
      installedAt: new Date().toISOString(),
      version: ECC_VERSION,
    };
  } else {
    meta.skills[skillId] = {
      enabled: false,
      uninstalledAt: new Date().toISOString(),
      version: meta.skills[skillId]?.version,
    };
  }
  writeProjectMeta(meta, dirSegments);

  return NextResponse.json({ skills: meta.skills });
}
