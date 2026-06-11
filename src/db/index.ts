import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import fs from "fs";
import os from "os";
import path from "path";

// ── Global singleton to survive HMR hot reloads ──
const globalForDb = globalThis as typeof globalThis & {
  __pgliteClient?: PGlite;
  __pgliteDrizzle?: ReturnType<typeof drizzle<typeof schema>>;
  __pgliteReady?: Promise<void>;
  __pgliteReadyFlag?: boolean;
};

// ── Lazy path computation ──
let _rabbitdocsHome: string | undefined;
function getRabbitdocsHome(): string {
  if (!_rabbitdocsHome) {
    _rabbitdocsHome = process.env.RABBITDOCS_HOME || path.join(os.homedir(), ".rabbitdocs");
  }
  return _rabbitdocsHome;
}

let _dataDir: string | undefined;
function getDataDir(): string {
  if (!_dataDir) {
    _dataDir = path.join(getRabbitdocsHome(), "pgdata");
  }
  return _dataDir;
}

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Eagerly create PGlite + Drizzle instances (both synchronous).
 * The actual PG backend readiness is deferred to initDb().
 */
function ensureInstance(): void {
  if (globalForDb.__pgliteDrizzle) return;
  if (isBuildPhase()) return;

  const dataDir = getDataDir();
  const home = getRabbitdocsHome();

  if (!fs.existsSync(home)) {
    fs.mkdirSync(home, { recursive: true });
  }

  // Clean up stale postmaster.pid left by ungraceful shutdown
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      console.log("[db] Cleaned up stale postmaster.pid");
    } catch { /* ignore */ }
  }

  console.log(`[db] Creating PGlite instance at ${dataDir}...`);
  const client = new PGlite(dataDir);
  const drizzleInstance = drizzle(client, { schema });

  globalForDb.__pgliteClient = client;
  globalForDb.__pgliteDrizzle = drizzleInstance;
}

// ── Create instance eagerly at module load time ──
// PGlite constructor is synchronous; waitReady is async and handled in initDb().
// This ensures the Proxy always has a real Drizzle instance to delegate to.
ensureInstance();

/**
 * Initialize the database (called from instrumentation.ts at server startup).
 * Waits for PGlite backend readiness, runs migrations and seed.
 */
export async function initDb(): Promise<void> {
  if (isBuildPhase()) return;
  // Ensure instance exists (may already be created by ensureInstance above)
  ensureInstance();
  // Already fully initialized
  if (globalForDb.__pgliteReadyFlag) return;
  // Already initializing — wait for the same promise
  if (globalForDb.__pgliteReady) return globalForDb.__pgliteReady;

  globalForDb.__pgliteReady = (async () => {
    try {
      const client = globalForDb.__pgliteClient!;

      console.log("[db] Waiting for PGlite backend readiness...");
      await client.waitReady;
      console.log("[db] PGlite backend ready.");

      // Run migrations using Drizzle's built-in migrator
      const migrationsDir = path.join(process.cwd(), "drizzle");
      if (fs.existsSync(migrationsDir)) {
        const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));
        if (sqlFiles.length > 0) {
          console.log(`[db] Running ${sqlFiles.length} migrations...`);
          await migrate(globalForDb.__pgliteDrizzle!, { migrationsFolder: migrationsDir });
          console.log("[db] Migrations applied successfully.");
        }
      }

      // ── Ad-hoc schema patches (idempotent, safe for all environments) ──
      try {
        const patches = [
          "ALTER TABLE entities ADD COLUMN IF NOT EXISTS publish_status TEXT",
          "ALTER TABLE todos ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0 NOT NULL",
        ];
        for (const sql of patches) {
          await client.query(sql);
        }
        console.log("[db] Schema patches applied.");
      } catch (err) {
        console.error("[db] Schema patch failed:", err);
      }

      // Run seed
      try {
        const { seed } = await import("./seed");
        await seed();
      } catch (err) {
        console.error("[seed] Error:", err);
      }

      // Reset serial sequences as safety measure (covers edge cases
      // like DB restore, manual edits, or migration oddities)
      try {
        const { resetSerialSequences } = await import("@/lib/db-dump");
        await resetSerialSequences();
      } catch (err) {
        console.error("[db] Sequence reset failed:", err);
      }

      // Initialize data root from DB config
      try {
        const { initDataRootFromDb } = await import("@/lib/fs/core");
        await initDataRootFromDb();
      } catch { /* ok */ }

      globalForDb.__pgliteReadyFlag = true;
      console.log("[db] Database initialized successfully.");
    } catch (err) {
      console.error("[db] Failed to initialize:", err);
      globalForDb.__pgliteReady = undefined;
      throw err;
    }
  })();

  return globalForDb.__pgliteReady;
}

/**
 * The Drizzle DB instance. Always available after module load.
 * During build phase, returns undefined (Turbopack type-checking).
 * At runtime, delegates directly to the real drizzle instance.
 *
 * Note: actual queries will fail until initDb() completes (PGlite
 * backend not ready), but the chain builder API (db.select().from()...)
 * works immediately.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (isBuildPhase()) return undefined;
    // Ensure instance exists (safety net for edge cases)
    ensureInstance();
    return Reflect.get(globalForDb.__pgliteDrizzle!, prop, receiver);
  },
});

// ── Graceful shutdown ──
async function shutdown() {
  try {
    if (globalForDb.__pgliteClient) {
      await globalForDb.__pgliteClient.close();
    }
  } catch { /* ok */ }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/** Get the raw PGlite client for direct SQL queries (e.g., admin dump/restore). */
export function getRawClient(): PGlite {
  if (!globalForDb.__pgliteClient) throw new Error("[db] Database not initialized.");
  return globalForDb.__pgliteClient;
}

/** Database data directory path (for info purposes). */
export { getDataDir as dbPath };
