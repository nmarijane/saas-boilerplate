import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { explainOpenFailure, openPglite } from "@/shared/lib/pglite-open";

/**
 * How the app and the seed open PGlite: on a directory on disk, after its lock
 * (pglite-lock.ts), with one client per directory in a process, and with an
 * error that says what to do when the directory cannot be opened. PGlite and the
 * lock are stand-ins here, to see what is done, and in which order;
 * tests/integration/pglite-open.test.ts opens a broken directory with the real one.
 */

const calls = vi.hoisted(() => [] as string[]);

vi.mock("@electric-sql/pglite", () => ({
  PGlite: class {
    waitReady = Promise.resolve();
    closed = false;

    constructor(dataDir: string) {
      calls.push(`open ${dataDir}`);
    }

    async close() {
      this.closed = true;
    }
  },
}));

// The clients a process opened are kept on the global object, for every copy of the module
const globals = globalThis as unknown as { pgliteClients?: unknown };
vi.mock("@/shared/lib/pglite-lock", () => ({
  lockPgliteDirectory: (dir: string) => calls.push(`lock ${dir}`),
}));

beforeEach(() => {
  calls.length = 0;
  delete globals.pgliteClients;
});

describe("opening PGlite", () => {
  it("takes the lock of a directory on disk before PGlite opens it", () => {
    openPglite(".e2e/db");

    expect(calls).toEqual(["lock .e2e/db", "open .e2e/db"]);
  });

  it("locks the path behind file://", () => {
    openPglite("file:///srv/app/db");

    expect(calls).toEqual(["lock /srv/app/db", "open file:///srv/app/db"]);
  });

  // A database in memory belongs to its process: no other one can open it
  it("takes no lock for a database in memory", () => {
    openPglite("memory://");

    expect(calls).toEqual(["open memory://"]);
  });
});

// Two clients on one directory in one process break it as two processes do: what
// one writes, the other overwrites. A script that opens the directory and loads
// DB.ts too must get one client.
describe("the clients of a process", () => {
  it("are one for one directory: a second open gives the client of the first, and PGlite is made once", () => {
    const first = openPglite(".scratch/one");

    expect(openPglite(".scratch/one")).toBe(first);
    expect(calls).toEqual(["lock .scratch/one", "open .scratch/one"]);
  });

  it("are one for every name of a directory: relative, absolute or behind file://", () => {
    const first = openPglite(".scratch/two");

    expect(openPglite(resolve(".scratch/two"))).toBe(first);
    expect(openPglite(`file://${resolve(".scratch/two")}`)).toBe(first);
  });

  it("are one for every copy of the module that the process loads", async () => {
    const first = openPglite(".scratch/three");
    vi.resetModules();
    const copy = await import("@/shared/lib/pglite-open");

    expect(copy.openPglite(".scratch/three")).toBe(first);
  });

  it("are a new one once the client of a directory is closed", async () => {
    const first = openPglite(".scratch/four");
    await first.close();

    const next = openPglite(".scratch/four");

    expect(next).not.toBe(first);
    expect(calls.filter((call) => call.startsWith("open"))).toEqual(["open .scratch/four", "open .scratch/four"]);
  });

  it("are two for two directories", () => {
    expect(openPglite(".scratch/five")).not.toBe(openPglite(".scratch/six"));
  });

  it("are a new one at each open of a database in memory: it belongs to the client that made it", () => {
    expect(openPglite("memory://")).not.toBe(openPglite("memory://"));
    expect(calls).toEqual(["open memory://", "open memory://"]);
  });
});

describe("the error of a directory that PGlite cannot open", () => {
  it.each([
    ["aborts on it", new WebAssembly.RuntimeError("Aborted(). Build with -sASSERTIONS for more info.")],
    ["stops at once", new Error("PGlite failed to initialize properly")],
  ])("says, when PostgreSQL %s, that it cannot be opened, why that may be, and what to do", (_, error) => {
    const explained = explainOpenFailure(error, "./local.db");

    expect(explained).toBeInstanceOf(Error);
    expect((explained as Error).message).toBe(
      "The local database ./local.db cannot be opened: PostgreSQL could not start on it. It is broken, most likely "
      + "because two processes had it open at once. Stop the processes that use it (`npm run dev`), delete it, then "
      + "run `npm run db:seed` to make it again: what it held is lost.",
    );
    expect((explained as Error).cause).toBe(error);
  });

  it("leaves any other error as it is: deleting the database is not what cures it", () => {
    const error = Object.assign(new Error("EACCES: permission denied, open './local.db/PG_VERSION'"), { code: "EACCES" });

    expect(explainOpenFailure(error, "./local.db")).toBe(error);
  });
});
