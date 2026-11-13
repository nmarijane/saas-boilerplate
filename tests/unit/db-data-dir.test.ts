import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The database of the app (DB.ts): PGlite on a local directory, `./local.db`
 * unless `PGLITE_DATA_DIR` names another (the screenshots run on one of their
 * own), or PostgreSQL when there is a DATABASE_URL. Its client is made by the
 * first query, not when the module loads: `next dev` loads each page in a
 * worker of its own to read its static params, then ends it, and a PGlite that
 * such a worker opened on the directory broke it for the server. PGlite, the
 * pool of `pg` and the lock of the directory are stand-ins here, to see what is
 * made, and when.
 */

const made = vi.hoisted(() => ({
  pglites: [] as (string | undefined)[],
  pools: [] as unknown[],
  locks: [] as string[],
  // The connections the pool lent, and how many came back
  connections: { lent: 0, released: 0 },
  // How many times the lock refuses the directory before it lets it be taken
  refusals: 0,
  refusal: new Error("The local database is open in another process"),
}));

vi.mock("@electric-sql/pglite", () => ({
  PGlite: class {
    waitReady = Promise.resolve();

    constructor(dataDir?: string) {
      made.pglites.push(dataDir);
    }

    async query() {
      return { rows: [], fields: [] };
    }
  },
}));
vi.mock("pg", () => {
  class Pool {
    constructor(config: unknown) {
      made.pools.push(config);
    }

    async query() {
      return { rows: [], fields: [] };
    }

    async connect() {
      made.connections.lent += 1;

      return {
        query: async () => ({ rows: [], fields: [] }),
        release: () => {
          made.connections.released += 1;
        },
      };
    }
  }

  return { Pool, default: { Pool } };
});
vi.mock("@/shared/lib/pglite-lock", () => ({
  lockPgliteDirectory: (dir: string) => {
    made.locks.push(dir);
    if (made.refusals > 0) {
      made.refusals -= 1;
      throw made.refusal;
    }
  },
}));

// The client is kept on the global object, and a second load would find it there,
// as it would find the PGlite clients that openPglite() keeps.
const globals = globalThis as unknown as { db?: unknown; pgliteClients?: unknown };

/** A copy of the real DB.ts, as a bundle of the server loads it (the setup mocks it for every test). */
async function loadCopy() {
  vi.resetModules();
  const { db } = await vi.importActual<typeof import("@/shared/lib/DB")>("@/shared/lib/DB");

  return db;
}

/** What one query, any query, makes. */
async function query(db: Awaited<ReturnType<typeof loadCopy>>) {
  await db.execute(sql`select 1`);
}

describe("the database of the app (DB.ts)", () => {
  let sandbox: string;
  // A directory two levels down, of which only the sandbox exists
  let dataDir: string;

  beforeEach(() => {
    made.pglites.length = 0;
    made.pools.length = 0;
    made.locks.length = 0;
    made.connections = { lent: 0, released: 0 };
    made.refusals = 0;
    delete globals.db;
    delete globals.pgliteClients;
    sandbox = mkdtempSync(join(tmpdir(), "db-data-dir-"));
    dataDir = join(sandbox, "nested", "db");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete globals.db;
    delete globals.pgliteClients;
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("opens nothing when it is loaded: no PGlite, no lock, no folder", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PGLITE_DATA_DIR", dataDir);

    await loadCopy();

    expect(made.pglites).toEqual([]);
    expect(made.locks).toEqual([]);
    expect(existsSync(join(sandbox, "nested"))).toBe(false);
  });

  it("opens the directory that PGLITE_DATA_DIR names at the first query, after its lock, and makes the folders above it", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PGLITE_DATA_DIR", dataDir);

    await query(await loadCopy());

    expect(made.pglites).toEqual([dataDir]);
    expect(made.locks).toEqual([dataDir]);
    expect(existsSync(join(sandbox, "nested"))).toBe(true);
  });

  // The seed may hold the directory when the first query of the server comes: the
  // next query tries again, and finds it free once the seed has ended
  it("opens the directory at the next query when the first one was refused", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PGLITE_DATA_DIR", dataDir);
    made.refusals = 1;
    const db = await loadCopy();

    await expect(query(db)).rejects.toMatchObject({ cause: made.refusal });
    expect(made.pglites).toEqual([]);

    await query(db);

    expect(made.pglites).toEqual([dataDir]);
  });

  it("opens ./local.db when it names none", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PGLITE_DATA_DIR", undefined);

    await query(await loadCopy());

    expect(made.pglites).toEqual(["./local.db"]);
  });

  // One server holds several copies of this module (one per bundle: the pages,
  // the route handlers...). Each opened a PGlite of its own on the same
  // directory, and what one wrote (a session at sign-in) was not seen by the
  // others: the next page sent the person back to sign in.
  it("opens one client for every copy of the module and every query, in production too", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PGLITE_DATA_DIR", dataDir);
    vi.stubEnv("NODE_ENV", "production");
    // A production server refuses the local database unless it is asked for by name (production-config.ts): the e2e server is one
    vi.stubEnv("ALLOW_PGLITE_IN_PRODUCTION", "1");

    await query(await loadCopy());
    expect(made.pglites).toHaveLength(1);

    await query(await loadCopy());
    await query(await loadCopy());

    expect(made.pglites).toHaveLength(1);
    expect(made.locks).toHaveLength(1);
  });

  it("with a DATABASE_URL, makes its pool at the first query, once, and no PGlite and no folder", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/app");
    vi.stubEnv("PGLITE_DATA_DIR", dataDir);

    const db = await loadCopy();
    expect(made.pools).toEqual([]);

    await query(db);
    await query(await loadCopy());

    expect(made.pools).toEqual([{ connectionString: "postgresql://user:password@localhost:5432/app" }]);
    expect(made.pglites).toEqual([]);
    expect(made.locks).toEqual([]);
    expect(existsSync(join(sandbox, "nested"))).toBe(false);
  });

  // Drizzle tells a pool by its class: run on the pool itself, each statement of a
  // transaction could go to another connection, and BEGIN would hold none of them
  it("with a DATABASE_URL, runs a transaction on one connection of its pool, and gives it back", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/app");

    const db = await loadCopy();
    await db.transaction(async (tx) => {
      await tx.execute(sql`select 1`);
    });

    expect(made.connections).toEqual({ lent: 1, released: 1 });
  });
});
