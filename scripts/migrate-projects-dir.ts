/**
 * Migration script: Move existing projects into projects/ subdirectory
 * and rename directories from projectName to projectId (UUID).
 *
 * Usage: npx tsx scripts/migrate-projects-dir.ts
 *
 * Before: data/personal/{userId}/{projectName}/
 * After:  data/personal/{userId}/projects/{projectId}/
 *
 * This script is idempotent - safe to run multiple times.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

const DATA_ROOT = path.join(process.cwd(), "data");
const DB_PATH = path.join(process.cwd(), "data.db");
const RESERVED_DIRS = new Set(["projects", "workspace"]);

interface ProjectMapping {
  oldName: string;
  newId: string;
}

function migrateDirectory(baseDir: string, accountId: string): ProjectMapping[] {
  const mappings: ProjectMapping[] = [];
  const userDir = path.join(baseDir, accountId);

  if (!fs.existsSync(userDir)) return mappings;

  // Check if projects/ already exists
  const projectsDir = path.join(userDir, "projects");
  if (fs.existsSync(projectsDir)) {
    console.log(`  [skip] ${userDir} - projects/ already exists`);
    return mappings;
  }

  // List subdirectories (potential projects)
  const entries = fs.readdirSync(userDir, { withFileTypes: true });
  const projectDirs = entries.filter(
    (e) => e.isDirectory() && !RESERVED_DIRS.has(e.name),
  );

  if (projectDirs.length === 0) {
    console.log(`  [skip] ${userDir} - no project directories found`);
    return mappings;
  }

  // Create projects/ directory
  fs.mkdirSync(projectsDir, { recursive: true });

  for (const dir of projectDirs) {
    const oldName = dir.name;
    const newId = randomUUID();
    const oldPath = path.join(userDir, oldName);
    const newPath = path.join(projectsDir, newId);

    // Move directory
    fs.renameSync(oldPath, newPath);

    // Update or create .project.json
    const metaPath = path.join(newPath, ".project.json");
    let meta: Record<string, string> = {};
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch {
        // ignore parse errors
      }
    }

    meta.id = newId;
    meta.name = meta.name || oldName;
    if (!meta.createdAt) meta.createdAt = new Date().toISOString();
    if (!meta.accountId) meta.accountId = accountId;

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    console.log(`  [move] ${oldName} -> projects/${newId}`);
    mappings.push({ oldName, newId });
  }

  return mappings;
}

function main() {
  console.log("=== ChatWiki Projects Directory Migration ===\n");

  const allMappings: Array<{ oldName: string; newId: string; accountContext: string }> = [];

  // 1. Migrate personal accounts: data/personal/{userId}/
  const personalDir = path.join(DATA_ROOT, "personal");
  if (fs.existsSync(personalDir)) {
    console.log("[1/3] Migrating personal accounts...");
    const userIds = fs
      .readdirSync(personalDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    for (const userId of userIds) {
      const mappings = migrateDirectory(personalDir, userId);
      for (const m of mappings) {
        allMappings.push({ ...m, accountContext: `personal/${userId}` });
      }
    }
  }

  // 2. Migrate enterprise accounts: data/enterprise/{enterpriseId}/{orgId}/
  const enterpriseDir = path.join(DATA_ROOT, "enterprise");
  if (fs.existsSync(enterpriseDir)) {
    console.log("\n[2/3] Migrating enterprise accounts...");
    const enterpriseIds = fs
      .readdirSync(enterpriseDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    for (const entId of enterpriseIds) {
      const entDir = path.join(enterpriseDir, entId);
      const orgIds = fs
        .readdirSync(entDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

      for (const orgId of orgIds) {
        const orgPath = path.join(entId, orgId);
        const orgDir = path.join(enterpriseDir, orgPath);
        // Check if this looks like an org directory (has project-like subdirs)
        const entries = fs.readdirSync(orgDir, { withFileTypes: true });
        const hasProjectDirs = entries.some(
          (e) => e.isDirectory() && !RESERVED_DIRS.has(e.name),
        );

        if (hasProjectDirs) {
          const mappings = migrateDirectory(enterpriseDir, orgPath);
          for (const m of mappings) {
            allMappings.push({ ...m, accountContext: `enterprise/${orgPath}` });
          }
        }
      }
    }
  }

  // 3. Update database chats.project_name -> chats.project_id (value mapping)
  console.log("\n[3/3] Updating database references...");
  if (fs.existsSync(DB_PATH) && allMappings.length > 0) {
    try {
      const db = new Database(DB_PATH);

      // Check if project_name column still exists
      const columns = db.pragma("table_info(chats)") as Array<{ name: string }>;
      const hasProjectName = columns.some((c) => c.name === "project_name");
      const hasProjectId = columns.some((c) => c.name === "project_id");

      if (hasProjectName && !hasProjectId) {
        // First, update values from project_name to project_id
        for (const m of allMappings) {
          const stmt = db.prepare(
            "UPDATE chats SET project_name = ? WHERE project_name = ?",
          );
          const result = stmt.run(m.newId, m.oldName);
          if (result.changes > 0) {
            console.log(`  [db] Updated ${result.changes} chat(s): ${m.oldName} -> ${m.newId}`);
          }
        }
        // Then rename column
        db.exec("ALTER TABLE chats RENAME COLUMN project_name TO project_id");
        console.log("  [db] Renamed column project_name -> project_id");
      } else if (hasProjectId) {
        // Column already renamed, just update values if they still use old names
        for (const m of allMappings) {
          const stmt = db.prepare(
            "UPDATE chats SET project_id = ? WHERE project_id = ?",
          );
          const result = stmt.run(m.newId, m.oldName);
          if (result.changes > 0) {
            console.log(`  [db] Updated ${result.changes} chat(s): ${m.oldName} -> ${m.newId}`);
          }
        }
      }

      db.close();
    } catch (err) {
      console.error("  [error] Database update failed:", err);
    }
  } else if (!fs.existsSync(DB_PATH)) {
    console.log("  [skip] No database file found");
  } else {
    console.log("  [skip] No project mappings to update");
  }

  console.log("\n=== Migration complete ===");
  console.log(`Total projects migrated: ${allMappings.length}`);
  for (const m of allMappings) {
    console.log(`  ${m.accountContext}: ${m.oldName} -> ${m.newId}`);
  }
}

main();
