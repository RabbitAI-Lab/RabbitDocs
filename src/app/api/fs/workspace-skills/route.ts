import { NextRequest, NextResponse } from "next/server";
import { readWorkspaceMeta, writeWorkspaceMeta, type ProjectSkills } from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";

export const dynamic = "force-dynamic";

const ECC_VERSION = "1.10.0";
const HUASHU_VERSION = "3f410cf";

// GET /api/fs/workspace-skills - 获取工作区 Skills 状态
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
  const meta = readWorkspaceMeta(segments);

  if (!meta) {
    return NextResponse.json({ error: "工作区不存在" }, { status: 404 });
  }

  const skills = meta.skills
    ? {
        ecc: {
          enabled: false,
          ...meta.skills.ecc,
          version: meta.skills.ecc?.version || ECC_VERSION,
        },
        huashu: {
          enabled: false,
          ...meta.skills.huashu,
          version: meta.skills.huashu?.version || HUASHU_VERSION,
        },
      }
    : {
        ecc: { enabled: false, version: ECC_VERSION },
        huashu: { enabled: false, version: HUASHU_VERSION },
      };

  return NextResponse.json({ skills });
}

// PUT /api/fs/workspace-skills - 启用/禁用 Skill
// 注意：工作区级别的 skills 仅修改 meta，不执行 CLI 副作用（计划中明确说明）
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, skillId, enabled } = body as {
    dirSegments: string[];
    skillId: "ecc" | "huashu";
    enabled: boolean;
  };

  if (!dirSegments || !skillId) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    );
  }

  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "工作区不存在" }, { status: 404 });
  }

  if (!meta.skills) meta.skills = {} as ProjectSkills;
  const version = skillId === "ecc" ? ECC_VERSION : HUASHU_VERSION;
  if (enabled) {
    meta.skills[skillId] = {
      enabled: true,
      installedAt: new Date().toISOString(),
      version,
    };
  } else {
    meta.skills[skillId] = {
      enabled: false,
      uninstalledAt: new Date().toISOString(),
      version: meta.skills[skillId]?.version,
    };
  }
  writeWorkspaceMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "skills",
    action: enabled ? "enable" : "disable",
    detail: `${enabled ? "启用" : "禁用"}了 Skill: ${skillId}`,
  });

  return NextResponse.json({ skills: meta.skills });
}
