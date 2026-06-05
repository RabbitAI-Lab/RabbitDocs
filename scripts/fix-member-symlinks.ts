/**
 * 修复脚本：为历史成员数据补建 symlink 和 DB 索引
 *
 * 背景：之前的代码使用 projectPath.split(",") 但 projectPath 实际是 "/" 分隔，
 * 导致 dirSegments.length < 4，成员添加时未创建 symlink 和 DB 索引。
 *
 * 用法: npx tsx scripts/fix-member-symlinks.ts
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

const RABBITDOCS_HOME =
  process.env.RABBITDOCS_HOME ||
  path.join(os.homedir(), ".rabbitdocs");
const DB_PATH = path.join(RABBITDOCS_HOME, "data.db");
const DATA_ROOT_ARG = process.argv[2];

function getDataRoot(): string {
  if (DATA_ROOT_ARG) return DATA_ROOT_ARG;
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const row = db.prepare("SELECT storage_path FROM storage_config LIMIT 1").get() as { storage_path: string } | undefined;
    db.close();
    if (row?.storage_path) return row.storage_path;
  } catch { /* ignore */ }
  const localData = path.join(process.cwd(), "data");
  if (fs.existsSync(localData)) return localData;
  return path.join(RABBITDOCS_HOME, "data");
}

interface ProjectMember {
  id: string;
  accountName: string;
  role?: string;
  userId?: string;
  addedAt: string;
}

interface ProjectMeta {
  id: string;
  name: string;
  members?: ProjectMember[];
  [key: string]: unknown;
}

function main() {
  console.log("=== ChatWiki 修复成员 symlink + DB 索引 ===\n");

  const dataRoot = getDataRoot();
  console.log(`Data root: ${dataRoot}`);

  let db: Database.Database;
  try {
    db = new Database(DB_PATH);
  } catch (e) {
    console.error("无法打开数据库:", e);
    process.exit(1);
  }

  const personalDir = path.join(dataRoot, "personal");
  if (!fs.existsSync(personalDir)) {
    console.log("'personal' 目录不存在，无需修复。");
    db.close();
    return;
  }

  let symlinksCreated = 0;
  let dbEntriesInserted = 0;
  let projectsScanned = 0;

  // 遍历所有用户目录
  const userDirs = fs.readdirSync(personalDir, { withFileTypes: true });
  for (const userDir of userDirs) {
    if (!userDir.isDirectory()) continue;
    const ownerId = userDir.name;
    const projectsDir = path.join(personalDir, ownerId, "projects");
    if (!fs.existsSync(projectsDir)) continue;

    // 遍历所有项目
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const projDir of projectDirs) {
      if (!projDir.isDirectory()) continue;
      const entityId = projDir.name;
      const metaFile = path.join(projectsDir, entityId, ".project.json");
      if (!fs.existsSync(metaFile)) continue;

      projectsScanned++;
      let meta: ProjectMeta;
      try {
        meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
      } catch {
        console.warn(`  跳过无效 JSON: ${metaFile}`);
        continue;
      }

      if (!meta.members || meta.members.length === 0) continue;

      for (const member of meta.members) {
        if (!member.userId) {
          console.log(`  [跳过] 项目 ${entityId} 成员 ${member.accountName} 无 userId`);
          continue;
        }

        // 1. 补建 symlink
        const memberProjectsDir = path.join(personalDir, member.userId, "projects");
        if (!fs.existsSync(memberProjectsDir)) {
          fs.mkdirSync(memberProjectsDir, { recursive: true });
        }
        const linkPath = path.join(memberProjectsDir, entityId);
        if (!fs.existsSync(linkPath)) {
          const targetPath = path.join("..", "..", ownerId, "projects", entityId);
          try {
            fs.symlinkSync(targetPath, linkPath);
            symlinksCreated++;
            console.log(`  [symlink] ${member.userId} -> ${ownerId}/${entityId}`);
          } catch (e) {
            console.warn(`  [symlink失败] ${member.userId} -> ${ownerId}/${entityId}:`, e);
          }
        }

        // 2. 补建 DB 索引
        try {
          const result = db
            .prepare(
              `INSERT INTO entity_members (entity_id, entity_type, member_id, user_id, account_name, owner_id, added_at, created_at)
               VALUES (?, 'project', ?, ?, ?, ?, ?, ?)
               ON CONFLICT(entity_id, entity_type, member_id) DO NOTHING`
            )
            .run(
              entityId,
              member.id,
              member.userId,
              member.accountName,
              ownerId,
              member.addedAt,
              new Date().toISOString()
            );
          if (result.changes > 0) {
            dbEntriesInserted++;
            console.log(`  [DB] 插入 entity_members: ${member.accountName} -> ${entityId}`);
          }
        } catch (e) {
          console.warn(`  [DB失败] ${member.accountName} -> ${entityId}:`, e);
        }
      }
    }
  }

  db.close();

  console.log(`\n=== 修复完成 ===`);
  console.log(`扫描项目: ${projectsScanned}`);
  console.log(`创建 symlink: ${symlinksCreated}`);
  console.log(`插入 DB 记录: ${dbEntriesInserted}`);
}

main();
