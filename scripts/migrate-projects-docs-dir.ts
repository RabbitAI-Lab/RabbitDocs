/**
 * Migration script: Move existing project documents into docs/ subdirectory.
 *
 * Usage: npx tsx scripts/migrate-projects-docs-dir.ts
 *
 * Before: data/personal/{userId}/projects/{projectId}/
 *           ├── .project.json
 *           ├── 文档1.md
 *           └── 子目录/文档2.md
 *
 * After:  data/personal/{userId}/projects/{projectId}/
 *           ├── .project.json
 *           └── docs/
 *               ├── 文档1.md
 *               └── 子目录/文档2.md
 *
 * This script is idempotent - safe to run multiple times.
 * Files and directories that are already inside docs/ are left untouched.
 */
import fs from "node:fs";
import path from "node:path";

const DATA_ROOT = path.join(process.cwd(), "data");
const RESERVED_FILES = new Set([".project.json"]);
const DOCS_DIR_NAME = "docs";

function migrateProjectDir(projectDir: string): void {
  if (!fs.existsSync(projectDir)) return;
  if (!fs.statSync(projectDir).isDirectory()) return;

  const entries = fs.readdirSync(projectDir, { withFileTypes: true });

  // Check if docs/ already exists
  const docsDir = path.join(projectDir, DOCS_DIR_NAME);
  const hasDocsDir = entries.some((e) => e.isDirectory() && e.name === DOCS_DIR_NAME);

  // Find items to move: everything except .project.json and the docs/ directory itself
  const toMove = entries.filter((e) => {
    if (RESERVED_FILES.has(e.name)) return false;
    if (e.name === DOCS_DIR_NAME) return false;
    // Skip hidden files / dotfiles other than what we handle
    return true;
  });

  if (toMove.length === 0) return;

  // Create docs/ directory if it doesn't exist
  if (!hasDocsDir) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Move each item into docs/
  for (const entry of toMove) {
    const srcPath = path.join(projectDir, entry.name);
    const destPath = path.join(docsDir, entry.name);

    if (fs.existsSync(destPath)) {
      console.warn(`  [SKIP] ${destPath} already exists, skipping ${entry.name}`);
      continue;
    }

    fs.renameSync(srcPath, destPath);
    console.log(`  [MOVE] ${entry.name} -> docs/${entry.name}`);
  }
}

function migrateAccountProjects(baseDir: string): void {
  const projectsDir = path.join(baseDir, "projects");
  if (!fs.existsSync(projectsDir)) return;

  const projectDirs = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const projectDir of projectDirs) {
    const fullPath = path.join(projectsDir, projectDir.name);
    console.log(`Migrating project: ${projectDir.name}`);
    migrateProjectDir(fullPath);
  }
}

function migrateAccount(baseDir: string, accountId: string): void {
  const accountDir = path.join(baseDir, accountId);
  if (!fs.existsSync(accountDir)) return;

  console.log(`\nProcessing account: ${accountId}`);
  migrateAccountProjects(accountDir);
}

function main(): void {
  console.log("=== Migration: Moving project documents to docs/ subdirectory ===");
  console.log(`Data root: ${DATA_ROOT}\n`);

  if (!fs.existsSync(DATA_ROOT)) {
    console.log("No data directory found. Nothing to migrate.");
    return;
  }

  // Migrate personal accounts: data/personal/{accountId}/projects/
  const personalDir = path.join(DATA_ROOT, "personal");
  if (fs.existsSync(personalDir)) {
    const accounts = fs
      .readdirSync(personalDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const account of accounts) {
      migrateAccount(personalDir, account.name);
    }
  }

  // Migrate enterprise accounts: data/enterprise/{enterpriseId}/{orgId}/projects/
  const enterpriseDir = path.join(DATA_ROOT, "enterprise");
  if (fs.existsSync(enterpriseDir)) {
    const enterprises = fs
      .readdirSync(enterpriseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const enterprise of enterprises) {
      const enterprisePath = path.join(enterpriseDir, enterprise.name);
      const orgs = fs
        .readdirSync(enterprisePath, { withFileTypes: true })
        .filter((d) => d.isDirectory());

      for (const org of orgs) {
        const orgPath = path.join(enterprisePath, org.name);
        console.log(`\nProcessing enterprise: ${enterprise.name}, org: ${org.name}`);
        migrateAccountProjects(orgPath);
      }

      // Enterprise without orgs: data/enterprise/{enterpriseId}/projects/
      if (orgs.length === 0) {
        console.log(`\nProcessing enterprise (no orgs): ${enterprise.name}`);
        migrateAccountProjects(enterprisePath);
      }
    }
  }

  console.log("\n=== Migration complete ===");
}

main();
