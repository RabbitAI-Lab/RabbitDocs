import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Re-export TreeNode and stripTreePrefix from the client-safe module
export { stripTreePrefix } from "./tree";
export type { TreeNode } from "./tree";
import type { TreeNode } from "./tree";

const DEFAULT_DATA_ROOT = path.join(process.cwd(), "data");

/**
 * Get the data root directory.
 * If a custom storage path is configured in the database, use it;
 * otherwise fall back to the default ./data directory.
 */
export function getDataRoot(): string {
  try {
    // Use require to avoid circular import issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db") as { db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storageConfig } = require("@/db/schema") as { storageConfig: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<never> };
    const config = db.select().from(storageConfig).get() as { storagePath: string } | undefined;
    if (config?.storagePath) return config.storagePath;
  } catch {
    // DB not available (e.g. during build), use default
  }
  return DEFAULT_DATA_ROOT;
}

/**
 * Build a full file system path from path segments.
 * Example: buildPath("personal", "default", "projects", "my-project", "doc") => "data/personal/default/projects/my-project/doc.md"
 */
export function buildPath(...segments: string[]): string {
  const last = segments[segments.length - 1];
  // If the last segment doesn't already end with .md, add it
  const withMd =
    segments.length > 0 && !last.endsWith(".md")
      ? [...segments.slice(0, -1), `${last}.md`]
      : segments;
  return path.join(getDataRoot(), ...withMd);
}

/**
 * List projects for a personal account.
 * Reads subdirectories under data/personal/{userId}/projects/
 * Returns ProjectMeta[] with id (directory name) and metadata from .project.json.
 */
export function listProjects(type: "personal" | "enterprise", accountId: string, orgId?: string): ProjectMeta[] {
  let dirPath: string;
  if (type === "personal") {
    dirPath = path.join(getDataRoot(), "personal", accountId, "projects");
  } else if (orgId) {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, orgId, "projects");
  } else {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, "projects");
  }

  if (!fs.existsSync(dirPath)) return [];
  const dirs = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const result: ProjectMeta[] = [];
  for (const d of dirs) {
    const meta = readProjectMeta([...getAccountSegments(type, accountId, orgId), "projects", d.name]);
    if (meta) {
      if (meta.sortOrder === undefined || meta.sortOrder === null) meta.sortOrder = 999;
      result.push(meta);
    } else {
      result.push({
        id: d.name,
        name: d.name,
        description: "",
        createdAt: new Date().toISOString(),
        accountId,
        accountType: type,
        sortOrder: 999,
      });
    }
  }
  result.sort((a, b) => a.sortOrder - b.sortOrder);
  return result;
}

/**
 * Helper to build account-level path segments.
 */
function getAccountSegments(type: "personal" | "enterprise", accountId: string, orgId?: string): string[] {
  if (type === "personal") {
    return ["personal", accountId];
  } else if (orgId) {
    return ["enterprise", accountId, orgId];
  } else {
    return ["enterprise", accountId];
  }
}

/**
 * List organizations for an enterprise.
 * Reads subdirectories under data/enterprise/{enterpriseId}/
 */
export function listOrgs(enterpriseId: string): string[] {
  const dirPath = path.join(getDataRoot(), "enterprise", enterpriseId);
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Recursively list a directory tree: directories and .md files.
 */
export function listTree(dirSegments: string[]): TreeNode[] {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: TreeNode[] = [];

  // Sort: directories first, then files
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const relPath = path.join(...dirSegments, entry.name);
    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        type: "directory",
        path: relPath,
        children: listTree([...dirSegments, entry.name]),
      });
    } else if (entry.name.endsWith(".md")) {
      const nameWithoutExt = entry.name.slice(0, -3);
      result.push({
        name: nameWithoutExt,
        type: "file",
        path: relPath,
      });
    }
  }

  return result;
}

/**
 * Create a directory (with parents).
 */
export function createDir(dirSegments: string[]): void {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Delete a directory (recursively).
 */
export function deleteDir(dirSegments: string[]): void {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Create a new project directory.
 * Generates a UUID as projectId, creates the directory under projects/,
 * and writes .project.json metadata.
 * Returns the ProjectMeta.
 */
export function createProject(type: "personal" | "enterprise", accountId: string, name: string, orgId?: string): ProjectMeta {
  const accountSegs = getAccountSegments(type, accountId, orgId);

  // Shift all existing projects' sortOrder by 1 so new one goes first
  const existing = listProjects(type, accountId, orgId);
  for (const p of existing) {
    p.sortOrder += 1;
    writeProjectMeta(p, [...accountSegs, "projects", p.id]);
  }

  const projectId = randomUUID();
  const dirSegments = [...accountSegs, "projects", projectId];
  createDir(dirSegments);

  const meta: ProjectMeta = {
    id: projectId,
    name,
    description: "",
    createdAt: new Date().toISOString(),
    accountId,
    accountType: type,
    sortOrder: 0,
  };
  writeProjectMeta(meta, dirSegments);
  return meta;
}

/**
 * Delete a project directory (recursively).
 */
export function deleteProject(type: "personal" | "enterprise", accountId: string, projectId: string, orgId?: string): void {
  let dirPath: string;
  if (type === "personal") {
    dirPath = path.join(getDataRoot(), "personal", accountId, "projects", projectId);
  } else if (orgId) {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, orgId, "projects", projectId);
  } else {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, "projects", projectId);
  }
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Read a document from .md file.
 * File path is constructed from segments, .md suffix added if needed.
 */
export function readDocument(...fileSegments: string[]): string | null {
  const filePath = buildPath(...fileSegments);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write content to a document .md file.
 */
export function writeDocument(content: string, ...fileSegments: string[]): void {
  const filePath = buildPath(...fileSegments);
  const dirPath = path.dirname(filePath);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Delete a document .md file.
 */
export function deleteDocument(...fileSegments: string[]): void {
  const filePath = buildPath(...fileSegments);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Rename a document (change title = rename .md file).
 */
export function renameDocument(newTitle: string, ...fileSegments: string[]): void {
  const oldPath = buildPath(...fileSegments);
  const newPath = buildPath(...fileSegments.slice(0, -1), newTitle);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

/**
 * Project metadata stored as .project.json in each project directory.
 */
export interface ProjectMeta {
  id: string;          // projectId (UUID)
  name: string;        // user-visible project name
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  sortOrder: number;   // lower = higher priority (appears first)
}

/**
 * Read project metadata from .project.json.
 * Returns null if the file doesn't exist.
 */
export function readProjectMeta(dirSegments: string[]): ProjectMeta | null {
  const metaPath = path.join(getDataRoot(), ...dirSegments, ".project.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write project metadata to .project.json.
 */
export function writeProjectMeta(meta: ProjectMeta, dirSegments: string[]): void {
  const metaPath = path.join(getDataRoot(), ...dirSegments, ".project.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * List documents in a directory (only .md files).
 */
export function listDocuments(...dirSegments: string[]): string[] {
  const dirPath = path.join(getDataRoot(), ...dirSegments);
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => d.name.slice(0, -3));
}

/* ========== Workspace Functions ========== */

/**
 * Workspace metadata stored as .workspace.json in each workspace directory.
 */
export interface WorkspaceMeta {
  id: string;          // workspaceId (UUID)
  name: string;        // user-visible workspace name
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  sortOrder: number;   // lower = higher priority (appears first)
}

/**
 * List workspaces for an account.
 * Returns WorkspaceMeta[] by reading .workspace.json from each workspace directory.
 */
export function listWorkspaces(type: "personal" | "enterprise", accountId: string, orgId?: string): WorkspaceMeta[] {
  let dirPath: string;
  if (type === "personal") {
    dirPath = path.join(getDataRoot(), "personal", accountId, "workspace");
  } else if (orgId) {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, orgId, "workspace");
  } else {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, "workspace");
  }

  if (!fs.existsSync(dirPath)) return [];
  const dirs = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const result: WorkspaceMeta[] = [];
  for (const d of dirs) {
    const meta = readWorkspaceMeta([...getAccountSegments(type, accountId, orgId), "workspace", d.name]);
    if (meta) {
      if (meta.sortOrder === undefined || meta.sortOrder === null) meta.sortOrder = 999;
      result.push(meta);
    } else {
      result.push({
        id: d.name,
        name: d.name,
        description: "",
        createdAt: new Date().toISOString(),
        accountId,
        accountType: type,
        sortOrder: 999,
      });
    }
  }
  result.sort((a, b) => a.sortOrder - b.sortOrder);
  return result;
}

/**
 * Create a new workspace.
 * Generates a UUID as workspaceId, creates directory and .workspace.json.
 */
export function createWorkspace(type: "personal" | "enterprise", accountId: string, name: string, orgId?: string): WorkspaceMeta {
  const accountSegs = getAccountSegments(type, accountId, orgId);

  // Shift all existing workspaces' sortOrder by 1 so new one goes first
  const existing = listWorkspaces(type, accountId, orgId);
  for (const ws of existing) {
    ws.sortOrder += 1;
    writeWorkspaceMeta(ws, [...accountSegs, "workspace", ws.id]);
  }

  const workspaceId = randomUUID();
  const dirSegments = [...accountSegs, "workspace", workspaceId];
  createDir(dirSegments);

  const meta: WorkspaceMeta = {
    id: workspaceId,
    name,
    description: "",
    createdAt: new Date().toISOString(),
    accountId,
    accountType: type,
    sortOrder: 0,
  };
  writeWorkspaceMeta(meta, dirSegments);
  return meta;
}

/**
 * Delete a workspace directory (recursively).
 * Only removes symlinks and .workspace.json, does not affect actual project directories.
 */
export function deleteWorkspace(type: "personal" | "enterprise", accountId: string, workspaceId: string, orgId?: string): void {
  let dirPath: string;
  if (type === "personal") {
    dirPath = path.join(getDataRoot(), "personal", accountId, "workspace", workspaceId);
  } else if (orgId) {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, orgId, "workspace", workspaceId);
  } else {
    dirPath = path.join(getDataRoot(), "enterprise", accountId, "workspace", workspaceId);
  }
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Read workspace metadata from .workspace.json.
 */
export function readWorkspaceMeta(dirSegments: string[]): WorkspaceMeta | null {
  const metaPath = path.join(getDataRoot(), ...dirSegments, ".workspace.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write workspace metadata to .workspace.json.
 */
export function writeWorkspaceMeta(meta: WorkspaceMeta, dirSegments: string[]): void {
  const metaPath = path.join(getDataRoot(), ...dirSegments, ".workspace.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * List projects linked to a workspace (via symlinks).
 * Returns ProjectMeta[] for each symlinked project.
 */
export function listWorkspaceProjects(type: "personal" | "enterprise", accountId: string, workspaceId: string, orgId?: string): ProjectMeta[] {
  const workspaceDir = path.join(getDataRoot(), ...getAccountSegments(type, accountId, orgId), "workspace", workspaceId);
  if (!fs.existsSync(workspaceDir)) return [];

  const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
  const result: ProjectMeta[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() || fs.lstatSync(path.join(workspaceDir, entry.name)).isSymbolicLink()) {
      const projectId = entry.name;
      const projectMeta = readProjectMeta([...getAccountSegments(type, accountId, orgId), "projects", projectId]);
      if (projectMeta) {
        result.push(projectMeta);
      }
    }
  }
  return result;
}

/**
 * Link a project to a workspace by creating a symlink.
 * Symlink: workspace/{workspaceId}/{projectId} -> ../../projects/{projectId}/
 */
export function linkProjectToWorkspace(type: "personal" | "enterprise", accountId: string, workspaceId: string, projectId: string, orgId?: string): void {
  const accountSegs = getAccountSegments(type, accountId, orgId);
  const linkPath = path.join(getDataRoot(), ...accountSegs, "workspace", workspaceId, projectId);
  // Relative path from workspace dir to projects dir
  // workspace/{workspaceId}/{projectId} -> ../../projects/{projectId}/
  const targetPath = path.join("..", "..", "projects", projectId);

  if (fs.existsSync(linkPath)) {
    fs.unlinkSync(linkPath); // Remove existing link
  }
  fs.symlinkSync(targetPath, linkPath, "dir");
}

/**
 * Unlink a project from a workspace by removing the symlink.
 */
export function unlinkProjectFromWorkspace(type: "personal" | "enterprise", accountId: string, workspaceId: string, projectId: string, orgId?: string): void {
  const accountSegs = getAccountSegments(type, accountId, orgId);
  const linkPath = path.join(getDataRoot(), ...accountSegs, "workspace", workspaceId, projectId);

  if (fs.existsSync(linkPath)) {
    fs.unlinkSync(linkPath);
  }
}
