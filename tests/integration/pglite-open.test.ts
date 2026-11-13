import { Buffer } from "node:buffer";
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { openPglite } from "@/shared/lib/pglite-open";

/**
 * A directory that the real PGlite cannot open. Two processes on one directory
 * leave it so: the next process to open it aborts in WebAssembly, and every query
 * fails with `RuntimeError: Aborted()`, which says neither why nor what to do.
 * Here the directory is broken on purpose, in the same way: its write-ahead log
 * is zeroed, so PostgreSQL finds no checkpoint to start from.
 */

const parents: string[] = [];

/** A PGlite directory made and closed cleanly, then broken. */
async function brokenDirectory(): Promise<string> {
  const parent = mkdtempSync(join(tmpdir(), "pglite-open-"));
  parents.push(parent);
  const dir = join(parent, "db");

  const fresh = new PGlite(dir);
  await fresh.query("select 1");
  await fresh.close();
  const wal = join(dir, "pg_wal");
  for (const name of readdirSync(wal)) {
    const segment = join(wal, name);
    if (statSync(segment).isFile()) {
      writeFileSync(segment, Buffer.alloc(statSync(segment).size));
    }
  }

  return dir;
}

describe("a PGlite directory that cannot be opened", () => {
  afterEach(() => {
    for (const parent of parents.splice(0)) {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("fails every query with what to do, and keeps WebAssembly's error as the cause", async () => {
    const dir = await brokenDirectory();
    const client = openPglite(dir);

    for (const run of [() => client.query("select 1"), () => client.exec("select 1"), () => client.transaction(async (tx) => tx.query("select 1"))]) {
      const error = await run().then(() => undefined, (failure: unknown) => failure as Error);

      expect(error?.message).toContain(`The local database ${dir} cannot be opened`);
      expect(error?.message).toContain("run `npm run db:seed`");
      expect(error?.cause).toBeInstanceOf(WebAssembly.RuntimeError);
    }
  }, 60_000);
});
