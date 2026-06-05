/**
 * Generic CRUD factories that eliminate code duplication between
 * Project and Workspace entity operations.
 *
 * The "strategy object" pattern is used because ProjectMeta and WorkspaceMeta
 * share identical fields — the difference is in *behaviour* (which JSON file to
 * read/write, which directory name to use), not in *type*.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ProjectMeta,
  Repository,
  ProjectMember,
} from "../types";
import { getDataRoot, getAccountSegments, createDir } from "./core";
import { db } from "@/db";
import { entityMembers, entities, entityRepositories } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

// entityDir -> entityType 映射
const ENTITY_DIR_TO_TYPE: Record<string, string> = {
  projects: "project",
  workspace: "workspace",
};

// ────────────────────────────────────────────────────────────
// Strategy interfaces
// ────────────────────────────────────────────────────────────

/** Strategy for reading/writing entity metadata. */
export interface MetaStrategy {
  readMeta(dirSegments: string[]): ProjectMeta | null;
  writeMeta(meta: ProjectMeta, dirSegments: string[]): void;
  entityName: string; // "Project" | "Workspace" — used in error messages
}

/** Extended strategy for full entity CRUD (list / create / delete). */
export interface EntityStrategy extends MetaStrategy {
  entityDir: string;          // "projects" | "workspace"
  entityType: string;         // "project" | "workspace"
  metaFileName: string;       // kept for backward compat, no longer used for FS reads
  defaultNamePrefix: string;  // "Project" | "Workspace"
  /** Whether to create a docs/ subdirectory on entity creation (Project-only). */
  createDocsDir?: boolean;
}

// ────────────────────────────────────────────────────────────
// DB read/write helpers (source of truth)
// ────────────────────────────────────────────────────────────

/** Read entity metadata from DB, assembling repositories and members from sub-tables. */
export function readMetaFromDb(entityId: string, entityType: string): ProjectMeta | null {
  const row = db.select().from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.type, entityType as "project" | "workspace")))
    .get();
  if (!row) return null;

  // 查询关联的 repositories
  const repoRows = db.select().from(entityRepositories)
    .where(and(eq(entityRepositories.entityId, entityId), eq(entityRepositories.entityType, entityType)))
    .all();

  // 查询关联的 members
  const memberRows = db.select().from(entityMembers)
    .where(and(eq(entityMembers.entityId, entityId), eq(entityMembers.entityType, entityType)))
    .all();

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    accountId: row.accountId,
    accountType: row.accountType,
    ownerId: row.ownerId,
    sortOrder: row.sortOrder,
    repositories: repoRows.length > 0 ? repoRows.map(repoRowToRepository) : undefined,
    sandbox: row.sandboxStatus ? JSON.parse(row.sandboxStatus) : undefined,
    skills: row.skillsStatus ? JSON.parse(row.skillsStatus) : undefined,
    members: memberRows.length > 0 ? memberRows.map(memberRowToProjectMember) : undefined,
    gitnexusStatus: row.gitnexusStatus ? JSON.parse(row.gitnexusStatus) : undefined,
  };
}

/** Write entity metadata to DB (upsert), syncing repositories and members sub-tables. */
export function writeMetaToDb(meta: ProjectMeta, entityType: string): void {
  const now = new Date().toISOString();

  db.insert(entities)
    .values({
      id: meta.id,
      type: entityType as "project" | "workspace",
      name: meta.name,
      description: meta.description,
      accountId: meta.accountId,
      accountType: meta.accountType as "personal" | "enterprise",
      ownerId: meta.ownerId,
      sortOrder: meta.sortOrder,
      gitnexusStatus: meta.gitnexusStatus ? JSON.stringify(meta.gitnexusStatus) : null,
      sandboxStatus: meta.sandbox ? JSON.stringify(meta.sandbox) : null,
      skillsStatus: meta.skills ? JSON.stringify(meta.skills) : null,
      createdAt: meta.createdAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [entities.id],
      set: {
        name: meta.name,
        description: meta.description,
        accountId: meta.accountId,
        accountType: meta.accountType as "personal" | "enterprise",
        ownerId: meta.ownerId,
        sortOrder: meta.sortOrder,
        gitnexusStatus: meta.gitnexusStatus ? JSON.stringify(meta.gitnexusStatus) : null,
        sandboxStatus: meta.sandbox ? JSON.stringify(meta.sandbox) : null,
        skillsStatus: meta.skills ? JSON.stringify(meta.skills) : null,
        updatedAt: now,
      },
    })
    .run();

  // Sync repositories sub-table: full replace strategy
  if (meta.repositories !== undefined) {
    db.delete(entityRepositories)
      .where(and(eq(entityRepositories.entityId, meta.id), eq(entityRepositories.entityType, entityType)))
      .run();
    for (const repo of meta.repositories) {
      db.insert(entityRepositories)
        .values({
          id: repo.id,
          entityId: meta.id,
          entityType,
          name: repo.name,
          url: repo.url,
          repoType: repo.type || "other",
          credentials: repo.credentials ? JSON.stringify(repo.credentials) : "{}",
          syncStatus: repo.syncStatus || null,
          lastSyncAt: repo.lastSyncAt || null,
          lastCheckedAt: repo.lastCheckedAt || null,
          localCommitHash: repo.localCommitHash || null,
          remoteCommitHash: repo.remoteCommitHash || null,
          errorMessage: repo.errorMessage || null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
    }
  }

  // Sync members sub-table: full replace strategy
  if (meta.members !== undefined) {
    db.delete(entityMembers)
      .where(and(eq(entityMembers.entityId, meta.id), eq(entityMembers.entityType, entityType)))
      .run();
    for (const member of meta.members) {
      db.insert(entityMembers)
        .values({
          entityId: meta.id,
          entityType,
          memberId: member.id,
          userId: member.userId ?? null,
          accountName: member.accountName,
          ownerId: meta.ownerId,
          addedAt: member.addedAt,
          createdAt: now,
        })
        .onConflictDoNothing()
        .run();
    }
  }
}

// ────────────────────────────────────────────────────────────
// DB row -> type mappers
// ────────────────────────────────────────────────────────────

function repoRowToRepository(row: typeof entityRepositories.$inferSelect): Repository {
  let credentials: Repository["credentials"] = { type: "none" };
  try {
    if (row.credentials) credentials = JSON.parse(row.credentials);
  } catch { /* ignore */ }
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: (row.repoType as Repository["type"]) || "other",
    credentials,
    syncStatus: (row.syncStatus as Repository["syncStatus"]) || undefined,
    lastSyncAt: row.lastSyncAt || undefined,
    lastCheckedAt: row.lastCheckedAt || undefined,
    localCommitHash: row.localCommitHash || undefined,
    remoteCommitHash: row.remoteCommitHash || undefined,
    errorMessage: row.errorMessage || undefined,
  };
}

function memberRowToProjectMember(row: typeof entityMembers.$inferSelect): ProjectMember {
  return {
    id: row.memberId,
    accountName: row.accountName,
    userId: row.userId ?? undefined,
    addedAt: row.addedAt,
  };
}

// ────────────────────────────────────────────────────────────
// Factory: Entity CRUD (list / create / delete)
// ────────────────────────────────────────────────────────────

export interface EntityCrud {
  list(type: "personal" | "enterprise", accountId: string, orgId?: string): ProjectMeta[];
  create(type: "personal" | "enterprise", accountId: string, name: string, orgId?: string): ProjectMeta;
  remove(type: "personal" | "enterprise", accountId: string, id: string, orgId?: string): void;
}

export function createEntityCrud(strategy: EntityStrategy): EntityCrud {
  const { entityDir, entityType, createDocsDir } = strategy;

  function list(type: "personal" | "enterprise", accountId: string, _orgId?: string): ProjectMeta[] {
    const rows = db.select().from(entities)
      .where(and(
        eq(entities.accountId, accountId),
        eq(entities.accountType, type),
        eq(entities.type, entityType as "project" | "workspace")
      ))
      .orderBy(asc(entities.sortOrder))
      .all();

    return rows.map((row) => {
      const repoRows = db.select().from(entityRepositories)
        .where(and(eq(entityRepositories.entityId, row.id), eq(entityRepositories.entityType, entityType)))
        .all();
      const memberRows = db.select().from(entityMembers)
        .where(and(eq(entityMembers.entityId, row.id), eq(entityMembers.entityType, entityType)))
        .all();
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.createdAt,
        accountId: row.accountId,
        accountType: row.accountType,
        ownerId: row.ownerId,
        sortOrder: row.sortOrder,
        repositories: repoRows.length > 0 ? repoRows.map(repoRowToRepository) : undefined,
        sandbox: row.sandboxStatus ? JSON.parse(row.sandboxStatus) : undefined,
        skills: row.skillsStatus ? JSON.parse(row.skillsStatus) : undefined,
        members: memberRows.length > 0 ? memberRows.map(memberRowToProjectMember) : undefined,
        gitnexusStatus: row.gitnexusStatus ? JSON.parse(row.gitnexusStatus) : undefined,
      } as ProjectMeta;
    });
  }

  function create(type: "personal" | "enterprise", accountId: string, name: string, orgId?: string): ProjectMeta {
    const accountSegs = getAccountSegments(type, accountId, orgId);

    // Shift all existing entities' sortOrder by 1 so new one goes first
    const existing = list(type, accountId, orgId);
    for (const p of existing) {
      p.sortOrder += 1;
      strategy.writeMeta(p, [...accountSegs, entityDir, p.id]);
    }

    const id = randomUUID();
    const dirSegments = [...accountSegs, entityDir, id];
    createDir(dirSegments);
    if (createDocsDir) {
      createDir([...dirSegments, "docs"]);
    }

    const meta: ProjectMeta = {
      id,
      name,
      description: "",
      createdAt: new Date().toISOString(),
      accountId,
      accountType: type,
      ownerId: accountId,
      sortOrder: 0,
    };
    strategy.writeMeta(meta, dirSegments);
    return meta;
  }

  function remove(type: "personal" | "enterprise", accountId: string, id: string, orgId?: string): void {
    const accountSegs = getAccountSegments(type, accountId, orgId);
    const dirPath = path.join(getDataRoot(), ...accountSegs, entityDir, id);

    // 删除 DB 记录: entities + entity_repositories + entity_members
    try {
      db.delete(entityRepositories)
        .where(and(eq(entityRepositories.entityId, id), eq(entityRepositories.entityType, entityType)))
        .run();
      db.delete(entityMembers)
        .where(and(eq(entityMembers.entityId, id), eq(entityMembers.entityType, entityType)))
        .run();
      db.delete(entities).where(eq(entities.id, id)).run();
    } catch (e) {
      console.warn(`[EntityCRUD] Failed to clean up DB for ${id}:`, e);
    }

    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  return { list, create, remove };
}

// ────────────────────────────────────────────────────────────
// Factory: Repository CRUD
// ────────────────────────────────────────────────────────────

export interface RepositoryCrud {
  add(dirSegments: string[], repository: Repository): Repository[];
  remove(dirSegments: string[], repoId: string): void;
  update(dirSegments: string[], repoId: string, updates: Partial<Omit<Repository, "id">>): Repository | null;
}

export function createRepositoryCrud(strategy: MetaStrategy): RepositoryCrud {
  function add(dirSegments: string[], repository: Repository): Repository[] {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    if (!meta.repositories) meta.repositories = [];
    meta.repositories.push(repository);
    strategy.writeMeta(meta, dirSegments);
    return meta.repositories;
  }

  function remove(dirSegments: string[], repoId: string): void {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    meta.repositories = (meta.repositories || []).filter((r) => r.id !== repoId);
    strategy.writeMeta(meta, dirSegments);
  }

  function update(dirSegments: string[], repoId: string, updates: Partial<Omit<Repository, "id">>): Repository | null {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    const repo = (meta.repositories || []).find((r) => r.id === repoId);
    if (!repo) return null;
    Object.assign(repo, updates);
    strategy.writeMeta(meta, dirSegments);
    return repo;
  }

  return { add, remove, update };
}

// ────────────────────────────────────────────────────────────
// Factory: Member CRUD
// ────────────────────────────────────────────────────────────

export interface MemberCrud {
  add(dirSegments: string[], member: ProjectMember): ProjectMember[];
  remove(dirSegments: string[], memberId: string): void;
  update(dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>): ProjectMember | null;
}

export function createMemberCrud(strategy: MetaStrategy): MemberCrud {
  function add(dirSegments: string[], member: ProjectMember): ProjectMember[] {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    if (!meta.members) meta.members = [];
    meta.members.push(member);
    strategy.writeMeta(meta, dirSegments);

    // 如果成员有 userId，创建 symlink 使其在自己的目录下可见
    if (member.userId && dirSegments.length >= 4) {
      try {
        const [personal, ownerId, entityDir, entityId] = dirSegments;
        const memberProjectsDir = path.join(getDataRoot(), personal, member.userId, entityDir);
        if (!fs.existsSync(memberProjectsDir)) {
          fs.mkdirSync(memberProjectsDir, { recursive: true });
        }
        const linkPath = path.join(memberProjectsDir, entityId);
        // symlink 指向所有者的项目目录: ../../{ownerId}/{entityDir}/{entityId}
        // 从 memberProjectsDir(personal/{memberUserId}/{entityDir}) 向上 2 层到 personal/
        const targetPath = path.join("..", "..", ownerId, entityDir, entityId);
        // Check with lstatSync: existsSync returns false for broken symlinks
        let linkExists = false;
        try { fs.lstatSync(linkPath); linkExists = true; } catch { /* not exists */ }
        if (!linkExists) {
          fs.symlinkSync(targetPath, linkPath);
        }
      } catch (e) {
        console.warn(`[MemberSymlink] Failed to create symlink for member ${member.userId}:`, e);
      }
    }

    // 同步写 DB 索引
    syncMemberToDb(dirSegments, member);

    return meta.members;
  }

  function remove(dirSegments: string[], memberId: string): void {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    const removed = (meta.members || []).find((m) => m.id === memberId);
    meta.members = (meta.members || []).filter((m) => m.id !== memberId);
    strategy.writeMeta(meta, dirSegments);

    // 如果成员有 userId，清理 symlink
    if (removed?.userId && dirSegments.length >= 4) {
      try {
        const [personal, _ownerId, entityDir, entityId] = dirSegments;
        const linkPath = path.join(getDataRoot(), personal, removed.userId, entityDir, entityId);
        // Use lstatSync to detect symlinks (existsSync returns false for broken symlinks)
        try {
          const stat = fs.lstatSync(linkPath);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(linkPath);
          }
        } catch { /* linkPath doesn't exist, nothing to remove */ }
      } catch (e) {
        console.warn(`[MemberSymlink] Failed to remove symlink for member ${removed.userId}:`, e);
      }
    }

    // 同步从 DB 索引删除
    removeMemberFromDb(dirSegments, memberId, removed?.userId);
  }

  function update(dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>): ProjectMember | null {
    const meta = strategy.readMeta(dirSegments);
    if (!meta) throw new Error(`${strategy.entityName} not found`);
    const member = (meta.members || []).find((m) => m.id === memberId);
    if (!member) return null;
    Object.assign(member, updates);
    strategy.writeMeta(meta, dirSegments);

    // 同步更新 DB 索引
    updateMemberInDb(dirSegments, memberId, updates);

    return member;
  }

  return { add, remove, update };
}

// ────────────────────────────────────────────────────────────
// 查找用户作为成员的实体 ID (纯 DB 查询)
// ────────────────────────────────────────────────────────────

/**
 * 查找指定用户作为成员的所有实体（项目/工作空间）ID。
 * DB 为 source of truth，纯 DB 查询。
 */
export function findMemberEntityIds(userId: string, entityDir: string, _metaFileName?: string): string[] {
  const entityType = ENTITY_DIR_TO_TYPE[entityDir];
  if (!entityType) return [];

  try {
    const rows = db
      .select({ entityId: entityMembers.entityId })
      .from(entityMembers)
      .where(
        and(
          eq(entityMembers.userId, userId),
          eq(entityMembers.entityType, entityType)
        )
      )
      .all();
    return rows.map((r) => r.entityId);
  } catch (e) {
    console.warn("[MemberDB] DB query failed:", e);
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// Factory: MCP Config CRUD
// ────────────────────────────────────────────────────────────

export interface McpConfigCrud {
  read(dirSegments: string[]): Record<string, unknown> | null;
  write(config: object, dirSegments: string[]): void;
}

export function createMcpConfigCrud(): McpConfigCrud {
  /**
   * 读取 MCP 配置：合并 .mcp.json（标准 mcpServers）+ .mcp-config.json（disabled/_apiKeys）。
   * 向后兼容：旧版 .mcp.json 中可能包含 disabled/_apiKeys，首次读取时自动迁移到 .mcp-config.json。
   */
  function read(dirSegments: string[]): Record<string, unknown> | null {
    const dir = path.join(getDataRoot(), ...dirSegments);
    const mcpPath = path.join(dir, ".mcp.json");
    const configPath = path.join(dir, ".mcp-config.json");

    // 读取标准 .mcp.json
    let mcpData: Record<string, unknown> | null = null;
    if (fs.existsSync(mcpPath)) {
      try {
        mcpData = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      } catch {
        mcpData = null;
      }
    }

    // 读取扩展 .mcp-config.json
    let configData: Record<string, unknown> | null = null;
    if (fs.existsSync(configPath)) {
      try {
        configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch {
        configData = null;
      }
    }

    if (!mcpData && !configData) return null;

    const mcpServers = (mcpData?.mcpServers && typeof mcpData.mcpServers === "object"
      ? mcpData.mcpServers : {}) as Record<string, unknown>;

    // 优先从 .mcp-config.json 读取 disabled/_apiKeys；兼容旧格式回退到 .mcp.json
    const disabled = (configData?.disabled ?? mcpData?.disabled ?? {}) as Record<string, unknown>;
    const _apiKeys = (configData?._apiKeys ?? mcpData?._apiKeys ?? {}) as Record<string, string>;

    // 向后兼容迁移：如果旧 .mcp.json 包含 disabled/_apiKeys，自动拆分到新文件
    if (mcpData && (mcpData.disabled !== undefined || mcpData._apiKeys !== undefined) && !configData) {
      const extConfig: Record<string, unknown> = {};
      if (mcpData.disabled && typeof mcpData.disabled === "object") {
        extConfig.disabled = mcpData.disabled;
      }
      if (mcpData._apiKeys && typeof mcpData._apiKeys === "object") {
        extConfig._apiKeys = mcpData._apiKeys;
      }
      if (Object.keys(extConfig).length > 0) {
        try {
          fs.writeFileSync(configPath, JSON.stringify(extConfig, null, 2), "utf-8");
        } catch { /* ignore */ }
      }
      // 从 .mcp.json 中移除非标准字段并重写
      const cleanMcp: Record<string, unknown> = { mcpServers };
      try {
        fs.writeFileSync(mcpPath, JSON.stringify(cleanMcp, null, 2), "utf-8");
      } catch { /* ignore */ }
      console.log(`[MCP] Migrated disabled/_apiKeys from .mcp.json to .mcp-config.json in [${dirSegments.join("/")}]`);
    }

    return { mcpServers, disabled, _apiKeys };
  }

  /**
   * 写入 MCP 配置：mcpServers → .mcp.json（标准格式），disabled/_apiKeys → .mcp-config.json（私有扩展）。
   */
  function write(config: object, dirSegments: string[]): void {
    const dir = path.join(getDataRoot(), ...dirSegments);
    const mcpPath = path.join(dir, ".mcp.json");
    const configPath = path.join(dir, ".mcp-config.json");

    const cfg = config as Record<string, unknown>;
    const mcpServers = (cfg.mcpServers && typeof cfg.mcpServers === "object"
      ? cfg.mcpServers : {}) as Record<string, unknown>;
    const disabled = (cfg.disabled && typeof cfg.disabled === "object"
      ? cfg.disabled : {}) as Record<string, unknown>;
    const _apiKeys = (cfg._apiKeys && typeof cfg._apiKeys === "object"
      ? cfg._apiKeys : {}) as Record<string, string>;

    // .mcp.json：仅保留标准 mcpServers
    fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers }, null, 2), "utf-8");

    // .mcp-config.json：存储 disabled 和 _apiKeys（仅在有内容时写入）
    const extConfig: Record<string, unknown> = { disabled, _apiKeys };
    if (Object.keys(disabled).length > 0 || Object.keys(_apiKeys).length > 0) {
      fs.writeFileSync(configPath, JSON.stringify(extConfig, null, 2), "utf-8");
    } else if (fs.existsSync(configPath)) {
      // disabled 和 _apiKeys 都为空时清理文件
      fs.unlinkSync(configPath);
    }
  }

  return { read, write };
}

// ────────────────────────────────────────────────────────────
// DB 索引辅助函数
// ────────────────────────────────────────────────────────────

function extractEntityInfo(dirSegments: string[]): {
  entityId: string;
  entityType: string;
  ownerId: string;
} | null {
  // dirSegments 格式: [personal|enterprise, ownerId, entityDir, entityId]
  if (dirSegments.length < 4) return null;
  const [, ownerId, entityDir, entityId] = dirSegments;
  const entityType = ENTITY_DIR_TO_TYPE[entityDir];
  if (!entityType) return null;
  return { entityId, entityType, ownerId };
}

function syncMemberToDb(dirSegments: string[], member: ProjectMember): void {
  const info = extractEntityInfo(dirSegments);
  if (!info) return;
  try {
    db.insert(entityMembers)
      .values({
        entityId: info.entityId,
        entityType: info.entityType,
        memberId: member.id,
        userId: member.userId ?? null,
        accountName: member.accountName,
        ownerId: info.ownerId,
        addedAt: member.addedAt,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .run();
  } catch (e) {
    console.warn("[MemberDB] Failed to sync member to DB:", e);
  }
}

function removeMemberFromDb(dirSegments: string[], memberId: string, userId?: string): void {
  const info = extractEntityInfo(dirSegments);
  if (!info) return;
  try {
    // 优先按 memberId 精确删除
    const result = db.delete(entityMembers)
      .where(
        and(
          eq(entityMembers.entityId, info.entityId),
          eq(entityMembers.entityType, info.entityType),
          eq(entityMembers.memberId, memberId)
        )
      )
      .run();
    // 兆底：如果 memberId 不匹配（如 repaired- 前缀），按 userId + entityId 删除
    if (result.changes === 0 && userId) {
      db.delete(entityMembers)
        .where(
          and(
            eq(entityMembers.entityId, info.entityId),
            eq(entityMembers.entityType, info.entityType),
            eq(entityMembers.userId, userId)
          )
        )
        .run();
    }
  } catch (e) {
    console.warn("[MemberDB] Failed to remove member from DB:", e);
  }
}

function updateMemberInDb(
  dirSegments: string[],
  memberId: string,
  updates: Partial<Omit<ProjectMember, "id">>
): void {
  const info = extractEntityInfo(dirSegments);
  if (!info) return;
  try {
    const setFields: Record<string, string> = {};
    if (updates.accountName !== undefined) setFields.accountName = updates.accountName;
    if (updates.userId !== undefined) setFields.userId = updates.userId;
    if (updates.addedAt !== undefined) setFields.addedAt = updates.addedAt;
    if (Object.keys(setFields).length > 0) {
      db.update(entityMembers)
        .set(setFields)
        .where(
          and(
            eq(entityMembers.entityId, info.entityId),
            eq(entityMembers.entityType, info.entityType),
            eq(entityMembers.memberId, memberId)
          )
        )
        .run();
    }
  } catch (e) {
    console.warn("[MemberDB] Failed to update member in DB:", e);
  }
}
