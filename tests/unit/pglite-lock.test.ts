import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lockPgliteDirectory } from "@/shared/lib/pglite-lock";
import { lockHolder } from "../helpers/scripts";

/**
 * One process at a time on a PGlite directory. PostgreSQL runs inside the
 * process that opens the directory, alone: two processes on one directory break
 * it, and the next one to open it aborts. So a process writes a lock of its own
 * in the directory before PGlite opens it, and opens nothing while a process
 * that holds another lock there still runs. The other processes here are real
 * ones, started as `npm run dev` is.
 */

let dir: string;
const holders: ChildProcess[] = [];

/** The locks the directory holds. */
function locks(): string[] {
  return readdirSync(dir).filter((name) => name.endsWith(".lock"));
}

/** What `lockPgliteDirectory` throws with, or nothing. */
function refusal(): string | undefined {
  try {
    lockPgliteDirectory(dir);
  } catch (error) {
    return (error as Error).message;
  }

  return undefined;
}

describe("the lock of a PGlite directory", () => {
  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), "pglite-lock-")), "db");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const holder of holders.splice(0)) {
      holder.kill("SIGKILL");
    }
    rmSync(join(dir, ".."), { recursive: true, force: true });
  });

  it("is taken in a directory nobody holds: a lock that names the process and says how it was started", () => {
    vi.stubEnv("npm_lifecycle_event", "db:seed");

    lockPgliteDirectory(dir);

    expect(locks()).toEqual([`process-${process.pid}.lock`]);
    expect(readFileSync(join(dir, `process-${process.pid}.lock`), "utf8").trim()).toBe("npm run db:seed");
  });

  // `npm run dev` holds the directory for as long as it runs: it is to be stopped
  it("is refused while `npm run dev` holds it: the message names it, and says to stop it and run the command again", async () => {
    const other = await lockHolder(dir, "waits", "dev");
    holders.push(other);

    expect(refusal()).toBe(
      `The local database ${dir} is open in another process: pid ${other.pid} (npm run dev). Two processes on one `
      + "PGlite directory break it, so this one does not open it. Stop `npm run dev` first, then run this command "
      + "again: it holds the database for as long as it runs. Or set PGLITE_DATA_DIR to give this process a directory "
      + `of its own. If no process of yours has it open, the lock is left over: delete ${join(dir, `process-${other.pid}.lock`)}.`,
    );
    // The refused process leaves nothing behind
    expect(locks()).toEqual([`process-${other.pid}.lock`]);
  });

  // Another command, the seed, say, ends by itself: dev's first query may meet it
  it("is refused while another command holds it: the message names it, and says to wait for its end or to stop it", async () => {
    const other = await lockHolder(dir, "waits", "db:seed");
    holders.push(other);

    expect(refusal()).toBe(
      `The local database ${dir} is open in another process: pid ${other.pid} (npm run db:seed). Two processes on one `
      + "PGlite directory break it, so this one does not open it. Wait for that process to end, or stop it, then run "
      + "this command again. Or set PGLITE_DATA_DIR to give this process a directory of its own. If no process of "
      + `yours has it open, the lock is left over: delete ${join(dir, `process-${other.pid}.lock`)}.`,
    );
    expect(locks()).toEqual([`process-${other.pid}.lock`]);
  });

  it("is taken over from a process that ended without removing it (killed)", async () => {
    const other = await lockHolder(dir, "waits");
    holders.push(other);
    other.kill("SIGKILL");
    await once(other, "exit");
    expect(locks()).toEqual([`process-${other.pid}.lock`]);

    expect(refusal()).toBeUndefined();
    expect(locks()).toEqual([`process-${process.pid}.lock`]);
  });

  it("goes when its process exits", async () => {
    await lockHolder(dir, "ends");

    expect(locks()).toEqual([]);
    expect(refusal()).toBeUndefined();
  });
});
