import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "@/models";
import { baseEnv, closedPort, ROOT, runSeed, TSX } from "../helpers/scripts";

/**
 * The scripts read the same environment as the app. Next reads the `.env*`
 * files for `next dev` and `next build`; `tsx` reads none, and `drizzle-kit`
 * reads `.env` and not `.env.local`, so a `DATABASE_URL` in `.env.local`, as
 * CONTRIBUTING says to put it, sent the seed to the local PGlite and the
 * migrations to `postgresql://localhost:5432/boilerplate`. `scripts/load-env.ts`
 * loads the files as Next does; the seed and the Drizzle config import it first.
 *
 * Each case runs from a folder of its own that holds the `.env*` files: that is
 * where the scripts look, and it keeps a real `.env.local` out of the tests.
 */

const DRIZZLE_KIT = join(ROOT, "node_modules/.bin/drizzle-kit");
const folders: string[] = [];

/** A folder to run a script from, holding these files. */
function project(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "script-env-"));
  folders.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }

  return dir;
}

/** What `process.env` holds, for these names, once `scripts/load-env.ts` has run from `dir`: null for a variable that is not set. */
function loaded(dir: string, names: string[], env: Record<string, string> = {}) {
  const script = `
    import ${JSON.stringify(pathToFileURL(join(ROOT, "scripts/load-env.ts")).href)};
    console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(names)}.map((name) => [name, process.env[name] ?? null]))));
  `;
  const out = execFileSync(process.execPath, ["--import", TSX, "--input-type=module", "-e", script], {
    cwd: dir,
    env: baseEnv({ NODE_ENV: "development", ...env }),
    encoding: "utf8",
  });

  return JSON.parse(out) as Record<string, string | null>;
}

/** The ids of the plans a PGlite directory holds. */
async function plansIn(dataDir: string): Promise<string[]> {
  const client = new PGlite(dataDir);
  try {
    const rows = await drizzle(client, { schema }).select({ id: schema.plan.id }).from(schema.plan);

    return rows.map(({ id }) => id).sort();
  } finally {
    await client.close();
  }
}

afterEach(() => {
  for (const dir of folders.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("scripts/load-env.ts", () => {
  it("sets a variable that only an .env file holds, and takes .env.local over .env", () => {
    const dir = project({
      ".env": "FOO=from-env\nONLY_ENV=yes\n",
      ".env.local": "FOO=from-env-local\nONLY_LOCAL=yes\n",
    });

    expect(loaded(dir, ["FOO", "ONLY_ENV", "ONLY_LOCAL"])).toEqual({
      FOO: "from-env-local",
      ONLY_ENV: "yes",
      ONLY_LOCAL: "yes",
    });
  });

  it("keeps a variable that is already set: the shell wins over every file", () => {
    const dir = project({ ".env.local": "FOO=from-env-local\n" });

    expect(loaded(dir, ["FOO"], { FOO: "from-the-shell" })).toEqual({ FOO: "from-the-shell" });
  });

  // `screenshots:serve` sets DATABASE_URL to nothing, so that no file can fill it in
  it("keeps a variable that is already set to nothing: no file fills it in", () => {
    const dir = project({ ".env.local": "FOO=from-env-local\n", ".env": "FOO=from-env\n" });

    expect(loaded(dir, ["FOO"], { FOO: "" })).toEqual({ FOO: "" });
  });

  it("reads the files of the mode, as Next does: development outside production, production under it", () => {
    const dir = project({
      ".env.development": "FILE_OF_MODE=development\n",
      ".env.production": "FILE_OF_MODE=production\n",
    });

    expect(loaded(dir, ["FILE_OF_MODE"], { NODE_ENV: "development" })).toEqual({ FILE_OF_MODE: "development" });
    expect(loaded(dir, ["FILE_OF_MODE"], { NODE_ENV: "production" })).toEqual({ FILE_OF_MODE: "production" });
  });

  it("leaves the environment as it is when no file is there", () => {
    expect(loaded(project(), ["FOO"], { BAR: "1" })).toEqual({ FOO: null });
  });
});

describe("the seed script", () => {
  it("writes where .env.local says: a PGLITE_DATA_DIR that only the file holds", async () => {
    const dataDir = join(project(), "data", "db");
    const dir = project({ ".env.local": `PGLITE_DATA_DIR=${dataDir}\n` });

    const { stdout, ok } = await runSeed(dir, { DATABASE_URL: "", NODE_ENV: "production" });

    expect(ok).toBe(true);
    expect(stdout).toContain(`Seeding database: local PGlite (${dataDir})`);
    await expect(plansIn(dataDir)).resolves.toEqual(["enterprise", "free", "pro"]);
    // It did not fall back to the local.db of the working directory
    expect(existsSync(join(dir, "local.db"))).toBe(false);
  }, 90_000);

  it("goes where a DATABASE_URL that only .env.local holds says, and names that host before it connects", async () => {
    const port = await closedPort();
    const dir = project({ ".env.local": `DATABASE_URL=postgres://user:secret@127.0.0.1:${port}/app\n` });

    const { stdout, ok } = await runSeed(dir, { NODE_ENV: "development" });

    // The database refuses the connection: the seed stops, after saying where it was going
    expect(ok).toBe(false);
    expect(stdout).toContain(`Seeding database: 127.0.0.1:${port}`);
    expect(stdout).not.toContain("secret");
    expect(existsSync(join(dir, "local.db"))).toBe(false);
  }, 90_000);

  it("leaves a DATABASE_URL that is set to nothing alone, whatever .env.local says: the throwaway server of the screenshots", async () => {
    const dataDir = join(project(), "data", "db");
    const dir = project({ ".env.local": "DATABASE_URL=postgres://user:secret@127.0.0.1:9/app\n" });

    const { stdout, ok } = await runSeed(dir, {
      DATABASE_URL: "",
      PGLITE_DATA_DIR: dataDir,
      NODE_ENV: "production",
    });

    expect(ok).toBe(true);
    expect(stdout).toContain(`Seeding database: local PGlite (${dataDir})`);
  }, 90_000);
});

describe("the Drizzle config", () => {
  /**
   * The real `drizzle-kit`, through a config that imports the real one and
   * writes down what it resolved: `check` reads the config and the migrations
   * and connects to nothing.
   */
  function databaseUrlSeen(dir: string, env: Record<string, string> = {}): string | undefined {
    const out = join(dir, "resolved.json");
    writeFileSync(
      join(dir, "probe.config.ts"),
      `import { writeFileSync } from "node:fs";
import config from ${JSON.stringify(join(ROOT, "drizzle.config"))};

writeFileSync(${JSON.stringify(out)}, JSON.stringify(config.dbCredentials));
export default config;
`,
    );
    symlinkSync(join(ROOT, "migrations"), join(dir, "migrations"));
    execFileSync(DRIZZLE_KIT, ["check", "--config", "probe.config.ts"], {
      cwd: dir,
      env: baseEnv({ NODE_ENV: "development", ...env }),
      stdio: "pipe",
    });

    return (JSON.parse(readFileSync(out, "utf8")) as { url?: string }).url;
  }

  it("takes the DATABASE_URL of .env.local, for db:generate and db:migrate", () => {
    const dir = project({ ".env.local": "DATABASE_URL=postgres://user:secret@db.internal:5432/app\n" });

    expect(databaseUrlSeen(dir)).toBe("postgres://user:secret@db.internal:5432/app");
  }, 60_000);

  it("takes the one that is set over the file, and falls back to its own default when it is set to nothing", () => {
    const file = "DATABASE_URL=postgres://user:secret@db.internal:5432/app\n";

    expect(databaseUrlSeen(project({ ".env.local": file }), { DATABASE_URL: "postgres://other@host/db" })).toBe(
      "postgres://other@host/db",
    );
    expect(databaseUrlSeen(project({ ".env.local": file }), { DATABASE_URL: "" })).toBe(
      "postgresql://localhost:5432/boilerplate",
    );
  }, 60_000);
});
