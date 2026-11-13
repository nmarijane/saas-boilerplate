import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePgliteDataDir } from "@/shared/lib/pglite-data-dir";

/**
 * Where PGlite keeps its data: the directory `PGLITE_DATA_DIR` names, or
 * `./local.db`. PGlite makes that directory but not the folders above it, so a
 * nested one (the screenshots keep theirs in `.screenshots/db`) fails with
 * ENOENT unless those folders are made first. A value of the form `scheme://`
 * is not a path (`memory://` is a database in memory), except `file://`, which
 * PGlite reads as the path behind it.
 */

let sandbox: string;

// What a mkdir of a URL would leave in the working directory: a folder named for its scheme
const SCHEME_FOLDERS = ["memory:", "idb:", "file:"].map((name) =>
  join(process.cwd(), name),
);

describe("the data directory of PGlite", () => {
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "pglite-data-dir-"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(sandbox, { recursive: true, force: true });
    for (const folder of SCHEME_FOLDERS) {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("is the directory PGLITE_DATA_DIR names, and the folders above it are made when they are missing", () => {
    const dataDir = join(sandbox, "one", "two", "db");
    vi.stubEnv("PGLITE_DATA_DIR", dataDir);

    expect(resolvePgliteDataDir()).toBe(dataDir);
    expect(existsSync(join(sandbox, "one", "two"))).toBe(true);
  });

  it("is ./local.db when none is named", () => {
    vi.stubEnv("PGLITE_DATA_DIR", undefined);

    expect(resolvePgliteDataDir()).toBe("./local.db");
  });

  it("is ./local.db when the variable is empty", () => {
    vi.stubEnv("PGLITE_DATA_DIR", "");

    expect(resolvePgliteDataDir()).toBe("./local.db");
  });

  // The folder above "memory://scratch/db" is "memory://scratch": made, it
  // would be a folder named "memory:" in the working directory
  it.each(["memory://scratch/db", "idb://scratch/db"])(
    "leaves %s as it is, and makes no folder for it",
    (url) => {
      vi.stubEnv("PGLITE_DATA_DIR", url);

      expect(resolvePgliteDataDir()).toBe(url);
      for (const folder of SCHEME_FOLDERS) {
        expect(existsSync(folder), folder).toBe(false);
      }
    },
  );

  it("reads file:// as the path behind it, and makes the folders above that path", () => {
    const dataDir = join(sandbox, "one", "two", "db");
    vi.stubEnv("PGLITE_DATA_DIR", `file://${dataDir}`);

    expect(resolvePgliteDataDir()).toBe(`file://${dataDir}`);
    expect(existsSync(join(sandbox, "one", "two"))).toBe(true);
    // Not a folder named "file:" in the working directory
    expect(existsSync(join(process.cwd(), "file:"))).toBe(false);
  });
});
