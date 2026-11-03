import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
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

/** The tokens the story sets inline: `"--brand": "#E5484D"`. */
const inline = Object.fromEntries(
  [...story.matchAll(/"(--[\w-]+)":\s*"([^"]+)"/g)].map(([, name, value]) => [
    name,
    value,
  ]),
);

describe("the Other brand story", () => {
  it("is titled Foundations/Other brand", () => {
    expect(story).toContain('title: "Foundations/Other brand"');
  });

  it("sets the other brand inline: its colors, its card corner and its display typeface", () => {
    expect(inline).toMatchObject({
      "--brand": "#E5484D",
      "--brand-2": "#F76B15",
      "--corner-card": "4px",
      "--typeface-display": "Georgia, serif",
    });
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
