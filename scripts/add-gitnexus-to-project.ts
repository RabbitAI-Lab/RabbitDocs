/**
 * 一次性脚本：将 GitNexus MCP server 合并到项目 A 的 .mcp.json
 *
 * 行为：
 *   - 读  data/personal/default/projects/74ea3479-c1d1-47f4-909e-67369bf444b7/.mcp.json
 *   - 若 mcpServers.gitnexus 不存在则合并；已存在则跳过（幂等）
 *   - 保留 mcpServers.zhipu-web-search-sse 与 _apiKeys
 *   - 原子写：先写 .mcp.json.tmp 再 rename
 *
 * 运行：  npx tsx scripts/add-gitnexus-to-project.ts
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = "74ea3479-c1d1-47f4-909e-67369bf444b7";
const DIR_SEGMENTS = ["personal", "default", "projects", PROJECT_ID];

const DATA_ROOT = path.join(os.homedir(), ".rabbitdocs", "data");
const CONFIG_PATH = path.join(DATA_ROOT, ...DIR_SEGMENTS, ".mcp.json");
const TMP_PATH = CONFIG_PATH + ".tmp"; // keep for future atomic write
void TMP_PATH;

const GITNEXUS_ENTRY = {
  type: "stdio",
  command: "npx",
  args: ["-y", "gitnexus@latest", "mcp"],
} as const;

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`[FATAL] 无法解析 ${filePath}：`, err);
    process.exit(1);
  }
}

function atomicWriteJson(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath + ".tmp", JSON.stringify(payload, null, 2), "utf-8");
  fs.renameSync(filePath + ".tmp", filePath);
}

function main() {
  console.log(`[INFO] 目标文件: ${CONFIG_PATH}`);

  if (!fs.existsSync(path.dirname(CONFIG_PATH))) {
    console.error(`[FATAL] 项目目录不存在: ${path.dirname(CONFIG_PATH)}`);
    process.exit(1);
  }

  const existing = readJsonSafe(CONFIG_PATH) ?? {};

  const mcpServers = (existing.mcpServers && typeof existing.mcpServers === "object"
    ? (existing.mcpServers as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  if (mcpServers["gitnexus"]) {
    console.log("[SKIP] mcpServers.gitnexus 已存在，无需合并。");
    return;
  }

  mcpServers["gitnexus"] = GITNEXUS_ENTRY;

  const next: Record<string, unknown> = {
    ...existing,
    mcpServers,
  };

  // 保留原有 _apiKeys 字段（zhipu 等已保存的 key 不能丢）
  if (existing._apiKeys && typeof existing._apiKeys === "object") {
    next._apiKeys = existing._apiKeys;
  }

  atomicWriteJson(CONFIG_PATH, next);

  console.log("[OK] 已合并 gitnexus，原子写完成。");
  console.log("---- 写入后的 .mcp.json ----");
  console.log(JSON.stringify(next, null, 2));
}

main();
