import fs from "fs";
import { getSqlite, dbPath } from "@/db";
import type Database from "better-sqlite3";

// ── Types ──

export interface TableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface DatabaseInfo {
  filePath: string;
  fileSizeBytes: number;
  fileSizeHuman: string;
  lastModified: string;
  sqliteVersion: string;
  journalMode: string;
  integrityOk: boolean;
  tables: TableInfo[];
  totalRows: number;
}

export interface DumpTable {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface DatabaseDump {
  version: 1;
  timestamp: string;
  tables: Record<string, DumpTable>;
}

export interface RestoreResult {
  inserted: number;
  skipped: number;
  errors: Array<{ table: string; error: string }>;
}

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/** Tables to exclude from dump/restore. */
const EXCLUDED_TABLES = new Set(["_migrations"]);

/** Get all user table names from sqlite_master, excluding internal tables. */
function getUserTableNames(sqlite: Database.Database): string[] {
  return (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as Array<{ name: string }>
  )
    .map((r) => r.name)
    .filter((name) => !EXCLUDED_TABLES.has(name));
}

/** Escape a table name for SQL (basic validation against allowlist). */
function safeTableName(name: string, allowed: Set<string>): string {
  if (!allowed.has(name)) throw new Error(`Invalid table name: ${name}`);
  return `"${name}"`;
}

// ── Database Info ──

export function getDatabaseInfo(): DatabaseInfo {
  const sqlite = getSqlite();
  const stat = fs.statSync(dbPath);

  const tableNames = getUserTableNames(sqlite);
  const tableNameSet = new Set(tableNames);

  const tables: TableInfo[] = tableNames.map((name) => {
    const countResult = sqlite
      .prepare(`SELECT COUNT(*) as cnt FROM ${safeTableName(name, tableNameSet)}`)
      .get() as { cnt: number };
    const cols = (
      sqlite.pragma(`table_info(${name})`) as Array<{ name: string }>
    ).map((c) => c.name);
    return {
      name,
      rowCount: countResult.cnt,
      columnCount: cols.length,
    };
  });

  const sqliteVersion = (
    sqlite.prepare("SELECT sqlite_version() AS v").get() as { v: string }
  ).v;

  const journalMode = sqlite.pragma("journal_mode", { simple: true }) as string;
  const integrityResult = sqlite.pragma("integrity_check") as Array<{
    integrity_check: string;
  }>;
  const integrityOk =
    integrityResult.length === 1 && integrityResult[0].integrity_check === "ok";

  return {
    filePath: dbPath,
    fileSizeBytes: stat.size,
    fileSizeHuman: formatBytes(stat.size),
    lastModified: stat.mtime.toISOString(),
    sqliteVersion,
    journalMode,
    integrityOk,
    tables,
    totalRows: tables.reduce((sum, t) => sum + t.rowCount, 0),
  };
}

// ── JSON Dump ──

export function generateJsonDump(): DatabaseDump {
  const sqlite = getSqlite();
  const tableNames = getUserTableNames(sqlite);
  const tableNameSet = new Set(tableNames);

  const tables: Record<string, DumpTable> = {};

  for (const name of tableNames) {
    const safeName = safeTableName(name, tableNameSet);
    const columns = (
      sqlite.pragma(`table_info(${name})`) as Array<{ name: string }>
    ).map((c) => c.name);

    const rows = sqlite
      .prepare(`SELECT * FROM ${safeName}`)
      .all() as Record<string, unknown>[];

    // Normalize Buffer values to base64 strings for JSON serialization
    const normalizedRows = rows.map((row) => {
      const normalized: Record<string, unknown> = {};
      for (const col of columns) {
        const val = row[col];
        if (Buffer.isBuffer(val)) {
          normalized[col] = val.toString("base64");
        } else {
          normalized[col] = val ?? null;
        }
      }
      return normalized;
    });

    tables[name] = {
      columns,
      rows: normalizedRows,
    };
  }

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    tables,
  };
}

// ── SQL Dump ──

function escapeSqlValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  if (Buffer.isBuffer(val)) {
    return "X'" + val.toString("hex").toUpperCase() + "'";
  }
  // string — escape single quotes
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

export function generateSqlDump(): string {
  const sqlite = getSqlite();
  const tableNames = getUserTableNames(sqlite);
  const tableNameSet = new Set(tableNames);

  const lines: string[] = [
    `-- RabbitDocs Database Dump`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Version: 1`,
    ``,
    `PRAGMA foreign_keys=OFF;`,
    `BEGIN TRANSACTION;`,
    ``,
  ];

  for (const name of tableNames) {
    const safeName = safeTableName(name, tableNameSet);
    const columns = (
      sqlite.pragma(`table_info(${name})`) as Array<{ name: string }>
    ).map((c) => c.name);

    const rows = sqlite
      .prepare(`SELECT * FROM ${safeName}`)
      .all() as Record<string, unknown>[];

    lines.push(`-- Table: ${name} (${rows.length} rows)`);

    const colList = columns.map((c) => `"${c}"`).join(", ");

    for (const row of rows) {
      const values = columns.map((c) => escapeSqlValue(row[c])).join(", ");
      lines.push(`INSERT INTO "${name}" (${colList}) VALUES (${values});`);
    }

    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("PRAGMA foreign_keys=ON;");

  return lines.join("\n");
}

// ── Restore ──

export function restoreFromJson(
  dump: DatabaseDump,
  options?: { skipTables?: string[] }
): RestoreResult {
  const sqlite = getSqlite();

  const skipTables = new Set(options?.skipTables ?? []);

  // Get current table names for validation
  const currentTables = new Set(getUserTableNames(sqlite));

  const result = sqlite.transaction(() => {
    const stats: RestoreResult = { inserted: 0, skipped: 0, errors: [] };

    // Disable foreign keys during restore
    sqlite.pragma("foreign_keys = OFF");

    try {
      for (const [tableName, tableData] of Object.entries(dump.tables)) {
        if (skipTables.has(tableName)) {
          stats.skipped++;
          continue;
        }

        if (!currentTables.has(tableName)) {
          stats.skipped++;
          stats.errors.push({
            table: tableName,
            error: "Table does not exist in current schema",
          });
          continue;
        }

        // Get current columns for this table
        const currentCols = new Set(
          (
            sqlite.pragma(`table_info(${tableName})`) as Array<{ name: string }>
          ).map((c) => c.name)
        );

        // Only insert columns that exist in both dump and current schema
        const insertCols = tableData.columns.filter((c) => currentCols.has(c));

        if (insertCols.length === 0) {
          stats.skipped++;
          stats.errors.push({
            table: tableName,
            error: "No matching columns found",
          });
          continue;
        }

        // Clear existing data
        sqlite.prepare(`DELETE FROM "${tableName}"`).run();

        // Prepare insert statement
        const placeholders = insertCols.map(() => "?").join(",");
        const colList = insertCols.map((c) => `"${c}"`).join(",");
        const insertStmt = sqlite.prepare(
          `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`
        );

        for (const row of tableData.rows) {
          const values = insertCols.map((col) => {
            const val = row[col];
            // Handle base64-encoded Buffer values
            if (
              typeof val === "string" &&
              currentCols.has(col) &&
              tableData.columns.includes(col)
            ) {
              // Try to detect base64-encoded buffers (they were converted during dump)
              // We'll keep the value as-is since the schema stores text
            }
            return val === undefined ? null : val;
          });

          try {
            insertStmt.run(...values);
            stats.inserted++;
          } catch (e) {
            stats.errors.push({
              table: tableName,
              error: String(e),
            });
          }
        }
      }

      // Reset autoincrement sequences
      try {
        sqlite
          .prepare(
            "DELETE FROM sqlite_sequence WHERE name IN (SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%')"
          )
          .run();
      } catch {
        // sqlite_sequence table may not exist
      }
    } finally {
      // Re-enable foreign keys
      sqlite.pragma("foreign_keys = ON");
    }

    return stats;
  })();

  return result;
}
