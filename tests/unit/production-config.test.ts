import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertDatabaseConfigured, productionProblems, refuseToStartMisconfigured } from "@/shared/lib/production-config";

/**
 * What a production server refuses to start without: a database. With no `DATABASE_URL` the app
 * falls back to PGlite, a folder on the server's disk, which is fine to develop on and never
 * what a deployment wants. A build, a script, the dev server and the tests are not production servers.
 */

describe("a server that would run on the local database", () => {
  it("is refused in production, with a message that says what to set", () => {
    expect(() => assertDatabaseConfigured({ NODE_ENV: "production" })).toThrow(/DATABASE_URL is not set/);
    expect(() => assertDatabaseConfigured({ NODE_ENV: "production", DATABASE_URL: "" })).toThrow(/PostgreSQL/);
  });

  it("is fine with a DATABASE_URL", () => {
    expect(() => assertDatabaseConfigured({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@db/app" })).not.toThrow();
  });

  it("is fine in development, in the tests and in a script", () => {
    for (const NODE_ENV of ["development", "test", undefined]) {
      expect(() => assertDatabaseConfigured({ NODE_ENV })).not.toThrow();
    }
  });

  // `next build` runs with NODE_ENV=production and no database
  it("is fine while building", () => {
    expect(() => assertDatabaseConfigured({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
  });

  it("is fine when it is asked for by name: the end-to-end tests serve a production build over a throwaway database", () => {
    expect(() => assertDatabaseConfigured({ NODE_ENV: "production", ALLOW_PGLITE_IN_PRODUCTION: "1" })).not.toThrow();
    expect(() => assertDatabaseConfigured({ NODE_ENV: "production", ALLOW_PGLITE_IN_PRODUCTION: "yes" })).toThrow();
  });
});

const GOOD = { NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@db/app", BETTER_AUTH_SECRET: "a".repeat(32), TRUST_PROXY: "1" };

describe("a whitespace DATABASE_URL", () => {
  it("is refused, and the message says it is only whitespace", () => {
    expect(() => assertDatabaseConfigured({ NODE_ENV: "production", DATABASE_URL: "   " })).toThrow(/only whitespace/);
  });
});

describe("what a production server is refused for", () => {
  it("is nothing for a good configuration", () => {
    expect(productionProblems(GOOD)).toEqual([]);
  });

  it("is nothing outside a production server: development, tests, scripts and the build", () => {
    for (const variables of [{ NODE_ENV: "development" }, { NODE_ENV: "test" }, {}, { NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }]) {
      expect(productionProblems(variables)).toEqual([]);
    }
  });

  describe("the proxy", () => {
    it("is refused when nothing is decided: one shared limit for everyone is a choice to make by name", () => {
      expect(productionProblems({ ...GOOD, TRUST_PROXY: undefined })).toEqual([expect.stringContaining("TRUST_PROXY is not set")]);
      expect(productionProblems({ ...GOOD, TRUST_PROXY: " " })).toEqual([expect.stringContaining("TRUST_PROXY is not set")]);
    });

    it.each(["vercel", "none", "1", "2", " VERCEL "])("accepts %j", (TRUST_PROXY) => {
      expect(productionProblems({ ...GOOD, TRUST_PROXY })).toEqual([]);
    });

    it.each(["cloudflare", "true", "0", "yes", "100", "vercell", "1 2"])("refuses the typo %j, and says what it read", (TRUST_PROXY) => {
      expect(productionProblems({ ...GOOD, TRUST_PROXY })).toEqual([expect.stringContaining("is not `vercel`, `none` or a number")]);
    });

    it("means vercel on Vercel when nothing is set, and an explicit value wins", () => {
      expect(productionProblems({ ...GOOD, TRUST_PROXY: undefined, VERCEL: "1" })).toEqual([]);
      expect(productionProblems({ ...GOOD, TRUST_PROXY: "cloudflare", VERCEL: "1" })).toHaveLength(1);
    });
  });

  describe("the secret of Better Auth", () => {
    it.each([undefined, "", "   ", "x", "your-secret-key-change-me", "a".repeat(31), `${" ".repeat(10)}${"a".repeat(31)}${" ".repeat(10)}`])(
      "refuses %j: missing, or shorter than 32 characters once trimmed",
      (BETTER_AUTH_SECRET) => {
        expect(productionProblems({ ...GOOD, BETTER_AUTH_SECRET })).toEqual([expect.stringContaining("BETTER_AUTH_SECRET")]);
      },
    );

    it("accepts 32 characters", () => {
      expect(productionProblems({ ...GOOD, BETTER_AUTH_SECRET: "b".repeat(32) })).toEqual([]);
    });
  });

  it("lists every problem at once", () => {
    expect(productionProblems({ NODE_ENV: "production" })).toHaveLength(3);
  });
});

// The client that the app queries through (DB.ts) is made by its first query, and that is where the check is wired
describe("the database client of the app", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    delete (globalThis as { db?: unknown }).db;
  });

  async function loadDb() {
    delete (globalThis as { db?: unknown }).db;
    vi.resetModules();

    return (await vi.importActual<typeof import("@/shared/lib/DB")>("@/shared/lib/DB")).db;
  }

  it("is loaded by a production server with no DATABASE_URL, and refuses its first query", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ALLOW_PGLITE_IN_PRODUCTION", "");

    const db = await loadDb();

    await expect(Promise.resolve().then(async () => void (await db.execute(sql`select 1`)))).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/DATABASE_URL is not set/) },
    });
  });

  it("is loaded by a build without a word: nothing is queried, and the check is of a server", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("DATABASE_URL", "");

    await expect(loadDb()).resolves.toBeDefined();
  });
});

// Next.js logs an error thrown by the instrumentation hook and serves all the same: the refusal has to end the process
describe("refusing to start", () => {
  it("ends the process with the problems when a production server is misconfigured", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const report = vi.spyOn(console, "error").mockImplementation(() => {});

    refuseToStartMisconfigured({ NODE_ENV: "production" });

    expect(report).toHaveBeenCalledWith(expect.stringMatching(/DATABASE_URL is not set[\s\S]*BETTER_AUTH_SECRET[\s\S]*TRUST_PROXY/));
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    exit.mockRestore();
    report.mockRestore();
  });

  it("lets a configuration that is good, and a server that is not production, start", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    refuseToStartMisconfigured(GOOD);
    refuseToStartMisconfigured({ NODE_ENV: "development" });

    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
  });
});
