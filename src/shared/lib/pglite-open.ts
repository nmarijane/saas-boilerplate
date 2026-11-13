import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDirectoryOnDisk } from "./pglite-data-dir";
import { lockPgliteDirectory } from "./pglite-lock";

/**
 * Whether PGlite failed because PostgreSQL could not start on the directory: it
 * aborted (WebAssembly's `RuntimeError: Aborted()`), or it stopped at once.
 */
function couldNotStart(error: unknown): boolean {
  return error instanceof WebAssembly.RuntimeError
    || (error instanceof Error && error.message === "PGlite failed to initialize properly");
}

/**
 * The error of a query on a directory that PGlite could not open: it says that
 * the directory is broken, the likely cause and what to do, where PGlite only
 * says `Aborted()`. Any other error is left as it is: a directory that cannot be
 * read, say, is not one to delete.
 */
export function explainOpenFailure(error: unknown, dataDir: string): unknown {
  if (!couldNotStart(error)) {
    return error;
  }

  return new Error(
    `The local database ${dataDir} cannot be opened: PostgreSQL could not start on it. It is broken, most likely `
    + "because two processes had it open at once. Stop the processes that use it (`npm run dev`), delete it, then "
    + "run `npm run db:seed` to make it again: what it held is lost.",
    { cause: error },
  );
}

/**
 * The clients this process has open, by the directory they are on. They are kept
 * on the global object, so that every copy of this module shares them: a server
 * holds one copy per bundle, and a script that opens a directory and loads DB.ts
 * holds two.
 */
const globalForPglite = globalThis as unknown as {
  pgliteClients: Map<string, PGlite> | undefined;
};

function openClients(): Map<string, PGlite> {
  return (globalForPglite.pgliteClients ??= new Map());
}

/**
 * PGlite on a data directory, as the app (DB.ts) and the scripts open it. On a
 * directory on disk, the lock comes first (pglite-lock.ts): this throws instead
 * while another process has the directory open. A process has one client per
 * directory, however the directory is named: two in one process break it as two
 * processes do, so a second call returns the client of the first. That client is
 * shared, so it is closed only when the process is done with the directory; once
 * it is closed, the next call opens a new one. A database in memory is its own
 * client's: it takes no lock, and each call makes a new one.
 */
export function openPglite(dataDir: string): PGlite {
  const dir = pgliteDirectoryOnDisk(dataDir);
  if (!dir) {
    return new PGlite(dataDir);
  }

  const clients = openClients();
  const key = resolve(dir);
  const open = clients.get(key);
  if (open && !open.closed) {
    return open;
  }
  clients.delete(key);

  lockPgliteDirectory(dir);
  const client = new PGlite(dataDir);
  // Each query, transaction and exec of PGlite waits for this promise first: when
  // the directory cannot be opened, each fails with the explained error
  (client as { waitReady: Promise<void> }).waitReady = client.waitReady.catch((error: unknown) => {
    throw explainOpenFailure(error, dataDir);
  });
  clients.set(key, client);

  return client;
}
