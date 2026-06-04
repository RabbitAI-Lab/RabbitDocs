import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import os from "os";
import path from "path";

const RABBITDOCS_HOME =
  process.env.RABBITDOCS_HOME ||
  path.join(os.homedir(), ".rabbitdocs");
const DB_PATH = path.join(RABBITDOCS_HOME, "data.db");
const WAL_PATH = DB_PATH + "-wal";
const SHM_PATH = DB_PATH + "-shm";
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

// ── Migration tracking ──
const MIGRATIONS_TABLE = "_migrations";

function ensureMigrationsTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
}

/**
 * If the _migrations table didn't exist before this call, it means we are upgrading
 * an existing database that was created by running all migrations blindly.
 * In that case, mark ALL existing migration files as already applied.
 */
function bootstrapMigrationTracking(db: Database.Database): boolean {
  const tableExists = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(MIGRATIONS_TABLE)) != null;
  ensureMigrationsTable(db);
  if (tableExists) return false; // already bootstrapped
  // First time: mark all existing migration files as applied
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT OR IGNORE INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES (?, ?)`);
  for (const file of files) {
    insert.run(file, now);
  }
  console.log(`[db] Bootstrapped migration tracking: marked ${files.length} existing migrations as applied.`);
  return true;
}

function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function recordMigration(db: Database.Database, name: string) {
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES (?, ?)`).run(name, now);
}

// ── Run all migrations (fresh DB only) ──
function runMigrations(db: Database.Database) {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();
  
  console.log(`[db] Running ${files.length} migrations on fresh database...`);
  ensureMigrationsTable(db);
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    db.exec(sql);
    recordMigration(db, file);
    console.log(`[db]   ✓ ${file}`);
  }
}

function checkIntegrity(db: Database.Database): boolean {
  try {
    const result = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    return result.length === 1 && result[0].integrity_check === "ok";
  } catch {
    return false;
  }
}

function hasSchema(db: Database.Database): boolean {
  try {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get() as { name: string } | undefined;
    return !!result;
  } catch {
    return false;
  }
}

function tryApplyPragmas(db: Database.Database): boolean {
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return true;
  } catch {
    return false;
  }
}

// ── Initialize database ──
function initDatabase(): Database.Database {
  // Ensure ~/.rabbitdocs directory exists
  if (!fs.existsSync(RABBITDOCS_HOME)) {
    fs.mkdirSync(RABBITDOCS_HOME, { recursive: true });
  }

  const db = new Database(DB_PATH);

  if (tryApplyPragmas(db) && checkIntegrity(db) && hasSchema(db)) {
    // Existing healthy database with schema — apply only NEW migrations
    try {
      bootstrapMigrationTracking(db);
      const applied = getAppliedMigrations(db);
      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith(".sql"))
        .sort()
        .filter(f => !applied.has(f));

      if (migrationFiles.length > 0) {
        console.log(`[db] Applying ${migrationFiles.length} new migrations...`);
        for (const file of migrationFiles) {
          try {
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
            const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
            for (const stmt of statements) {
              try {
                db.exec(stmt);
              } catch {
                // Individual statement may fail if already applied — that's ok
              }
            }
            recordMigration(db, file);
            console.log(`[db]   ✓ ${file}`);
          } catch {
            // File read error — skip
          }
        }
      } else {
        console.log("[db] All migrations already applied.");
      }
    } catch { /* directory read error */ }
    return db;
  }

  // Database missing schema or integrity check failed — recreate from scratch
  console.warn(
    !checkIntegrity(db)
      ? "[db] Integrity check FAILED, recreating database..."
      : "[db] Schema missing, recreating database..."
  );
  db.close();

  for (const p of [DB_PATH, WAL_PATH, SHM_PATH]) {
    try { fs.unlinkSync(p); } catch { /* ok */ }
  }

  const newDb = new Database(DB_PATH);
  newDb.pragma("journal_mode = WAL");
  newDb.pragma("foreign_keys = ON");

  runMigrations(newDb);

  console.log("[db] Database initialized successfully.");
  return newDb;
}

// ── Lazy singleton: defer DB init until first runtime access ──
// During `next build`, modules are imported for type-checking and SSG.
// By detecting the build phase, we skip DB initialization entirely.
// The DB is explicitly initialized via initDb() in instrumentation.ts
// which only runs at server startup, not during build.

let _sqlite: Database.Database | null = null;
let _drizzleInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _seeded = false;

function isBuildPhase(): boolean {
  // Next.js sets NEXT_PHASE during build; also support explicit opt-out
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Explicitly initialize the database (called from instrumentation.ts at server startup).
 * This ensures migrations and seeding happen at runtime, not during build.
 */
export function initDb() {
  if (_sqlite) return; // already initialized
  _sqlite = initDatabase();
  _drizzleInstance = drizzle(_sqlite, { schema });
  // Run seed once
  if (!_seeded) {
    _seeded = true;
    import("./seed").then(({ seed }) => seed()).catch((err) => console.error("[seed] Error:", err));
  }
}

/**
 * Get the drizzle DB instance, initializing lazily if needed.
 * During build phase, property accesses are silently ignored (returns undefined).
 * At runtime, this initializes on first access and returns a real instance.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (isBuildPhase()) return undefined;
    if (!_drizzleInstance) {
      initDb();
    }
    return Reflect.get(_drizzleInstance!, prop, receiver);
  },
});

// ── Graceful shutdown ──
function shutdown() {
  try {
    if (_sqlite) {
      _sqlite.pragma("wal_checkpoint(TRUNCATE)");
      _sqlite.close();
    }
  } catch { /* ok */ }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
