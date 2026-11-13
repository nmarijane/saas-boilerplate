import { describe } from "vitest";

/**
 * True when the run is over a real PostgreSQL (`npm run test:postgres`: TEST_POSTGRES=1 and a DATABASE_URL, which
 * the run empties) and not over PGlite. PGlite has one connection: a test that needs two at once, to see a row
 * lock make one wait for the other, can only run on PostgreSQL.
 */
export const onRealPostgres = process.env.TEST_POSTGRES === "1" && Boolean(process.env.DATABASE_URL);

/** A `describe` that runs on a real PostgreSQL only, and is listed as skipped on PGlite, with the reason in its name. */
export const describeOnPostgres = (name: string, body: () => void) =>
  describe.skipIf(!onRealPostgres)(`${name} (needs real PostgreSQL: skipped on PGlite)`, body);
