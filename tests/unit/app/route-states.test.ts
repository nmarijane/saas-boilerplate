import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  above,
  APP,
  foldersWith,
  inRepo,
  layoutsThatDecideA404,
  loadingsAbove,
  LOCALE,
  ROOT,
  SHELL,
  SRC,
} from "../../helpers/routes";
import { reportsItsError, sourceOf } from "../../helpers/source";

/**
 * Every route of the connected space has its three states: a loading state
 * drawn to the size of the page, an error boundary that can retry, and a
 * not-found that stays in the shell. The pages are Server Components and the
 * states are files next to them, so each rule is read from the disk: a page that
 * is added is looked at, with nothing to list here. The file names no feature,
 * so that it stays when one is removed.
 */

const PAGES = foldersWith("page.tsx");
const ERRORS = foldersWith("error.tsx");
const LOADINGS = foldersWith("loading.tsx");

describe("the routes of the connected space", () => {
  // The scan has to find the pages and their states, or it checks nothing
  it("looks at pages, at error boundaries and at loading states", () => {
    expect(PAGES.length, "the pages of the connected space").toBeGreaterThan(0);
    expect(ERRORS.length, "the error boundaries of the connected space").toBeGreaterThan(0);
    expect(LOADINGS.length, "the loading states of the connected space").toBeGreaterThan(0);
  });

  it.each(PAGES)("gives %s a loading state, in its folder or in one above it", (page) => {
    const folder = join(LOCALE, page);
    const states = [folder, ...above(folder, APP)].filter((one) => existsSync(join(one, "loading.tsx")));

    expect(states.length, `${page}/page.tsx has no loading.tsx in its folder or above it, up to (app)`).toBeGreaterThan(0);
  });

  it.each(PAGES)("puts %s under an error boundary, in its folder or in one above it", (page) => {
    const folder = join(LOCALE, page);
    const states = [folder, ...above(folder, APP)].filter((one) => existsSync(join(one, "error.tsx")));

    expect(states.length, `${page}/page.tsx has no error.tsx in its folder or above it, up to (app)`).toBeGreaterThan(0);
  });

  it.each(PAGES)("names %s in the tab of the browser", (page) => {
    const file = join(LOCALE, page, "page.tsx");

    expect(sourceOf(file), `${inRepo(file)} does not name its page through appPageMetadata()`).toContain("appPageMetadata(");
  });

  it("keeps a not-found inside the shell", () => {
    const file = join(SHELL, "not-found.tsx");

    expect(existsSync(file), `${inRepo(file)} is missing`).toBe(true);
  });
});

describe("the loading states", () => {
  it.each(LOADINGS)("make %s one busy region, which says it is loading once", (folder) => {
    const file = join(LOCALE, folder, "loading.tsx");

    expect(sourceOf(file), `${inRepo(file)} is not one <LoadingRegion>`).toContain("<LoadingRegion");
  });

  // A loading state is a Suspense boundary around what is under its folder, and
  // the status of a response is sent with the first boundary: a 404 that a layout
  // under one decides arrives after the 200 is out. So a layout that decides a
  // 404 has no loading state above it, at any level of the app, and the list
  // that has one sits beside it, in a route group.
  it("keeps every loading state off the layouts that decide a 404", () => {
    // The scan has to find layouts, or it checks nothing: the shell always has one
    expect(foldersWith("layout.tsx", LOCALE).length, "the layouts of the language").toBeGreaterThan(0);

    for (const layout of layoutsThatDecideA404()) {
      expect(loadingsAbove(layout), `the loading states above ${layout}/layout.tsx, which decides a 404`).toEqual([]);
    }
  });
});

describe("the error boundaries", () => {
  it.each(ERRORS)("lets %s retry, through the shared state", (folder) => {
    const file = join(LOCALE, folder, "error.tsx");
    const source = sourceOf(file);

    expect(source, `${inRepo(file)} does not take the retry of the boundary`).toContain("retry");
    expect(source, `${inRepo(file)} does not draw the shared RouteError`).toContain("RouteError");
  });

  it.each(ERRORS)("reports to the browser what %s catches, once per error", (folder) => {
    const file = join(LOCALE, folder, "error.tsx");
    const source = sourceOf(file);

    expect(source, `${inRepo(file)} is not a client file`).toContain('"use client"');
    expect(reportsItsError(source), `${inRepo(file)} does not call useReportError(error)`).toBe(true);
  });
});

describe("the pages nobody wrote", () => {
  it("draws every unknown address of a language with the not-found of the language", () => {
    for (const file of ["not-found.tsx", "[...rest]/page.tsx"]) {
      expect(existsSync(join(LOCALE, file)), `${inRepo(join(LOCALE, file))} is missing`).toBe(true);
    }
  });

  // A page that draws the not-found itself answers 200: only `notFound()` makes
  // the response a 404.
  it("answers them with a 404, by calling notFound() and drawing nothing itself", () => {
    const file = join(LOCALE, "[...rest]/page.tsx");
    const source = sourceOf(file);

    expect(source, `${inRepo(file)} does not call notFound()`).toMatch(/\bnotFound\(\)/);
    expect(source, `${inRepo(file)} draws something itself: it would answer 200`).not.toMatch(/<\w/);
  });
});

describe("the frame of the pages that stand alone", () => {
  const FRAMED = ["(auth)/layout.tsx", "not-found.tsx", "(app)/error.tsx"];

  // The sign-in pages, the 404 of the language and the error that replaces the
  // shell are one frame: a sunken page, the logo that leads home, a narrow column.
  it.each(FRAMED)("draws %s in the one centered frame, and not in a copy of it", (name) => {
    const file = join(LOCALE, name);
    const source = sourceOf(file);

    expect(source, `${inRepo(file)} does not draw <CenteredPage>`).toContain("<CenteredPage");
    expect(source, `${inRepo(file)} draws the sunken page itself`).not.toContain("bg-surface-sunken");
    expect(source, `${inRepo(file)} draws the logo itself`).not.toContain("<ShellLogo");
  });
});

describe("the reporter of the browser", () => {
  const CLIENT = join(SRC, "instrumentation-client.ts");

  // Next 16 builds with Turbopack, which reads `instrumentation-client` and never
  // `sentry.client.config.ts` (only the webpack build of the SDK loads that one):
  // the boundaries above report to a browser SDK that has to start from here.
  it("starts from the file Turbopack reads, and follows the navigations", () => {
    const source = sourceOf(CLIENT);

    expect(source, `${inRepo(CLIENT)} does not start the SDK`).toContain("Sentry.init(");
    expect(source, `${inRepo(CLIENT)} does not export onRouterTransitionStart`).toMatch(
      /export const onRouterTransitionStart\s*=\s*Sentry\.captureRouterTransitionStart/,
    );
  });

  it("starts only where there is a DSN to report to", () => {
    expect(sourceOf(CLIENT), `${inRepo(CLIENT)} starts the SDK with no DSN`).toMatch(
      /if\s*\(process\.env\.NEXT_PUBLIC_SENTRY_DSN\)/,
    );
  });

  it("has no second place that starts it", () => {
    const file = join(ROOT, "sentry.client.config.ts");

    expect(existsSync(file), `${inRepo(file)} is read by webpack only: the browser SDK starts once, from instrumentation-client.ts`).toBe(false);
  });
});
