import { getRawClient, dbPath } from "@/db";
import fs from "fs";
import path from "path";

// ── Types ──

export interface TableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface DatabaseInfo {
  dataDir: string;
  fileSizeBytes: number;
  fileSizeHuman: string;
  pgVersion: string;
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
  /** 事务回滚标志 — 如果为 true，表示所有 INSERT 均未生效 */
  rolledBack?: boolean;
}

// ── Helpers ──

function getDirectorySize(dirPath: string): number {
  let totalSize = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirectorySize(fullPath);
      } else {
        totalSize += fs.statSync(fullPath).size;
      }
    }
  } catch { /* ok */ }
  return totalSize;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function pgEscape(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ── Boolean column normalization (SQLite → PGlite migration compat) ──

/**
 * 查询 information_schema 获取所有 public schema 下的 boolean 列。
 * 返回 Map<tableName, Set<columnName>>，用于恢复时做类型规范化。
 */
async function getBooleanColumnMap(
  client: { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> }
): Promise<Map<string, Set<string>>> {
  const res = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'boolean'`
  );
  const map = new Map<string, Set<string>>();
  for (const row of res.rows) {
    const tableName = row.table_name as string;
    const colName = row.column_name as string;
    let cols = map.get(tableName);
    if (!cols) {
      cols = new Set();
      map.set(tableName, cols);
    }
    cols.add(colName);
  }
  return map;
}

/**
 * 将行中 boolean 列的整数值（0/1）规范化为 JS boolean。
 * 仅修改已知为 boolean 类型的列，不影响真实整数列。
 */
function normalizeBooleanColumns(
  row: Record<string, unknown>,
  booleanColumns: Set<string> | undefined
): void {
  if (!booleanColumns) return;
  for (const col of booleanColumns) {
    if (!(col in row)) continue;
    const val = row[col];
    if (typeof val === "number") {
      row[col] = val !== 0;
    } else if (typeof val === "string") {
      if (val === "0") row[col] = false;
      else if (val === "1") row[col] = true;
    }
  }
}

// ── Public API ──

export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  const client = getRawClient();

  // PG version
  const versionRes = await client.query<{ v: string }>("SELECT version() as v");
  const pgVersionFull = versionRes.rows[0]?.v || "PostgreSQL (PGlite)";
  const pgVersion = pgVersionFull.split(" ").slice(0, 2).join(" ");

  // Public tables
  const tablesRes = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const tableNames = tablesRes.rows.map(r => r.tablename);

  const tables: TableInfo[] = [];
  let totalRows = 0;

  for (const name of tableNames) {
    const countRes = await client.query<{ cnt: number }>(
      `SELECT count(*)::int as cnt FROM "${name}"`
    );
    const rowCount = countRes.rows[0]?.cnt || 0;
    totalRows += rowCount;

    const colRes = await client.query<{ cnt: number }>(
      "SELECT count(*)::int as cnt FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [name]
    );
    const columnCount = colRes.rows[0]?.cnt || 0;

    tables.push({ name, rowCount, columnCount });
  }

  const dataDir = dbPath();
  const fileSizeBytes = getDirectorySize(dataDir);

  return {
    dataDir,
    fileSizeBytes,
    fileSizeHuman: formatBytes(fileSizeBytes),
    pgVersion,
    tables,
    totalRows,
  };
}

export async function generateJsonDump(): Promise<DatabaseDump> {
  const client = getRawClient();

  const tablesRes = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const tableNames = tablesRes.rows.map(r => r.tablename);

  const dump: DatabaseDump = {
    version: 1,
    timestamp: new Date().toISOString(),
    tables: {},
  };

  for (const name of tableNames) {
    const res = await client.query(`SELECT * FROM "${name}"`);
    const rows = res.rows as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    dump.tables[name] = { columns, rows };
  }

  return dump;
}

export async function generateSqlDump(): Promise<string> {
  const client = getRawClient();

  const tablesRes = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const tableNames = tablesRes.rows.map(r => r.tablename);

  const lines: string[] = [
    "-- ChatWiki PGlite Database Dump",
    `-- Generated at: ${new Date().toISOString()}`,
    "",
  ];

  for (const name of tableNames) {
    const res = await client.query(`SELECT * FROM "${name}"`);
    const rows = res.rows as Record<string, unknown>[];

    lines.push(`-- Table: ${name} (${rows.length} rows)`);

    if (rows.length === 0) {
      lines.push("");
      continue;
    }

    const columns = Object.keys(rows[0]);

    for (const row of rows) {
      const values = columns.map(col => pgEscape(row[col]));
      lines.push(
        `INSERT INTO "${name}" ("${columns.join('", "')}") VALUES (${values.join(", ")});`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 拓扑排序常量 — 确保被引用的表先于引用它的表处理。
 *
 * Level 0: 独立表（无 FK 依赖）
 * Level 1: FK 引用 Level 0
 * Level 2: FK 引用 Level 1
 */
const RESTORE_INSERT_ORDER: string[] = [
  // Level 0: Independent tables (no FK references)
  "accounts",
  "enterprises",
  "plans",
  "users",
  "model_configs",
  "mcp_config",
  "sandbox_config",
  "storage_config",
  "templates",
  "system_prompts",
  "system_settings",
  "chats",
  "shared_html_files",
  "operation_logs",
  "document_activities",
  "todos",
  "token_usage_logs",
  "entities",
  "entity_members",
  "entity_repositories",
  "notification_jobs",

  // Level 1: FK references to Level 0
  "organisations",           // → enterprises
  "chat_messages",            // → chats
  "shared_chats",             // → chats
  "invite_codes",             // → users
  "email_verifications",      // → users
  "passkeys",                 // → users
  "cli_authorization_codes",  // → users
  "cli_tokens",               // → users
  "api_keys",                 // → users
  "user_model_configs",       // → users
  "orders",                   // → users, plans
  "user_subscriptions",       // → users, plans

  // Level 2: FK references to Level 1
  "refunds",                  // → orders, users
  "sandbox_applications",     // → users
];

/**
 * 将 dump 中的表按拓扑排序排列。
 * dump 中有但不在排序列表中的表追加到末尾（兜底）。
 */
function getOrderedTables(
  tables: Record<string, DumpTable>,
  skipTables: Set<string>
): string[] {
  const dumpTableNames = new Set(
    Object.keys(tables).filter((name) => !skipTables.has(name))
  );

  const ordered: string[] = [];
  for (const name of RESTORE_INSERT_ORDER) {
    if (dumpTableNames.has(name)) {
      ordered.push(name);
      dumpTableNames.delete(name);
    }
  }
  // 兜底：dump 中有但不在排序列表中的表（未来新增的表）
  for (const name of dumpTableNames) {
    ordered.push(name);
  }
  return ordered;
}

export async function restoreFromJson(
  dump: DatabaseDump,
  options?: { skipTables?: string[] }
): Promise<RestoreResult> {
  const client = getRawClient();
  const skipTables = new Set(options?.skipTables || []);
  const orderedTables = getOrderedTables(dump.tables, skipTables);

  // 统计跳过的行数
  let skipped = 0;
  for (const [tableName, tableData] of Object.entries(dump.tables)) {
    if (skipTables.has(tableName)) {
      skipped += tableData.rows.length;
    }
  }

  try {
    const inserted = await client.transaction(async (tx) => {
      let totalInserted = 0;
    
      // 获取布尔列映射（单次查询，覆盖所有表）
      const booleanColumnMap = await getBooleanColumnMap(tx);
    
      // Phase 1: DELETE in reverse topological order (leaf tables first)
      // 这样可以避免 NO ACTION 外键约束阻塞 DELETE
      for (let i = orderedTables.length - 1; i >= 0; i--) {
        await tx.query(`DELETE FROM "${orderedTables[i]}"`);
      }
    
      // Phase 2: INSERT in topological order (root tables first)
      // 这样可以确保被引用的行先于引用它的行存在
      for (const tableName of orderedTables) {
        const tableData = dump.tables[tableName];
        if (!tableData) continue;
        for (const row of tableData.rows) {
          // 将布尔列中的整数 0/1 规范化为 JS boolean
          normalizeBooleanColumns(row, booleanColumnMap.get(tableName));
          const columns = Object.keys(row);
          const values = columns.map((col) => pgEscape(row[col]));
          await tx.query(
            `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${values.join(", ")})`
          );
          totalInserted++;
        }
      }
    
      return totalInserted;
    });

    // Reset all serial sequences after data restore
    await resetSerialSequences();

    return { inserted, skipped, errors: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      inserted: 0,
      skipped,
      errors: [{ table: "_transaction", error: `Restore rolled back: ${msg}` }],
      rolledBack: true,
    };
  }
}

/**
 * Reset all serial sequences to MAX(id) so next nextval() returns MAX(id) + 1.
 * Must be called AFTER data has been inserted (e.g. after restoreFromJson).
 *
 * Uses pg_tables + pg_get_serial_sequence() to discover serial columns —
 * compatible with PGlite where pg_depend catalog is not fully supported.
 */
export async function resetSerialSequences(): Promise<void> {
  const client = getRawClient();

  // Get all public tables
  const tablesRes = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );

  let resetCount = 0;

  for (const { tablename } of tablesRes.rows) {
    // Check if this table has a serial sequence on the 'id' column
    const seqRes = await client.query<{ seq: string | null }>(
      `SELECT pg_get_serial_sequence('"${tablename}"', 'id') AS seq`
    );
    const seqName = seqRes.rows[0]?.seq;
    if (!seqName) continue; // Not a serial column — skip

    const maxRes = await client.query<{ m: number | null }>(
      `SELECT MAX("id") AS m FROM "${tablename}"`
    );
    const maxVal = maxRes.rows[0]?.m;

    if (maxVal !== null && maxVal !== undefined) {
      // Non-empty table: setval(seq, N) makes next nextval() return N+1
      await client.query(`SELECT setval('${seqName}', ${maxVal})`);
    } else {
      // Empty table: restart sequence at 1
      await client.query(`ALTER SEQUENCE ${seqName} RESTART WITH 1`);
    }
    resetCount++;
  }

  console.log(`[db] Serial sequences reset for ${resetCount} tables.`);
}
