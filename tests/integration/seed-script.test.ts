import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "@/models";
import { closedPort, lockHolder, runSeed } from "../helpers/scripts";

/**
 * `npm run db:seed`, run as a developer runs it, on a data directory of its own
 * (PGLITE_DATA_DIR): what it writes there, and what it leaves out in production.
 * The directory is two levels down, with a folder above it that does not exist
 * yet, as the screenshots' is. The script ends the process, so it is one:
 * nothing here can import it. The decisions it takes (which database, whether
 * accounts with a known password go in it) are tested in seed-target.test.ts;
 * here is what a run says of them.
 */

const ROOT = resolve(import.meta.dirname, "../..");
const parents: string[] = [];

/** Seeds a fresh directory with the script, then reads back what it holds. */
async function seed(env: Record<string, string>) {
  const parent = mkdtempSync(join(tmpdir(), "seed-script-"));
  parents.push(parent);
  const dataDir = join(parent, "nested", "db");

  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/seed.ts"], {
    cwd: ROOT,
    // A DATABASE_URL in the environment of a developer would send the seed to their database
    env: { ...process.env, DATABASE_URL: "", PGLITE_DATA_DIR: dataDir, ...env },
    encoding: "utf8",
    stdio: "pipe",
  });

  expect(
    existsSync(dataDir),
    "the script wrote the directory it was given",
  ).toBe(true);
  const client = new PGlite(dataDir);
  try {
    const db = drizzle(client, { schema });
    const [plans, users, organizations] = await Promise.all([
      db.select({ id: schema.plan.id }).from(schema.plan),
      db.select({ email: schema.user.email }).from(schema.user),
      db.select({ slug: schema.organization.slug }).from(schema.organization),
    ]);

    return {
      dataDir,
      output,
      plans: plans.map(({ id }) => id).sort(),
      emails: users.map(({ email }) => email).sort(),
      slugs: organizations.map(({ slug }) => slug).sort(),
    };
  } finally {
    await client.close();
  }
}

describe("the seed script", () => {
  afterEach(() => {
    for (const parent of parents.splice(0)) {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("seeds the directory that PGLITE_DATA_DIR names: the plans, the dev accounts and the demo workspace", async () => {
    const seeded = await seed({ NODE_ENV: "development" });

    expect(seeded.plans).toEqual(["enterprise", "free", "pro"]);
    expect(seeded.emails).toEqual([
      "admin@example.com",
      "camille@example.com",
      "dev@example.com",
      "lea@example.com",
      "tom@example.com",
    ]);
    expect(seeded.slugs).toEqual(["acme", "northwind"]);
  }, 90_000);

  it("says which database it seeds: the PGlite directory, and that it is this machine's own", async () => {
    const seeded = await seed({ NODE_ENV: "development" });

    expect(seeded.output).toContain(`Seeding database: local PGlite (${seeded.dataDir})`);
    expect(seeded.output).not.toContain("Skipping");
  }, 90_000);

  it("seeds the plans and nothing else in production: no account, no demo", async () => {
    const seeded = await seed({ NODE_ENV: "production" });

    expect(seeded.plans).toEqual(["enterprise", "free", "pro"]);
    expect(seeded.emails).toEqual([]);
    expect(seeded.slugs).toEqual([]);
  }, 90_000);
});

describe("the seed script, on a database that is not this machine's own", () => {
  afterEach(() => {
    for (const parent of parents.splice(0)) {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  /**
   * `0.0.0.0` is not `localhost` or `127.0.0.1`, and on a port that nothing
   * listens on it answers at once: the run ends at the connection, after saying
   * what it was going to do, which is what is read here.
   */
  async function seedRemote(env: Record<string, string>) {
    const port = await closedPort();
    const parent = mkdtempSync(join(tmpdir(), "seed-script-"));
    parents.push(parent);

    return {
      host: `0.0.0.0:${port}`,
      ...(await runSeed(parent, { DATABASE_URL: `postgres://user:secret@0.0.0.0:${port}/app`, NODE_ENV: "development", ...env })),
    };
  }

  it("names the host, never the password, and refuses the accounts of known password, saying how to ask for them", async () => {
    const { host, stdout, ok } = await seedRemote({});

    expect(ok).toBe(false);
    expect(stdout).toContain(`Seeding database: ${host}`);
    expect(stdout).toContain(`Skipping the dev, admin and demo accounts: ${host} is not a local database`);
    expect(stdout).toContain("SEED_DEMO=1");
    expect(stdout).not.toContain("secret");
    expect(stdout).not.toContain("creating the dev");
  }, 90_000);

  it("announces the accounts when SEED_DEMO=1 says they are meant", async () => {
    const { host, stdout } = await seedRemote({ SEED_DEMO: "1" });

    expect(stdout).toContain(`SEED_DEMO=1: creating the dev, admin and demo accounts on ${host}.`);
    expect(stdout).not.toContain("Skipping the dev");
  }, 90_000);

  it("still leaves the accounts out in production, with SEED_DEMO=1 or not", async () => {
    const { stdout } = await seedRemote({ SEED_DEMO: "1", NODE_ENV: "production" });

    expect(stdout).toContain("Production detected");
    expect(stdout).not.toContain("creating the dev");
  }, 90_000);
});

describe("the seed script, on a directory that another process has open", () => {
  // `npm run dev` holds ./local.db while it runs: a seed that wrote it too would break it
  it("refuses it, says which process holds it and what to do, and writes nothing in it", async () => {
    const parent = mkdtempSync(join(tmpdir(), "seed-script-"));
    const dataDir = join(parent, "db");
    let holder: Awaited<ReturnType<typeof lockHolder>> | undefined;

    try {
      holder = await lockHolder(dataDir, "waits");
      const { ok, stderr } = await runSeed(parent, { DATABASE_URL: "", PGLITE_DATA_DIR: dataDir, NODE_ENV: "development" });

      expect(ok).toBe(false);
      expect(stderr).toContain(`${dataDir} is open in another process: pid ${holder.pid} (npm run dev)`);
      expect(stderr).toContain("Stop `npm run dev` first, then run this command again");
      expect(readdirSync(dataDir)).toEqual([`process-${holder.pid}.lock`]);
    } finally {
      holder?.kill("SIGKILL");
      rmSync(parent, { recursive: true, force: true });
    }
  }, 90_000);
});
