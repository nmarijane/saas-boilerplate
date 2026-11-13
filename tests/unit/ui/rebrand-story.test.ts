import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OTHER_BRAND } from "@/shared/components/foundations/other-brand";
import { contrastRatio, parseThemeBlocks } from "../../helpers/color";

/**
 * The "Other brand" story is the proof that one container can be rebranded by
 * its tokens alone. It reads as a recipe, so it is checked as one.
 */

const srcDir = resolve(import.meta.dirname, "../../../src");
const story = readFileSync(
  resolve(srcDir, "shared/components/foundations/rebrand.stories.tsx"),
  "utf-8",
);
const { light, dark: darkOverrides } = parseThemeBlocks(
  readFileSync(resolve(srcDir, "styles/theme.css"), "utf-8"),
);
const readme = readFileSync(resolve(srcDir, "../README.md"), "utf-8");

/** The tokens of the other brand: `"--brand": "#E5484D"`. */
const inline = OTHER_BRAND;

describe("the Other brand story", () => {
  it("is titled Foundations/Other brand", () => {
    expect(story).toContain('title: "Foundations/Other brand"');
  });

  it("sets the other brand: its colors, its card corner and its display typeface", () => {
    expect(inline).toMatchObject({
      "--brand": "#E5484D",
      "--brand-2": "#F76B15",
      "--corner-card": "4px",
      "--typeface-display": "Georgia, serif",
    });
  });

  // The README's screenshot sets the same tokens on <html>: one list, so that
  // the story and the picture show the same brand.
  it("takes those tokens from OTHER_BRAND and keeps no copy of its own", () => {
    expect(story).toContain('import { OTHER_BRAND } from "./other-brand";');
    expect(story).not.toMatch(/"--[\w-]+":/);
  });

  // The README shows four of the tokens as CSS, written by hand: it is read
  // here, so that the picture and the excerpt beside it keep saying the same.
  it("is the brand that the CSS excerpt of the README shows", () => {
    const excerpt = /```css\n([\s\S]*?)```/.exec(readme)?.[1] ?? "";
    const shown = Object.fromEntries(
      [...excerpt.matchAll(/^(--[\w-]+): (.+);$/gm)].map(([, name, value]) => [
        name,
        value,
      ]),
    );

    expect(Object.keys(shown)).toEqual(
      expect.arrayContaining([
        "--brand",
        "--brand-2",
        "--corner-card",
        "--typeface-display",
      ]),
    );
    expect(OTHER_BRAND).toMatchObject(shown);
  });

  it("puts data-brand-scope on the container that holds that style, or the derived tokens would not recompute", () => {
    expect(story).toMatch(/<div\s+data-brand-scope\s+style=\{otherBrand\}/);
  });

  it("shows the header, both buttons, badges, a bar at 82 %, a card and a segmented control", () => {
    for (const part of [
      "<PageHeader",
      "<Button>",
      '<Button variant="outline">',
      "<Badge",
      "<ProgressBar",
      "value={82}",
      "<Card>",
      "<SegmentedControl",
    ]) {
      expect(story, part).toContain(part);
    }
  });

  // The pairs it draws: the label of the primary button in its three states
  // and of a brand badge, the tile of the header, the focus ring and the bar.
  // `dark` is :root with .dark on top, as on <html>; the inline tokens win on
  // the container, and a derived token is read from the --brand it finds there.
  describe.each([
    ["light", light],
    ["dark", { ...light, ...darkOverrides }],
  ])("in %s", (_mode, theme) => {
    const vars = { ...theme, ...inline };
    const ratio = (foreground: string, background: string) =>
      contrastRatio(`var(--${foreground})`, `var(--${background})`, vars);

    it.each([
      ["brand-on", "brand"],
      ["brand-on", "btn-primary-hover"],
      ["brand-on", "btn-primary-active"],
      ["brand-tint-ink", "brand-tint"],
    ])("reaches 4.5:1 for %s on %s", (foreground, background) => {
      expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    });

    it.each([
      ["focus-ring", "surface"],
      ["focus-ring", "surface-sunken"],
      ["bar", "track"],
    ])("reaches 3:1 for %s on %s", (foreground, background) => {
      expect(ratio(foreground, background)).toBeGreaterThanOrEqual(3);
    });
  });
});
