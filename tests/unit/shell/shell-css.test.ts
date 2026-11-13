import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findBlock } from "../../helpers/css";

/**
 * The shell has two sticky bars that sit over the page: a header from 0 to
 * 1024 px and a tab bar under 480 px. global.css tells the rest of the page how
 * much room they take, so that what the page scrolls to is not hidden under
 * them, and a page that fills the screen is exactly as tall as it.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const css = readFileSync(join(ROOT, "src/styles/global.css"), "utf-8");
const source = (file: string) =>
  readFileSync(join(ROOT, "src/shared/components/shell", file), "utf-8");

const ROOT_RULE = "html:has([data-shell])";
const SHELL_RULE = "[data-shell]";

/** The declarations of a rule of the shell, in the base sheet or under a media query. */
function declarations(rule: string, media?: string): Record<string, string> {
  const block = media ? findBlock(css, media, rule) : findBlock(css, rule);
  expect(block, `${media ? `${media} ` : ""}${rule}`).toBeDefined();
  return block?.properties ?? {};
}

describe("shell css", () => {
  it("pads the scroll under the sticky bars", () => {
    expect(css).toContain(ROOT_RULE);
    expect(css).toContain("scroll-padding");
    expect(css).toContain("--shell-chrome");
  });

  // The height of the tab bar is written once, as a token, for everything that must clear it: the scroll padding, the
  // room the bars take of the screen, and the toasts, which sit above it. The token is on the page (`html`), where
  // the toaster, which is outside the shell, can read it, and it is 0 wherever there is no tab bar.
  it("writes the height of the tab bar once, as a token: the bar and the safe area of a phone, under 480 px", () => {
    expect(declarations(ROOT_RULE)["--tab-bar-height"]).toBe("calc(4rem + env(safe-area-inset-bottom))");
  });

  it("takes the tab bar away from 480 px: its height is 0, a length, since it is added inside calc()", () => {
    expect(declarations(ROOT_RULE, "@media (min-width: 30rem)")["--tab-bar-height"]).toBe("0px");
  });

  it("clears the header and the tab bar below 480 px", () => {
    expect(declarations(ROOT_RULE)).toMatchObject({
      "scroll-padding-top": "3.5rem",
      "scroll-padding-bottom": "var(--tab-bar-height)",
    });
  });

  it("clears the header alone from 480 px", () => {
    // The token is 0 there, and the scroll padding at the bottom with it
    expect(declarations(ROOT_RULE, "@media (min-width: 30rem)")).toMatchObject({
      "scroll-padding-top": "3.5rem",
      "--tab-bar-height": "0px",
    });
    expect(declarations(ROOT_RULE, "@media (min-width: 30rem)")["scroll-padding-bottom"]).toBeUndefined();
  });

  it("clears nothing from 1024 px, where the sidebar is the only chrome", () => {
    expect(declarations(ROOT_RULE, "@media (min-width: 64rem)")).toMatchObject({
      "scroll-padding-top": "0",
      "scroll-padding-bottom": "0",
    });
  });

  it("defines the 480 px breakpoint", () => {
    expect(findBlock(css, "@theme")?.properties["--breakpoint-xs"]).toBe("30rem");
  });

  it("measures what the bars take of the screen, and the margins of the page, at each size", () => {
    // The header, and the tab bar when there is one: under 480 px that is 3.5 rem and the token, 7.5 rem and the safe area.
    // The token has a fallback of 0: a browser without `:has()` (Firefox before 121) never sets it, and without the fallback
    // the whole value is invalid, and the page that fills the screen loses its height
    expect(declarations(SHELL_RULE)).toMatchObject({
      "--shell-chrome": "calc(3.5rem + var(--tab-bar-height, 0px))",
      "--shell-gutter-y": "3rem",
    });
    // From 480 px the token is 0: the header alone, with no rule of its own
    expect(declarations(SHELL_RULE, "@media (min-width: 30rem)")).toMatchObject({
      "--shell-gutter-y": "4rem",
    });
    expect(declarations(SHELL_RULE, "@media (min-width: 30rem)")["--shell-chrome"]).toBeUndefined();
    // A length, not a bare 0: it is subtracted inside calc().
    expect(declarations(SHELL_RULE, "@media (min-width: 64rem)")).toMatchObject({
      "--shell-chrome": "0px",
      "--shell-gutter-y": "5rem",
    });
  });

  it("keeps the gutter equal to twice the vertical margin of the page column", () => {
    const column = source("app-shell.tsx");
    // py-6 is 1.5 rem: twice that is 3 rem, and so on.
    const gutter = (utility: string) => {
      const steps = new RegExp(`(?<![\\w:-])${utility}-(\\d+)(?![\\d.])`).exec(column)?.[1];
      expect(steps, utility).toBeDefined();
      return `${Number(steps) * 0.5}rem`;
    };

    expect(gutter("py")).toBe(declarations(SHELL_RULE)["--shell-gutter-y"]);
    expect(gutter("xs:py")).toBe(
      declarations(SHELL_RULE, "@media (min-width: 30rem)")["--shell-gutter-y"],
    );
    expect(gutter("lg:py")).toBe(
      declarations(SHELL_RULE, "@media (min-width: 64rem)")["--shell-gutter-y"],
    );
  });

  it("keeps the tab bar as tall as the room it is given, safe area apart", () => {
    // pt-1 and pb-2 round 48 px of tab, 4 + 8 px of padding, and the border: 61 px, counted as 64, which is 4 rem
    expect(source("tab-bar.tsx")).toMatch(/min-h-12/);
    expect(declarations(ROOT_RULE)["--tab-bar-height"]).toMatch(/^calc\(4rem \+ env\(safe-area-inset-bottom\)\)$/);
  });

  it("keeps the header as tall as the room it is given", () => {
    // h-14 is 3.5 rem: the scroll padding at the top, and the chrome from 480 px.
    expect(source("mobile-header.tsx")).toMatch(/(?<![\w:-])h-14(?![\w.])/);
    expect(declarations(ROOT_RULE)["scroll-padding-top"]).toBe("3.5rem");
  });

  it("maps the hover color of the sidebar, as the other sidebar colors are", () => {
    const inline = findBlock(css, "@theme inline")?.properties ?? {};

    expect(inline["--color-sidebar-hover"]).toBe("var(--side-hover-bg)");
    expect(inline["--color-sidebar-accent"]).toBe("var(--side-active-bg)");
  });
});
