import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_DATA_DIR = "./local.db";
const FILE_URL = "file://";
const URL_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * The directory on disk that PGlite keeps a data directory in: the path itself,
 * or the path behind `file://`, which PGlite reads so. A value of the form
 * `scheme://` is not a path (`memory://` is a database in memory): it has none.
 */
export function pgliteDirectoryOnDisk(dataDir: string): string | undefined {
  const path = dataDir.startsWith(FILE_URL)
    ? dataDir.slice(FILE_URL.length)
    : dataDir;

  return URL_SCHEME.test(path) ? undefined : path;
}

/**
 * Where PGlite keeps its data: the directory `PGLITE_DATA_DIR` names, or
 * `./local.db`. PGlite makes that directory but not the folders above it, so
 * they are made here: a nested one (`.screenshots/db`) would fail with ENOENT.
 * Nothing is made for a database that is not on disk. The app (DB.ts) and the
 * seed both read the variable through this.
 */
export function resolvePgliteDataDir(): string {
  const dataDir = process.env.PGLITE_DATA_DIR || DEFAULT_DATA_DIR;
  const path = pgliteDirectoryOnDisk(dataDir);

  if (path) {
    mkdirSync(dirname(path), { recursive: true });
  }

  return dataDir;
}
