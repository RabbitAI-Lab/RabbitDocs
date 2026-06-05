import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { execSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  readProjectMeta,
  writeProjectMeta,
  getDataRoot,
} from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

function resolveClaudeCli(): string | null {
  // 1. 环境变量优先
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH;
  // 2. 自动检测 PATH 中的 claude
  try {
    const found = execFileSync("which", ["claude"], { encoding: "utf-8" }).trim();
    if (found) return found;
  } catch { /* not found */ }
  return null;
}

const ECC_MARKETPLACE_PATH = path.join(process.cwd(), "vendor", "ECC-1.10.0");
const ECC_VERSION = "1.10.0";
const HUASHU_SOURCE_PATH = path.join(process.cwd(), "vendor", "huashu-3f410cf");
const HUASHU_VERSION = "3f410cf";
const COMMAND_TIMEOUT = 120_000;

// ---- ECC 纯文件安装/卸载（CLI 不可用时的回退方案）----

const ECC_CLAUDE_SUBDIRS = ["skills", "commands", "rules", "enterprise", "homunculus", "research", "team"];
const ECC_CLAUDE_FILES = ["ecc-tools.json", "identity.json", "package-manager.json"];
const ECC_PLUGIN_KEY = "everything-claude-code@everything-claude-code";
const ECC_MARKETPLACE_KEY = "everything-claude-code";

function eccFileInstall(projectDir: string): void {
  const claudeDir = path.join(projectDir, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });

  // 1. 复制 .claude 子目录（skills, commands, rules 等）
  for (const sub of ECC_CLAUDE_SUBDIRS) {
    const src = path.join(ECC_MARKETPLACE_PATH, ".claude", sub);
    if (fs.existsSync(src)) {
      const dest = path.join(claudeDir, sub);
      fs.mkdirSync(dest, { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
    }
  }

  // 2. 复制 .claude 顶层配置文件
  for (const file of ECC_CLAUDE_FILES) {
    const src = path.join(ECC_MARKETPLACE_PATH, ".claude", file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(claudeDir, file));
    }
  }

  // 3. 复制 agents 目录到 .claude/agents
  const agentsSrc = path.join(ECC_MARKETPLACE_PATH, "agents");
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(claudeDir, "agents");
    fs.mkdirSync(agentsDest, { recursive: true });
    fs.cpSync(agentsSrc, agentsDest, { recursive: true });
  }

  // 4. 更新 .claude/settings.json
  const settingsPath = path.join(claudeDir, "settings.json");
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8")); } catch { settings = {}; }
  }
  if (!settings.enabledPlugins || typeof settings.enabledPlugins !== "object") {
    settings.enabledPlugins = {};
  }
  (settings.enabledPlugins as Record<string, boolean>)[ECC_PLUGIN_KEY] = true;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function eccFileUninstall(projectDir: string): void {
  const claudeDir = path.join(projectDir, ".claude");

  // 1. 删除 .claude 子目录中的 ECC 内容
  for (const sub of ECC_CLAUDE_SUBDIRS) {
    const dest = path.join(claudeDir, sub);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  }

  // 2. 删除 .claude 顶层配置文件
  for (const file of ECC_CLAUDE_FILES) {
    const fp = path.join(claudeDir, file);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  // 3. 删除 agents 目录
  const agentsDest = path.join(claudeDir, "agents");
  if (fs.existsSync(agentsDest)) {
    fs.rmSync(agentsDest, { recursive: true, force: true });
  }

  // 4. 更新 .claude/settings.json
  const settingsPath = path.join(claudeDir, "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      if (settings.enabledPlugins) {
        delete (settings.enabledPlugins as Record<string, boolean>)[ECC_PLUGIN_KEY];
      }
      if (settings.extraKnownMarketplaces) {
        delete (settings.extraKnownMarketplaces as Record<string, unknown>)[ECC_MARKETPLACE_KEY];
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch { /* ignore parse errors */ }
  }
}

// GET /api/fs/project-skills - 获取项目 Skills 状态
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const dirSegments = searchParams.get("dirSegments");
  const t = await getApiT();

  if (!dirSegments) {
    return NextResponse.json(
      { error: t('api.dirSegmentsRequired') },
      { status: 400 }
    );
  }

  const segments = dirSegments.split(",");
  const meta = readProjectMeta(segments);

  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
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

// PUT /api/fs/project-skills - 启用/禁用 Skill
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, skillId, enabled } = body as {
    dirSegments: string[];
    skillId: "ecc" | "huashu";
    enabled: boolean;
  };

  if (!dirSegments || !skillId) {
    return NextResponse.json(
      { error: t('api.missingRequiredParams') },
      { status: 400 }
    );
  }

  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }

  const projectDir = path.join(getDataRoot(), ...dirSegments);

  const action = enabled ? "启用" : "禁用";
  console.log(`[Skills] === ${action} Skill 开始 ===`);
  console.log(`[Skills] skillId=${skillId}, enabled=${enabled}`);
  console.log(`[Skills] dirSegments=${JSON.stringify(dirSegments)}`);
  console.log(`[Skills] projectDir=${projectDir}`);
  console.log(`[Skills] DATA_ROOT=${getDataRoot()}`);

  try {
    if (skillId === "ecc") {
      const claudeCli = resolveClaudeCli();
      if (claudeCli) {
        console.log(`[Skills] [方案A] 使用 CLI: ${claudeCli}`);
        if (enabled) {
          const cmd1 = `"${claudeCli}" plugins marketplace add --scope project "${ECC_MARKETPLACE_PATH}"`;
          console.log(`[Skills] [方案A] 执行命令: ${cmd1}`);
          console.log(`[Skills] [方案A] cwd: ${projectDir}`);
          execSync(cmd1, { cwd: projectDir, timeout: COMMAND_TIMEOUT, stdio: "pipe" });
          console.log(`[Skills] [方案A] marketplace add 完成`);

          const cmd2 = `"${claudeCli}" plugins install --scope project everything-claude-code@everything-claude-code`;
          console.log(`[Skills] [方案A] 执行命令: ${cmd2}`);
          execSync(cmd2, { cwd: projectDir, timeout: COMMAND_TIMEOUT, stdio: "pipe" });
          console.log(`[Skills] [方案A] plugins install 完成`);
        } else {
          const cmd = `"${claudeCli}" plugins uninstall --scope project everything-claude-code@everything-claude-code`;
          console.log(`[Skills] [方案A] 执行命令: ${cmd}`);
          console.log(`[Skills] [方案A] cwd: ${projectDir}`);
          execSync(cmd, { cwd: projectDir, timeout: COMMAND_TIMEOUT, stdio: "pipe" });
          console.log(`[Skills] [方案A] plugins uninstall 完成`);
        }
      } else {
        console.log(`[Skills] [方案B] CLI 未找到，使用纯文件操作`);
        if (enabled) {
          console.log(`[Skills] [方案B] 安装: 从 ${ECC_MARKETPLACE_PATH} 复制到 ${projectDir}/.claude/`);
          eccFileInstall(projectDir);
          console.log(`[Skills] [方案B] 文件安装完成`);
        } else {
          console.log(`[Skills] [方案B] 卸载: 删除 ${projectDir}/.claude/ 下的 ECC 内容`);
          eccFileUninstall(projectDir);
          console.log(`[Skills] [方案B] 文件卸载完成`);
        }
      }
    } else if (skillId === "huashu") {
      const skillsDir = path.join(projectDir, ".claude", "skills");
      const targetPath = path.join(skillsDir, "huashu-3f410cf");
      console.log(`[Skills] [huashu] source=${HUASHU_SOURCE_PATH}`);
      console.log(`[Skills] [huashu] target=${targetPath}`);
      if (enabled) {
        fs.mkdirSync(skillsDir, { recursive: true });
        fs.cpSync(HUASHU_SOURCE_PATH, targetPath, { recursive: true });
        console.log(`[Skills] [huashu] 复制完成`);
      } else {
        fs.rmSync(targetPath, { recursive: true, force: true });
        console.log(`[Skills] [huashu] 删除完成`);
      }
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error";
    console.error(`[Skills] ${action}失败:`, message);
    return NextResponse.json(
      { error: `${action}失败`, details: message },
      { status: 500 }
    );
  }

  console.log(`[Skills] === ${action} Skill 成功 ===`);

  // CLI 命令执行成功，更新状态
  if (!meta.skills) meta.skills = {};
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
  writeProjectMeta(meta, dirSegments);

  logOperation({
    projectId: extractProjectId(dirSegments),
    category: "skills",
    action: enabled ? "enable" : "disable",
    detail: `${enabled ? "启用" : "禁用"}了 Skill: ${skillId}`,
  });

  return NextResponse.json({ skills: meta.skills });
}
