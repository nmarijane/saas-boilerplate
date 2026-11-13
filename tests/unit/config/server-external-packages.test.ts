import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

/**
 * The sign-in pages ask `auth.ts` which providers are on, so a server-rendered
 * page imports the database client. With no DATABASE_URL that client is PGlite,
 * which loads its WebAssembly from `import.meta.url`: bundled into the server,
 * that URL is not one that Node's `fs` takes, the load fails, and the client
 * (shared by the whole server, and created by whichever code reaches it first)
 * fails every query after it: the first visit to the sign-in page broke the
 * sign-in. Next.js leaves a package out of the server bundle, to be loaded by
 * Node itself, when `serverExternalPackages` names it. The failure is of the
 * dev server and of PGlite alone, so no test of the pages can see it: the
 * config Next.js loads is imported, and read for the setting that prevents it.
 * (Sentry adds its own packages to the list, so it is searched, not compared.)
 */

describe("the config of Next.js", () => {
  it("leaves PGlite out of the bundle of the server", () => {
    expect(nextConfig).toMatchObject({ serverExternalPackages: expect.arrayContaining(["@electric-sql/pglite"]) });
  });
});
