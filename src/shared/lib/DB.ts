import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "@/models";
import { resolvePgliteDataDir } from "./pglite-data-dir";
import { openPglite } from "./pglite-open";

/**
 * A client that the first query makes, not the import: a process that loads the
 * app and never queries opens nothing. `next dev` is one: it loads each page in a
 * worker of its own to read its static params, then ends the worker, and a PGlite
 * that the worker opened on ./local.db broke the directory under the server. Every
 * use of the client goes to the one made, and its class is the real one: Drizzle
 * tells a pool by its class, to take a connection for a transaction.
 */
function madeByFirstQuery<T extends object>(make: () => T): T {
  let client: T | undefined;
  const made = () => (client ??= make());

  return new Proxy({} as T, {
    get(_, property) {
      const target = made();
      const value: unknown = Reflect.get(target, property, target);

      return typeof value === "function" ? value.bind(target) : value;
    },
    getPrototypeOf: () => Object.getPrototypeOf(made()),
  });
}

// Drizzle keeps the client and only calls it to query. It is handed over as
// `{ client }`: given alone, Drizzle would look into it to tell it from a config.
function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return drizzle({
      client: madeByFirstQuery(() => new Pool({ connectionString: databaseUrl })),
      schema,
    });
  }

  // PGlite for local development (no DATABASE_URL)
  return drizzlePglite({
    client: madeByFirstQuery(() => openPglite(resolvePgliteDataDir())),
    schema,
  });
}

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
};

export const db = globalForDb.db ?? createDb();

// The client is kept in every mode, production included. One server holds
// several bundled copies of this module: each opened its own PGlite on the same
// directory, so a session written by the auth route was invisible to the pages.
// With PostgreSQL, it is one pool per process instead of one per copy.
globalForDb.db = db;
