import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, vi } from "vitest";
import * as schema from "@/models";

// Create in-memory PGlite instance (must be before vi.mock since mocks are hoisted)
const client = new PGlite();
export const testDb = drizzle(client, { schema });

// Read migration SQL
const migrationSQL = readFileSync(
  resolve(__dirname, "../migrations/0000_shallow_dust.sql"),
  "utf-8",
);

// Mock modules — vi.mock calls are hoisted by Vitest, so testDb is available
vi.mock("@/shared/lib/DB", () => ({
  db: testDb,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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
