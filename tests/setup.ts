import type { PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { afterAll, beforeAll, vi } from "vitest";
import * as schema from "@/models";
import { onRealPostgres } from "./helpers/postgres";
import { migrationStatements } from "./migrations";

// The tests run over PGlite, in memory, one database per test file. `npm run test:postgres` runs them over a real
// PostgreSQL instead (DATABASE_URL, a database that the run empties before each test file): the tests that
// need two connections at once (tests/helpers/postgres.ts) run there, and are skipped on PGlite, which has one.
// Create the client before vi.mock, since mocks are hoisted.
const client = onRealPostgres ? null : new PGlite();
const pool = onRealPostgres ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }) : null;
// Both are Drizzle databases over the same schema; the tests use what they have in common (`$client` is the PGlite
// one: the few tests that read it are about PGlite, and the types say so)
export const testDb = (pool ? drizzle({ client: pool, schema }) : drizzlePglite({ client: client!, schema })) as PgliteDatabase<typeof schema> & { $client: PGlite };

// Mock modules — vi.mock calls are hoisted by Vitest, so testDb is available
vi.mock("@/shared/lib/DB", () => ({
  db: testDb,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

vi.mock("@/features/auth/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: "test-user-1", name: "Test User", email: "test@test.com" },
    session: { id: "test-session-1" },
  }),
  requireAdmin: vi.fn().mockResolvedValue({
    user: {
      id: "test-admin-1",
      name: "Admin",
      email: "admin@test.com",
      isAdmin: true,
    },
    session: { id: "test-session-2" },
  }),
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-1", name: "Test User", email: "test@test.com" },
    session: { id: "test-session-1" },
  }),
  // Grants every role by default; tests/integration/server-action-guards.test.ts uses the real guards.
  requireRole: vi.fn().mockResolvedValue({
    session: {
      user: { id: "test-user-1", name: "Test User", email: "test@test.com" },
      session: { id: "test-session-1" },
    },
    member: { id: "member-test-user-1", role: "owner" },
  }),
}));

vi.mock("@/features/events/emitter", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

afterAll(async () => {
  await pool?.end();
});

// Apply the migrations before the tests of each file. PGlite is new for each file; a real PostgreSQL is one database
// for the whole run (the files go one after the other), so each file empties it and migrates it again, to start from
// what a new PGlite is.
beforeAll(async () => {
  if (pool) {
    await pool.query("drop schema if exists public cascade");
    await pool.query("create schema public");
    for (const statement of migrationStatements) {
      await pool.query(statement);
    }

    return;
  }

  for (const statement of migrationStatements) {
    await client!.exec(statement);
  }
});
