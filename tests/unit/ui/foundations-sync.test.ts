import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBlock } from "../../helpers/color";

/**
 * The Foundations stories list the tokens by name, as plain strings. This keeps
 * that list and the style sheets saying the same: a token that is renamed,
 * dropped or added shows up here, not as a stale swatch.
 */

const srcDir = resolve(import.meta.dirname, "../../../src");
const themeCss = readFileSync(resolve(srcDir, "styles/theme.css"), "utf-8");
const globalCss = readFileSync(resolve(srcDir, "styles/global.css"), "utf-8");
const stories = readFileSync(
  resolve(srcDir, "shared/components/foundations/foundations.stories.tsx"),
  "utf-8",
);

// :root declares every token, the derived ones included (they sit in the
// `:root, [data-brand-scope]` rule).
const tokens = Object.keys(parseBlock(themeCss, ":root"));
const inline = parseBlock(globalCss, "@theme inline");
const structural = parseBlock(globalCss, "@theme");

/** A swatch draws a color, a shape or a shadow: not a distance, not a font list. */
const NOT_SHOWN = [
  "--btn-press",
  "--typeface-ui",
  "--typeface-display",
  "--typeface-mono",
];

/** The text of `const <name> = [ ... ] as const;` in the stories. */
function list(name: string): string {
  const body = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(
    stories,
  )?.[1];
  expect(body, `const ${name} in foundations.stories.tsx`).toBeDefined();
  return body ?? "";
}

/** Every `"--token"` the stories write: the swatches, the radii and the shadows. */
const shown = [...stories.matchAll(/"(--[\w-]+)"/g)].map(([, token]) => token);

describe("foundations stories and theme.css", () => {
  it("lists its tokens as plain strings, which this test can read", () => {
    expect(shown.length).toBeGreaterThan(40);
  });

  it("shows no token twice", () => {
    expect(shown.filter((token, i) => shown.indexOf(token) !== i)).toEqual([]);
  });

  it("shows only tokens that theme.css declares", () => {
    expect(shown.filter((token) => !tokens.includes(token))).toEqual([]);
  });

  it("shows every token that theme.css declares, but those a swatch cannot draw", () => {
    expect(
      tokens.filter(
        (token) => !shown.includes(token) && !NOT_SHOWN.includes(token),
      ),
    ).toEqual([]);
  });

  it("keeps the list of tokens a swatch cannot draw honest: each one is real, and none is shown", () => {
    expect(NOT_SHOWN.filter((token) => !tokens.includes(token))).toEqual([]);
    expect(NOT_SHOWN.filter((token) => shown.includes(token))).toEqual([]);
  });

  it("draws a shadow sample with the 1 px border a real card or popover has, so that it reads in dark", () => {
    const story = /export const Shadows[\s\S]*?(?=\nexport const |$)/.exec(
      stories,
    )?.[0];

    expect(story).toMatch(/className=\{`[^`]*\bborder\b[^`]*\$\{utility\}`\}/);
  });

  it("shows the danger background and the hover and press colors of the destructive button", () => {
    expect(shown).toEqual(
      expect.arrayContaining([
        "--danger-bg",
        "--btn-danger-hover",
        "--btn-danger-active",
      ]),
    );
  });

  it("shows the entity title step", () => {
    expect(structural["--text-entity"]).toBeDefined();
    expect(list("typeScale")).toContain('"text-entity"');
  });

  it("shows the steps of the type scale that global.css declares", () => {
    const steps = [...list("typeScale").matchAll(/"(text-[\w-]+)"/g)].map(
      ([, step]) => step,
    );
    const scale = Object.keys(structural)
      .filter((name) => /^--text-[a-z]+$/.test(name))
      .map((name) => name.replace("--", ""));

    expect(steps.length).toBeGreaterThan(0);
    expect([...steps].sort()).toEqual([...scale].sort());
  });

  describe.each([
    ["radii", "rounded", "--radius"],
    ["shadows", "shadow", "--shadow"],
  ])("the %s", (name, utility, variable) => {
    // `{ utility: "rounded-lg", token: "--corner-card" }`
    const pairs = [
      ...list(name).matchAll(
        /utility:\s*"([\w-]+)",\s*token:\s*"(--[\w-]+)"/g,
      ),
    ].map(([, className, token]) => ({ className, token }));

    it("each go with the token that global.css maps the utility to", () => {
      expect(pairs.length).toBeGreaterThan(0);
      for (const { className, token } of pairs) {
        const step = className.slice(utility.length + 1);
        expect(inline[`${variable}-${step}`], className).toBe(`var(${token})`);
      }
    });

    it("are every one that global.css maps", () => {
      const mapped = Object.keys(inline)
        .filter((variableName) => variableName.startsWith(`${variable}-`))
        .map((variableName) =>
          variableName.replace(`${variable}-`, `${utility}-`),
        );

      expect(pairs.map(({ className }) => className).sort()).toEqual(
        mapped.sort(),
      );
    });
  });
});
