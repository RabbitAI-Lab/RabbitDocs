import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const MAX_KEYS_PER_USER = 5;

/**
 * Create a new API key for a user. Returns the full key (only shown once).
 */
export function createApiKey(
  userId: string,
  name?: string
): { id: string; key: string; prefix: string } {
  // 检查非系统 key 数量
  const existing = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .all();

  const nonSystemCount = existing.filter((k) => k.isSystem !== 1).length;
  if (nonSystemCount >= MAX_KEYS_PER_USER) {
    throw new Error(`Maximum ${MAX_KEYS_PER_USER} API keys allowed`);
  }

  const key = `atm_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = key.slice(0, 8);
  const now = new Date().toISOString();

  db.insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      name: name || "API Key",
      keyField: key,
      prefix,
      userId,
      isSystem: 0,
      createdAt: now,
    })
    .run();

  return { id: "", key, prefix };
}

/**
 * Create a system API key for MCP authentication. Not deletable by users.
 */
export function createSystemKey(userId: string): { id: string; key: string; prefix: string } {
  const key = `atm_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = key.slice(0, 8);
  const now = new Date().toISOString();

  db.insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      name: "System Key (MCP)",
      keyField: key,
      prefix,
      userId,
      isSystem: 1,
      createdAt: now,
    })
    .run();

  return { id: "", key, prefix };
}

/**
 * Validate an API key. Returns user ID and key info, or null if invalid.
 */
export function validateApiKey(
  plainKey: string
): { userId: string; id: string; name: string | null } | null {
  if (!plainKey.startsWith("atm_")) return null;

  const row = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyField, plainKey))
    .get();

  if (!row) return null;

  return {
    userId: row.userId,
    id: row.id,
    name: row.name,
  };
}

/**
 * Delete an API key. System keys cannot be deleted.
 */
export function deleteApiKey(id: string, userId: string): boolean {
  const row = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .get();

  if (!row || row.userId !== userId || row.isSystem === 1) {
    return false;
  }

  db.delete(apiKeys).where(eq(apiKeys.id, id)).run();
  return true;
}

/**
 * Get the system API key for a user. Returns the full row or null.
 */
export function getSystemKey(userId: string) {
  return db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isSystem, 1)))
    .get() ?? null;
}

/**
 * Regenerate the system API key for a user: delete old → create new.
 * Returns the new key info (full key shown only once).
 */
export function regenerateSystemKey(userId: string): { key: string; prefix: string; createdAt: string } {
  // Delete existing system key
  db.delete(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isSystem, 1)))
    .run();

  // Create new system key
  const key = `atm_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = key.slice(0, 8);
  const now = new Date().toISOString();

  db.insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      name: "System Key (MCP)",
      keyField: key,
      prefix,
      userId,
      isSystem: 1,
      createdAt: now,
    })
    .run();

  return { key, prefix, createdAt: now };
}

/**
 * List all API keys for a user. Key values are masked.
 */
export function listApiKeys(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      isSystem: apiKeys.isSystem,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .all();
}
