import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  parseBlock,
  parseThemeBlocks,
} from "../../helpers/color";

const stylesDir = resolve(import.meta.dirname, "../../../src/styles");
const { light, dark: darkOverrides } = parseThemeBlocks(
  readFileSync(resolve(stylesDir, "theme.css"), "utf-8"),
);
const inline = parseBlock(
  readFileSync(resolve(stylesDir, "global.css"), "utf-8"),
  "@theme inline",
);

// The hover and press colors of the destructive button and the danger badge
// are mixed in their class lists, so theme-contrast.test.ts does not see them.
// --ink is dark in light mode and light in dark mode: the mix always moves away
// from the on-danger color.
const DANGER_HOVER = "color-mix(in oklab, var(--danger) 90%, var(--ink))";
const DANGER_PRESS = "color-mix(in oklab, var(--danger) 82%, var(--ink))";

describe.each([
  ["light", light],
  ["dark", { ...light, ...darkOverrides }],
])("%s theme, states of the button, badge and link", (_mode, vars) => {
  const all = { ...vars, ...inline };

  it.each([
    ["at rest", "var(--danger)"],
    ["on hover", DANGER_HOVER],
    ["on press", DANGER_PRESS],
  ])("keeps the destructive label readable %s", (_state, background) => {
    expect(
      contrastRatio("var(--danger-on)", background, all),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a danger link readable on the page background", () => {
    expect(
      contrastRatio("var(--danger-text)", "var(--surface-sunken)", all),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
