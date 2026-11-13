import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../playwright.config";
import screenshots from "../../playwright.screenshots.config";

/**
 * `npm run test:e2e` serves the app the way the screenshots do: it builds it, wipes
 * a folder of its own, seeds a database in it and serves it, on a port of its own. It
 * is started by the Playwright config, and it must not depend on who starts it:
 * every step that touches a database says which one, through `cross-env`, and never
 * takes a `DATABASE_URL` from the shell or from an `.env` file (a variable that is set
 * to nothing is left alone by the `.env` files). It never shares what `npm run dev`
 * (3088, ./local.db) or the screenshots (3089, .screenshots/) are using.
 */

const root = resolve(import.meta.dirname, "../..");
const { scripts } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8")) as {
  scripts: Record<string, string>;
};

/** `cross-env A=1 B= tsx x.ts` is the variables `{ A: "1", B: "" }` and the command `tsx x.ts`. */
function parse(step: string) {
  const [first, ...words] = step.split(/\s+/);
  if (first !== "cross-env") {
    return { env: {}, command: step };
  }

  const assignments = words.findIndex((word) => !word.includes("="));

  return {
    env: Object.fromEntries(
      words.slice(0, assignments).map((word) => {
        const [name = "", ...value] = word.split("=");
        return [name, value.join("=")];
      }),
    ),
    command: words.slice(assignments).join(" "),
  };
}

const portOf = (url: string | undefined) => new URL(url ?? "http://none").port;
const steps = (scripts["e2e:serve"] ?? "").split("&&").map((step) => parse(step.trim()));
const [build, wipe, seed, start] = steps;

describe("the e2e:serve script", () => {
  it("builds, wipes the folder of the tests, seeds, then serves", () => {
    expect(steps.map(({ command }) => command)).toEqual([
      "next build",
      "rimraf .e2e",
      "tsx scripts/seed.ts",
      "next start --port 3090",
    ]);
  });

  it.each([
    ["the build", build],
    ["the seed", seed],
    ["the server", start],
  ] as const)("gives %s a database of its own and no DATABASE_URL", (_, step) => {
    expect(step?.env).toHaveProperty("PGLITE_DATA_DIR");
    // Set to nothing: the shell and the .env files cannot fill it
    expect(step?.env).toHaveProperty("DATABASE_URL", "");
  });

  // A production server refuses the local database (production-config.ts): the tests serve a production build
  // over a throwaway one, and say so by name, for the server only (a build and a seed are not production servers)
  it("lets only the server run a production build on the local database", () => {
    expect(start?.env.ALLOW_PGLITE_IN_PRODUCTION).toBe("1");
    expect(build?.env).not.toHaveProperty("ALLOW_PGLITE_IN_PRODUCTION");
    expect(seed?.env).not.toHaveProperty("ALLOW_PGLITE_IN_PRODUCTION");
  });

  it("builds on a database in memory, and seeds and serves one directory under the folder it wipes", () => {
    expect(build?.env.PGLITE_DATA_DIR).toBe("memory://");
    expect(seed?.env.PGLITE_DATA_DIR).toBe(start?.env.PGLITE_DATA_DIR);
    expect(seed?.env.PGLITE_DATA_DIR).toMatch(/^\.e2e\//);
    expect(wipe?.command).toBe("rimraf .e2e");
  });
});

describe("the Playwright config of the end-to-end tests", () => {
  it("finds the files of the tests: they end in .e2e.ts, which the default match does not read", () => {
    expect(config.testDir).toBe("./tests/e2e");
    expect(config.testMatch).toBe("*.e2e.ts");
  });

  it("serves through the script, and talks to the port that the script serves on", () => {
    const server = config.webServer;
    const served = /--port (\d+)/.exec(start?.command ?? "")?.[1];

    expect(Array.isArray(server)).toBe(false);
    expect(server && !Array.isArray(server) ? server.command : "").toBe("npm run e2e:serve");
    expect(portOf(config.use?.baseURL)).toBe(served);
    expect(portOf(server && !Array.isArray(server) ? server.url : undefined)).toBe(served);
    expect(server && !Array.isArray(server) ? server.env?.BETTER_AUTH_URL : "").toBe(config.use?.baseURL);
  });

  // The server mails nothing: a test that makes an account signs the link of its verification itself, with the
  // secret of the run, which the workers of Playwright read from the environment (tests/e2e/support.ts)
  it("draws the secret of the server once, and gives it to the tests that sign a verification link", () => {
    const server = config.webServer;
    const secret = server && !Array.isArray(server) ? server.env?.BETTER_AUTH_SECRET : undefined;

    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(process.env.E2E_AUTH_SECRET).toBe(secret);
  });

  // The limit by address reads the client from X-Forwarded-For only when a proxy is trusted (client-ip.ts):
  // the tests that give themselves an address (tests/e2e/support.ts) need that to be a client of their own
  it("trusts one proxy, as a deployment behind one does, so that a test can be a client of its own", () => {
    for (const { webServer } of [config, screenshots]) {
      expect(webServer && !Array.isArray(webServer) ? webServer.env?.TRUST_PROXY : undefined).toBe("1");
    }
  });

  it("never reuses a server: a leftover one would hold another database", () => {
    const server = config.webServer;

    expect(server && !Array.isArray(server) ? server.reuseExistingServer : undefined).toBe(false);
  });

  it("has a port of its own: not the dev server's, and not the screenshots'", () => {
    const dev = /--port (\d+)/.exec(scripts.dev ?? "")?.[1];
    const own = portOf(config.use?.baseURL);
    const shots = portOf(screenshots.use?.baseURL);

    expect(own).not.toBe(dev);
    expect(own).not.toBe(shots);
    expect(own).toMatch(/^\d+$/);
  });
});
