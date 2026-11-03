import type { Rgb } from "../../helpers/color";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  parseBlock,
  parseRules,
  parseThemeBlocks,
  resolveColor,
} from "../../helpers/color";

/** Browsers round to 8 bits at paint time, so one step of difference is fine. */
function expectWithinOneStep(actual: Rgb, expected: Rgb) {
  expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(1);
}

describe("contrastRatio", () => {
  it("gives 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff", {})).toBeCloseTo(21, 1);
  });

  it("matches the WCAG reference ratio of #767676 on white", () => {
    expect(contrastRatio("#767676", "#ffffff", {})).toBeCloseTo(4.54, 2);
  });

  it("does not depend on the order of the two colors", () => {
    const vars = { "--fg": "#2557f2", "--bg": "#f5f6f8" };
    expect(contrastRatio("var(--fg)", "var(--bg)", vars)).toBe(
      contrastRatio("var(--bg)", "var(--fg)", vars),
    );
  });
});

describe("resolveColor", () => {
  it("reads #rgb and #rrggbb", () => {
    expect(resolveColor("#fff", {})).toEqual({ r: 255, g: 255, b: 255 });
    expect(resolveColor("#2557F2", {})).toEqual({ r: 37, g: 87, b: 242 });
  });

  // Reference values are the pixels Chrome paints for the same color-mix().
  // The first one tells Oklab from sRGB: an sRGB mix would give 128.
  it.each([
    ["color-mix(in oklab, #ffffff 50%, #000000)", { r: 99, g: 99, b: 99 }],
    ["color-mix(in oklab, #2557f2 70%, #101217)", { r: 31, g: 67, b: 170 }],
    ["color-mix(in oklab, #2557f2 90%, #000)", { r: 31, g: 75, b: 210 }],
    ["color-mix(in oklab, #5b84ff 90%, #fff)", { r: 106, g: 145, b: 255 }],
  ])("mixes %s like a browser", (value, expected) => {
    expectWithinOneStep(resolveColor(value, {}), expected);
  });

  it("follows chained var() references", () => {
    expect(
      resolveColor("var(--a)", { "--a": "var(--b)", "--b": "#2557f2" }),
    ).toEqual({ r: 37, g: 87, b: 242 });
  });

  it("resolves var() inside color-mix()", () => {
    const vars = { "--brand": "#2557f2", "--surface": "#ffffff" };
    // Chrome paints this mix as #e8f0ff.
    expectWithinOneStep(
      resolveColor(
        "color-mix(in oklab, var(--brand) 10%, var(--surface))",
        vars,
      ),
      { r: 232, g: 240, b: 255 },
    );
  });

  it("names the variable it cannot find", () => {
    expect(() => resolveColor("var(--missing)", {})).toThrow("--missing");
  });

  it("refuses circular references", () => {
    expect(() => resolveColor("var(--a)", { "--a": "var(--a)" })).toThrow(
      "Circular",
    );
  });

  it("refuses a color syntax it does not understand", () => {
    expect(() => resolveColor("rgb(1, 2, 3)", {})).toThrow("Unsupported");
  });
});

describe("parseThemeBlocks", () => {
  it("splits the :root and .dark blocks", () => {
    expect(parseThemeBlocks(":root{--x:#fff;}\n.dark{--x:#000;}")).toEqual({
      light: { "--x": "#fff" },
      dark: { "--x": "#000" },
    });
  });

  it("ignores comments, including commented-out declarations", () => {
    const css = `
      /* The brand. */
      :root {
        --a: #111111; /* inline note */
        /* --b: #222222; */
        --c: color-mix(in oklab, var(--a) 10%, #fff);
      }
    `;
    expect(parseThemeBlocks(css).light).toEqual({
      "--a": "#111111",
      "--c": "color-mix(in oklab, var(--a) 10%, #fff)",
    });
  });

  it("feeds each map from every rule whose selector list includes :root or .dark", () => {
    const css = `
      :root { --a: #111111; }
      :root, [data-brand-scope] { --b: #222222; }
      .dark { --a: #aaaaaa; }
      .dark, .dark [data-brand-scope] { --b: #bbbbbb; }
    `;
    expect(parseThemeBlocks(css)).toEqual({
      light: { "--a": "#111111", "--b": "#222222" },
      dark: { "--a": "#aaaaaa", "--b": "#bbbbbb" },
    });
  });

  it("keeps a last declaration that has no trailing semicolon", () => {
    expect(parseThemeBlocks(":root{--x:#fff}").light).toEqual({
      "--x": "#fff",
    });
  });
});

describe("parseBlock", () => {
  it("matches one item of a selector list, exactly", () => {
    const css = `
      :root, [data-brand-scope] { --a: #111111; }
      .dark [data-brand-scope] { --a: #222222; }
    `;
    expect(parseBlock(css, "[data-brand-scope]")).toEqual({ "--a": "#111111" });
    expect(parseBlock(css, ".dark [data-brand-scope]")).toEqual({
      "--a": "#222222",
    });
    expect(parseBlock(css, ".dark")).toEqual({});
  });

  it("reads an at-rule that follows statements, and tells @theme from @theme inline", () => {
    const css = `
      @import "tailwindcss";
      @theme inline { --a: var(--b); }
      @theme { --c: 1rem; }
    `;
    expect(parseBlock(css, "@theme inline")).toEqual({ "--a": "var(--b)" });
    expect(parseBlock(css, "@theme")).toEqual({ "--c": "1rem" });
  });
});

describe("parseRules", () => {
  it("lists the rules that hold no nested block, in source order", () => {
    const css = `
      @layer base {
        a:focus-visible, button:hover { --x: 1; }
        @media (print) { p { --y: 2; } }
      }
    `;
    expect(parseRules(css)).toEqual([
      {
        selectors: ["a:focus-visible", "button:hover"],
        declarations: { "--x": "1" },
      },
      { selectors: ["p"], declarations: { "--y": "2" } },
    ]);
  });
});
