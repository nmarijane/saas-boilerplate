import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inRepo, layoutsThatDecideA404, SHELL } from "../../helpers/routes";

/**
 * The loading states of the projects. A project's layout decides the 404 of a
 * project that is not in the workspace, so no loading state may wrap it: the
 * list has its own, in a route group beside the entity. The general rule is in
 * tests/unit/app/route-states.test.ts; this file holds what is true of the
 * projects only, and goes with them when they are removed.
 */

const PROJECTS = join(SHELL, "projects");

describe("the loading states of the projects", () => {
  // The general rule looks at the layouts that decide a 404, and finds them by
  // what they call: if it stopped seeing this one, it would check nothing.
  it("sees the layout of a project as one that decides a 404", () => {
    expect(
      layoutsThatDecideA404(),
      "the detection of the layouts that decide a 404 no longer finds projects/[projectId]/layout.tsx",
    ).toContain("(app)/(shell)/projects/[projectId]");
  });

  it("keeps projects/ and the shell above it free of a loading state", () => {
    for (const folder of [PROJECTS, SHELL]) {
      const file = join(folder, "loading.tsx");

      expect(
        existsSync(file),
        `${inRepo(file)} would wrap projects/[projectId]/layout.tsx: an unknown project would answer 200`,
      ).toBe(false);
    }
  });

  it("gives the list its own loading state and page, in a route group beside the entity", () => {
    for (const name of ["loading.tsx", "page.tsx"]) {
      const file = join(PROJECTS, "(list)", name);

      expect(existsSync(file), `${inRepo(file)} is missing`).toBe(true);
    }
  });
});
