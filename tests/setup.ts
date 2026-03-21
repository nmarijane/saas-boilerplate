import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, vi } from "vitest";
import * as schema from "@/models";

// Create in-memory PGlite instance (must be before vi.mock since mocks are hoisted)
const client = new PGlite();
export const testDb = drizzle(client, { schema });

// Read all migration SQL files in order
const migrationsDir = resolve(__dirname, "../migrations");
const migrationSQL = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(resolve(migrationsDir, f), "utf-8"))
  .join("\n--> statement-breakpoint\n");

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
}));

vi.mock("@/features/events/emitter", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

// Apply migration before all tests
beforeAll(async () => {
  const statements = migrationSQL
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.exec(statement);
  }
});
