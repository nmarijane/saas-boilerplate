import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `npm run screenshots:serve` builds the app, wipes the screenshots' folder,
 * seeds a database and serves it. It is started by the Playwright config, but
 * it can be started by hand, and it must not depend on who starts it: every
 * step that touches a database says which one, through `cross-env`, and never
 * takes a `DATABASE_URL` from the shell or from an `.env` file (Next fills a
 * variable only when it is missing from the environment, not when it is empty).
 */

const root = resolve(import.meta.dirname, "../..");
const { scripts } = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf-8"),
) as { scripts: Record<string, string> };

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

const steps = (scripts["screenshots:serve"] ?? "")
  .split("&&")
  .map((step) => parse(step.trim()));
const [build, wipe, seed, start] = steps;

describe("the screenshots:serve script", () => {
  it("builds, wipes the screenshots' folder, seeds, then serves", () => {
    expect(steps.map(({ command }) => command)).toEqual([
      "next build",
      "rimraf .screenshots",
      "tsx scripts/seed.ts",
      "next start --port 3089",
    ]);
  });

  it.each([
    ["the build", build],
    ["the seed", seed],
    ["the server", start],
  ] as const)(
    "gives %s a database of its own and no DATABASE_URL",
    (_, step) => {
      expect(step?.env).toHaveProperty("PGLITE_DATA_DIR");
      // Set to nothing: the shell and the .env files cannot fill it
      expect(step?.env).toHaveProperty("DATABASE_URL", "");
    },
  );

  it("builds on a database in memory, and seeds and serves one directory under the folder it wipes", () => {
    expect(build?.env.PGLITE_DATA_DIR).toBe("memory://");
    expect(seed?.env.PGLITE_DATA_DIR).toBe(start?.env.PGLITE_DATA_DIR);
    expect(seed?.env.PGLITE_DATA_DIR).toMatch(/^\.screenshots\//);
    expect(wipe?.command).toBe("rimraf .screenshots");
  });
});
