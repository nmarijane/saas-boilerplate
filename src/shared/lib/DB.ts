import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "@/models";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return drizzle(databaseUrl, { schema });
  }

  // PGlite for local development (no DATABASE_URL)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const client = new PGlite("./local.db");
  return drizzlePglite(client, { schema });
}

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
};

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
