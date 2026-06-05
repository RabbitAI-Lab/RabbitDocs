/**
 * 元数据迁移模块
 *
 * 从文件系统中的 .project.json / .workspace.json 扫描元数据，
 * 回填到 entities + entity_repositories + entity_members 表。
 * 使 DB 成为 source of truth。
 *
 * 幂等：如果 entities 表已有数据则跳过。
 */
import fs from "node:fs";
import path from "node:path";

import { db, getSqlite } from "@/db";
import { entities, entityRepositories, entityMembers } from "@/db/schema";
import { getDataRoot } from "./core";
import { sql } from "drizzle-orm";
import type { ProjectMeta } from "../types";

/**
 * 回填 entities + entity_repositories + entity_members 表。
 *
 * 幂等检查: 如果 entities 表已有数据则跳过。
 * 事务: 批量插入，失败回滚。
 */
export function migrateMetaToDb(): void {
  // 幂等检查: 如果 entities 表已有数据则跳过
  const existing = db
    .select({ count: sql<number>`count(*)` })
    .from(entities)
    .get();
  if (existing && existing.count > 0) {
    console.log(`[migrate] entities already has ${existing.count} rows, skipping.`);
    return;
  }

  const dataRoot = getDataRoot();
  const personalDir = path.join(dataRoot, "personal");
  if (!fs.existsSync(personalDir)) {
    console.log("[migrate] No personal directory, nothing to migrate.");
    return;
  }

  let entityCount = 0;
  let repoCount = 0;
  let memberCount = 0;

  // 使用事务批量插入
  const sqlite = getSqlite();
  const insertMany = sqlite.transaction(() => {
    const ownerDirs = fs
      .readdirSync(personalDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const ownerDir of ownerDirs) {
      const ownerId = ownerDir.name;

      for (const [entityDir, entityType, metaFileName] of [
        ["projects", "project", ".project.json"],
        ["workspace", "workspace", ".workspace.json"],
      ] as const) {
        const entityPath = path.join(personalDir, ownerId, entityDir);
        if (!fs.existsSync(entityPath)) continue;

        const entDirs = fs
          .readdirSync(entityPath, { withFileTypes: true })
          .filter((d) => d.isDirectory() || d.isSymbolicLink());

        for (const ent of entDirs) {
          const metaPath = path.join(entityPath, ent.name, metaFileName);
          if (!fs.existsSync(metaPath)) continue;
          try {
            const raw = fs.readFileSync(metaPath, "utf-8");
            const meta = JSON.parse(raw) as ProjectMeta;
            const now = new Date().toISOString();

            // 1. 插入 entities 主表
            db.insert(entities)
              .values({
                id: meta.id,
                type: entityType,
                name: meta.name || "",
                description: meta.description || "",
                accountId: meta.accountId || ownerId,
                accountType: (meta.accountType || "personal") as "personal" | "enterprise",
                ownerId: meta.ownerId || ownerId,
                sortOrder: meta.sortOrder ?? 999,
                gitnexusStatus: meta.gitnexusStatus ? JSON.stringify(meta.gitnexusStatus) : null,
                sandboxStatus: meta.sandbox ? JSON.stringify(meta.sandbox) : null,
                skillsStatus: meta.skills ? JSON.stringify(meta.skills) : null,
                createdAt: meta.createdAt || now,
                updatedAt: now,
              })
              .onConflictDoNothing()
              .run();
            entityCount++;

            // 2. 插入 entity_repositories 子表
            if (meta.repositories?.length) {
              for (const repo of meta.repositories) {
                try {
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
                  repoCount++;
                } catch {
                  // duplicate — skip
                }
              }
            }

            // 3. 插入 entity_members 子表
            if (meta.members?.length) {
              for (const member of meta.members) {
                if (!member.userId) continue; // 只索引有 userId 的成员
                try {
                  db.insert(entityMembers)
                    .values({
                      entityId: meta.id,
                      entityType,
                      memberId: member.id,
                      userId: member.userId,
                      accountName: member.accountName,
                      ownerId,
                      addedAt: member.addedAt,
                      createdAt: now,
                    })
                    .onConflictDoNothing()
                    .run();
                  memberCount++;
                } catch {
                  // duplicate — skip
                }
              }
            }
          } catch {
            // skip invalid meta
          }
        }
      }
    }
  });

  insertMany();
  console.log(`[migrate] entities: ${entityCount} rows, entity_repositories: ${repoCount} rows, entity_members: ${memberCount} rows.`);
}
