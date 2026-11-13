import pg from "pg";
import { describe, expect, it } from "vitest";
import { seedPlan, seedTarget } from "../../scripts/seed-target";

/**
 * Which database `npm run db:seed` is about to write to, and whether it may put
 * accounts with a known password in it. The accounts (admin, dev, the demo
 * people) all have the password `admin123`: they belong on a machine's own
 * database, never on a shared one, and a `DATABASE_URL` that was left in a shell
 * or in `.env.local` must not be enough to put them there.
 */

describe("the database the seed targets", () => {
  it("is the PGlite directory when there is no DATABASE_URL, and it is local", () => {
    expect(seedTarget(undefined, "./local.db")).toEqual({ label: "local PGlite (./local.db)", local: true });
  });

  it("is the PGlite directory when DATABASE_URL is set to nothing", () => {
    expect(seedTarget("", ".screenshots/db")).toEqual({ label: "local PGlite (.screenshots/db)", local: true });
  });

  it.each([
    ["postgresql://user:secret@localhost:5432/app", "localhost:5432"],
    ["postgres://user:secret@127.0.0.1/app", "127.0.0.1"],
    ["postgres://user:secret@[::1]:5433/app", "[::1]:5433"],
  ])("is the host of %s, and it is local", (url, host) => {
    expect(seedTarget(url, "./local.db")).toEqual({ label: host, local: true });
  });

  it.each([
    ["postgresql://user:secret@db.example.com:5432/app", "db.example.com:5432"],
    ["postgres://user:secret@10.0.0.7/app", "10.0.0.7"],
    // A name that only looks like localhost is somebody else's host
    ["postgres://user:secret@localhost.example.com/app", "localhost.example.com"],
    ["postgres://user:secret@127.0.0.1.example.com/app", "127.0.0.1.example.com"],
  ])("is the host of %s, and it is not local", (url, host) => {
    expect(seedTarget(url, "./local.db")).toEqual({ label: host, local: false });
  });

  it("never prints the user or the password of the URL", () => {
    const { label } = seedTarget("postgres://admin:hunter2@db.example.com/app", "./local.db");

    expect(label).not.toContain("hunter2");
    expect(label).not.toContain("admin");
  });

  it("is not local, and is not guessed at, when the URL cannot be read", () => {
    expect(seedTarget("not a url", "./local.db")).toEqual({ label: "an unreadable DATABASE_URL", local: false });
  });
});

// `pg` reads a `host` parameter before the host in front of it, so a URL that says `localhost` and then `?host=` a remote
// machine writes to the remote one: the seed must not take it for its own.
describe("the database the seed targets, as pg reads the address", () => {
  it("is the host of the `host` parameter, not the one in front of it: a localhost URL pointing elsewhere is not local", () => {
    expect(seedTarget("postgres://user:secret@localhost/app?host=db.example.com", "./local.db")).toEqual({
      label: "db.example.com",
      local: false,
    });
    expect(seedTarget("postgres://user:secret@127.0.0.1:5432/app?sslmode=require&host=10.0.0.7", "./local.db")).toEqual({
      label: "10.0.0.7:5432",
      local: false,
    });
  });

  it("is local when the `host` parameter says so, whatever stands in front of it", () => {
    expect(seedTarget("postgres://user:secret@db.example.com/app?host=localhost", "./local.db")).toEqual({
      label: "localhost",
      local: true,
    });
    expect(seedTarget("postgres://user:secret@db.example.com/app?host=::1&port=5433", "./local.db")).toEqual({
      label: "[::1]:5433",
      local: true,
    });
  });

  it("takes the last `host` parameter, as pg does: a local one first does not make it local", () => {
    expect(seedTarget("postgres://user:secret@localhost/app?host=localhost&host=db.example.com", "./local.db")).toEqual({
      label: "db.example.com",
      local: false,
    });
    expect(seedTarget("postgres://user:secret@db.example.com/app?host=db.example.com&host=localhost", "./local.db")).toEqual({
      label: "localhost",
      local: true,
    });
    // An empty last one replaces nothing: the host in front stands, as pg reads it
    expect(seedTarget("postgres://user:secret@localhost/app?host=db.example.com&host=", "./local.db")).toEqual({
      label: "localhost",
      local: true,
    });
    expect(seedTarget("postgres://user:secret@localhost:5432/app?port=6543&port=7654", "./local.db").label).toBe("localhost:7654");
  });

  it("is the port of the `port` parameter, which replaces the one in front of it", () => {
    expect(seedTarget("postgres://user:secret@localhost:5432/app?port=6543", "./local.db").label).toBe("localhost:6543");
  });

  it("keeps the host in front of an empty `host` parameter: it replaces nothing", () => {
    expect(seedTarget("postgres://user:secret@db.example.com/app?host=", "./local.db")).toEqual({
      label: "db.example.com",
      local: false,
    });
    expect(seedTarget("postgres://user:secret@localhost/app?host=", "./local.db")).toEqual({ label: "localhost", local: true });
  });

  it.each([
    ["postgres://user:secret@localhost/app?host=localhost.example.com", "localhost.example.com"],
    ["postgres://user:secret@127.0.0.1/app?host=127.0.0.1.example.com", "127.0.0.1.example.com"],
    ["postgres://user:secret@localhost/app?host=notlocalhost", "notlocalhost"],
  ])("is not fooled by a look-alike in the parameter: %s", (url, host) => {
    expect(seedTarget(url, "./local.db")).toEqual({ label: host, local: false });
  });

  it.each([
    ["postgres://user:secret@/var/run/postgresql/app", "socket"],
    ["postgres://user:secret@/app", "socket"],
    ["postgres:///app", "socket"],
  ])("prints `socket` for an address that names no host: %s", (url, label) => {
    // The machine behind it comes from PGHOST, which the seed does not read: not taken for local
    expect(seedTarget(url, "./local.db")).toEqual({ label, local: false });
  });

  it.each([
    ["socket:/var/run/postgresql?db=app", "/var/run/postgresql"],
    ["/var/run/postgresql app", "/var/run/postgresql"],
    ["postgres://user:secret@localhost/app?host=%2Fvar%2Frun%2Fpostgresql", "/var/run/postgresql"],
    ["postgres://user:secret@%2Fvar%2Frun%2Fpostgresql/app", "/var/run/postgresql"],
  ])("prints the path of a socket, however the address spells it: %s", (url, label) => {
    expect(seedTarget(url, "./local.db")).toEqual({ label, local: false });
  });

  it("never prints the user, the password or the database, whatever shape the address has", () => {
    for (const url of [
      "postgres://admin:hunter2@db.example.com/prod-db?host=other.example.com",
      "postgres://admin:hunter2@/prod-db",
      "socket:/var/run/postgresql?db=prod-db",
    ]) {
      const { label } = seedTarget(url, "./local.db");

      expect(label, url).not.toMatch(/hunter2|admin|prod-db/);
    }
  });

  // What the seed names is what pg connects to: the oracle is pg itself
  it.each([
    "postgres://user:secret@localhost/app?host=db.example.com",
    "postgres://user:secret@db.example.com/app?host=localhost",
    "postgres://user:secret@db.example.com/app?host=",
    "postgres://user:secret@localhost/app?host=localhost&host=db.example.com",
    "postgres://user:secret@db.example.com:5433/app",
    "postgres://user:secret@LOCALHOST/app",
    "postgresql://user:secret@10.0.0.7:6543/app?sslmode=require",
    "postgres://user:secret@localhost/app?host=%2Fvar%2Frun%2Fpostgresql",
    "socket:/var/run/postgresql?db=app",
    "/var/run/postgresql app",
    "postgres://user:secret@[::1]:5433/app",
  ])("names the host that pg connects to: %s", (url) => {
    const { host, port } = new pg.Client({ connectionString: url });
    // The label is the host (a path, or an IPv6 address in brackets), then the port when the address names one
    const label = seedTarget(url, "./local.db").label.replace(/:\d+$/, (portPart) => (portPart === `:${port}` ? "" : portPart));

    expect(label.replaceAll(/^\[|\]$/g, "").toLowerCase()).toBe(String(host).replaceAll(/^\[|\]$/g, "").toLowerCase());
  });
});

describe("the plan of the seed", () => {
  const LOCAL = { label: "local PGlite (./local.db)", local: true };
  const SHARED = { label: "db.example.com", local: false };

  it("creates the accounts and the demo on a local database outside production", () => {
    expect(seedPlan({ nodeEnv: "development", target: LOCAL, seedDemo: undefined })).toEqual({ accounts: true });
    expect(seedPlan({ nodeEnv: undefined, target: LOCAL, seedDemo: undefined })).toEqual({ accounts: true });
  });

  it("writes the plans and nothing else in production, even on a local database and even with SEED_DEMO=1", () => {
    for (const target of [LOCAL, SHARED]) {
      for (const seedDemo of [undefined, "1"]) {
        expect(seedPlan({ nodeEnv: "production", target, seedDemo })).toEqual({
          accounts: false,
          reason: "production",
        });
      }
    }
  });

  it("refuses the accounts on a database that is not local, and says how to ask for them", () => {
    const plan = seedPlan({ nodeEnv: "development", target: SHARED, seedDemo: undefined });

    expect(plan).toEqual({ accounts: false, reason: "remote" });
  });

  it.each([undefined, "", "0", "true", "yes", " 1"])("takes only SEED_DEMO=1 as a yes: %j is not", (seedDemo) => {
    expect(seedPlan({ nodeEnv: "development", target: SHARED, seedDemo })).toEqual({
      accounts: false,
      reason: "remote",
    });
  });

  it("creates the accounts on a database that is not local when SEED_DEMO=1 says so", () => {
    expect(seedPlan({ nodeEnv: "development", target: SHARED, seedDemo: "1" })).toEqual({ accounts: true });
  });
});
