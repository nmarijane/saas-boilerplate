import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  parseBlock,
  parseRules,
  parseThemeBlocks,
} from "../../helpers/color";
import { findBlock } from "../../helpers/css";

const stylesDir = resolve(import.meta.dirname, "../../../src/styles");
const themeCss = readFileSync(resolve(stylesDir, "theme.css"), "utf-8");
const globalCss = readFileSync(resolve(stylesDir, "global.css"), "utf-8");

const { light, dark: darkOverrides } = parseThemeBlocks(themeCss);
// .dark sits on <html> next to :root: it overrides what it redeclares and the
// rest (shapes, typefaces, derived colors) is evaluated again on top of it.
// Only `darkOverrides` says what .dark declares itself: `dark` spreads `light`,
// so it holds every token whatever .dark does.
const dark = { ...light, ...darkOverrides };

const inline = parseBlock(globalCss, "@theme inline");
const structural = parseBlock(globalCss, "@theme");

function words(...lines: string[]): string[] {
  return lines.flatMap((line) => line.split(" "));
}

function prefixed(prefix: string, ...lines: string[]): string[] {
  return words(...lines).map((name) => `${prefix}${name}`);
}

function pairs(...lines: string[]): [fg: string, bg: string][] {
  return words(...lines).map((pair) => {
    const [fg = "", bg = ""] = pair.split("/");
    return [fg, bg];
  });
}

/** Every raw token a theme provides: each one is declared in :root. */
const REQUIRED_TOKENS = prefixed(
  "--",
  "ink ink-soft ink-muted surface surface-sunken surface-raised hairline control-border",
  "brand brand-2 brand-on brand-tint brand-tint-ink focus-ring gradient-signature",
  "success success-text success-bg warning-bg warning-text warning-bar danger danger-text danger-on",
  "track bar side-bg side-active-bg side-hover-bg scrim",
  "tone-1 tone-2 tone-3 tone-4 tone-1-ink tone-2-ink tone-3-ink tone-4-ink",
  "btn-primary-hover btn-primary-active btn-primary-edge btn-press",
  "corner-xs corner-sm corner-field corner-card corner-dialog elevation-card elevation-pop",
  "typeface-ui typeface-display typeface-mono",
);

/** The dark theme changes colors and shadows, not shapes or typefaces: these stay as :root has them. */
const SHARED_TOKENS = prefixed(
  "--",
  "btn-primary-edge btn-press",
  "corner-xs corner-sm corner-field corner-card corner-dialog",
  "typeface-ui typeface-display typeface-mono",
);

/** What the dark theme overrides: .dark declares each of them itself, the scrim included. */
const DARK_TOKENS = REQUIRED_TOKENS.filter(
  (token) => !SHARED_TOKENS.includes(token),
);

/** Derived from the brand: a [data-brand-scope] recomputes them from its own --brand. */
const SCOPED_TOKENS = prefixed(
  "--",
  "brand-tint brand-tint-ink focus-ring bar gradient-signature",
  "btn-primary-hover btn-primary-active",
);

const TYPEFACES = prefixed("--typeface-", "ui display mono");

/** What the primitives build on: shadcn names first, then ours. */
const INLINE_VARIABLES = [
  ...prefixed(
    "--color-",
    "background foreground card card-foreground popover popover-foreground",
    "primary primary-foreground secondary secondary-foreground muted muted-foreground",
    "accent accent-foreground destructive destructive-foreground border input ring",
    "sidebar sidebar-background sidebar-foreground sidebar-primary sidebar-primary-foreground",
    "sidebar-accent sidebar-accent-foreground sidebar-border sidebar-ring",
    "ink ink-soft ink-muted surface surface-sunken surface-raised hairline control",
    "brand brand-tint brand-tint-ink brand-on",
    "success success-text success-bg warning-bg warning-text warning-bar",
    "danger danger-text danger-on track bar scrim",
    "tone-1 tone-2 tone-3 tone-4 tone-1-ink tone-2-ink tone-3-ink tone-4-ink",
  ),
  ...prefixed("--radius-", "xs sm md lg xl"),
  ...prefixed("--shadow-", "card pop"),
  ...prefixed("--font-", "sans display mono"),
];

/** Text on its background: 4.5:1. */
const TEXT_PAIRS = pairs(
  "ink/surface ink/surface-sunken ink-soft/surface ink-muted/surface ink-muted/surface-sunken",
  // The label of the inactive segment of a segmented control, on its track.
  "ink-muted/track",
  "brand-on/brand brand-on/btn-primary-hover brand-on/btn-primary-active",
  "brand/surface brand/surface-sunken brand-tint-ink/brand-tint",
  // On the brand tint: a selected option card (title, description), and the
  // brand-colored action of a toast or a ghost button under the pointer.
  "ink/brand-tint ink-muted/brand-tint brand/brand-tint",
  "success-text/success-bg success-text/surface warning-text/warning-bg danger-text/surface",
  "danger-on/danger ink-muted/side-bg",
  "tone-1-ink/tone-1 tone-2-ink/tone-2 tone-3-ink/tone-3 tone-4-ink/tone-4",
  // Text on a hovered row of a table or a list, and on the active item of a
  // menu: `bg-accent` is `side-active-bg`. A cell holds ink, muted ink, a link
  // (brand) or a status in color.
  "ink/side-active-bg ink-muted/side-active-bg brand/side-active-bg",
  "success-text/side-active-bg danger-text/side-active-bg",
);

/** Controls, field borders, focus ring and bars against what they sit on: 3:1. */
const CONTROL_PAIRS = pairs(
  "control-border/surface control-border/surface-sunken",
  "focus-ring/surface focus-ring/surface-sunken",
  // The ring a menu or list row draws inside itself, over its highlight tint,
  // and the danger one of a destructive row.
  "focus-ring/side-active-bg danger/surface",
  "bar/track warning-bar/track danger/track success/surface",
  // The signature gradient runs from `brand` (the `bar` above) to `brand-2`, and
  // meets the track wherever the fill stops: its end must hold 3:1 too.
  "brand-2/track",
);

/** The shadcn name pairs the existing components lean on, as mapped inline. */
const SHADCN_PAIRS = pairs(
  "color-foreground/color-background color-card-foreground/color-card",
  "color-popover-foreground/color-popover color-primary-foreground/color-primary",
  "color-secondary-foreground/color-secondary color-muted-foreground/color-muted",
  "color-accent-foreground/color-accent color-muted-foreground/color-accent",
  "color-destructive-foreground/color-destructive",
  "color-sidebar-foreground/color-sidebar-background",
  "color-sidebar-primary-foreground/color-sidebar-primary",
  "color-sidebar-accent-foreground/color-sidebar-accent",
);

describe("theme tokens", () => {
  it.each(REQUIRED_TOKENS)("defines %s in :root", (token) => {
    expect(light[token], `${token} in :root`).toBeDefined();
  });

  it.each(DARK_TOKENS)("redeclares %s in .dark itself", (token) => {
    expect(darkOverrides[token], `${token} in .dark`).toBeDefined();
  });

  it("declares in .dark only the tokens the dark theme overrides", () => {
    // A shape or a typeface changed here would need to leave SHARED_TOKENS; a
    // new token, to join REQUIRED_TOKENS and the contrast pairs.
    expect(
      Object.keys(darkOverrides).filter(
        (token) => !DARK_TOKENS.includes(token),
      ),
    ).toEqual([]);
  });

  it("redeclares every literal hex color of :root inside .dark", () => {
    const literals = Object.keys(light).filter((token) =>
      /^#[\da-f]{3,8}$/i.test(light[token]),
    );
    expect(literals.length).toBeGreaterThan(0);
    expect(literals.filter((token) => !(token in darkOverrides))).toEqual([]);
  });

  it("gives the shadows their own dark values: black and stronger, with no ring, as a popover keeps its 1 px border", () => {
    // The light shadows are 4 % and 25 % of a near black: on a dark page they vanish.
    const strongest = (shadow: string) =>
      Math.max(
        ...[...shadow.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map(([, alpha]) =>
          Number(alpha),
        ),
      );

    for (const token of ["--elevation-card", "--elevation-pop"]) {
      expect(darkOverrides[token], `${token} in .dark`).toBeDefined();
      expect(darkOverrides[token]).not.toBe(light[token]);
      expect(darkOverrides[token]).toMatch(/rgba\(0,\s*0,\s*0,/);
      expect(strongest(darkOverrides[token])).toBeGreaterThan(
        strongest(light[token]),
      );
    }
    // A ring of the hairline color would double the border of every popover into a 2 px edge.
    expect(darkOverrides["--elevation-pop"]).not.toContain("var(--hairline)");
  });

  it("washes a dark page out more strongly than a light one: the scrim is its own, and heavier", () => {
    const alpha = (scrim: string) =>
      Number(/^rgba\([^)]*,\s*([\d.]+)\)$/.exec(scrim)?.[1]);

    expect(darkOverrides["--scrim"]).toBeDefined();
    expect(alpha(darkOverrides["--scrim"])).toBeGreaterThan(
      alpha(light["--scrim"]),
    );
  });

  it.each(TYPEFACES)(
    "keeps %s a valid font list while the font variable is undefined",
    (token) => {
      // What the browser computes without --font-geist-*: the var() falls back.
      const list = light[token].replace(/var\(--[\w-]+,([^)]+)\)/, "$1");
      const families = list.split(",").map((family) => family.trim());
      expect(list).not.toContain("var(");
      expect(families.every(Boolean)).toBe(true);
      expect(families.length).toBeGreaterThan(2);
    },
  );
});

describe("brand scope", () => {
  const rules = parseRules(themeCss);
  const lightScope = parseBlock(themeCss, "[data-brand-scope]");
  const darkScope = parseBlock(themeCss, ".dark [data-brand-scope]");

  it.each(SCOPED_TOKENS)(
    "recomputes %s inside a [data-brand-scope], in light and in dark",
    (token) => {
      expect(
        lightScope[token],
        `${token} in :root, [data-brand-scope]`,
      ).toBeDefined();
      expect(
        darkScope[token],
        `${token} in .dark, .dark [data-brand-scope]`,
      ).toBeDefined();
    },
  );

  it("declares the brand-derived tokens in no other rule", () => {
    const strays = rules.filter(
      (rule) =>
        SCOPED_TOKENS.some((token) => token in rule.declarations) &&
        !rule.selectors.some((selector) =>
          selector.endsWith("[data-brand-scope]"),
        ),
    );
    expect(strays.map((rule) => rule.selectors)).toEqual([]);
  });

  it("puts the .dark rules after the :root rules, so .dark wins on <html>", () => {
    const lastLight = rules.findLastIndex((rule) =>
      rule.selectors.includes(":root"),
    );
    const firstDark = rules.findIndex((rule) =>
      rule.selectors.includes(".dark"),
    );
    expect(lastLight).toBeGreaterThanOrEqual(0);
    expect(firstDark).toBeGreaterThan(lastLight);
  });
});

describe("global.css", () => {
  it.each([
    ["--color-primary", "var(--brand)"],
    ["--color-background", "var(--surface-sunken)"],
    ["--color-ring", "var(--focus-ring)"],
    ["--color-input", "var(--control-border)"],
    ["--color-danger-on", "var(--danger-on)"],
    ["--color-destructive-foreground", "var(--danger-on)"],
    ["--color-scrim", "var(--scrim)"],
  ])(
    "maps %s to %s inline, so a subtree can override the token",
    (name, value) => {
      expect(inline[name]).toBe(value);
    },
  );

  it.each(INLINE_VARIABLES)("maps %s for the Tailwind utilities", (name) => {
    expect(inline[name]).toBeDefined();
  });

  it("only points the inline mapping at tokens theme.css defines", () => {
    const dangling = Object.entries(inline).filter(([, value]) => {
      const token = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
      return token === undefined || !(token in light);
    });
    expect(dangling).toEqual([]);
  });

  it("sets the type scale to 12/13/14/16/20/28/40 px", () => {
    const px = (name: string) => Number.parseFloat(structural[name]) * 16;
    const scale = words("caption meta body section panel page key").map(
      (name) => [px(`--text-${name}`), px(`--text-${name}--line-height`)],
    );
    expect(scale).toEqual([
      [12, 16],
      [13, 18],
      [14, 20],
      [16, 24],
      [20, 28],
      [28, 34],
      [40, 44],
    ]);
  });

  it("rings focus-visible targets but not programmatic tabindex=-1 containers", () => {
    const selectors =
      parseRules(globalCss).find((rule) =>
        rule.selectors.includes("a:focus-visible"),
      )?.selectors ?? [];
    expect(selectors).toContain(
      '[tabindex]:not([tabindex="-1"]):focus-visible',
    );
    expect(selectors).not.toContain("[tabindex]:focus-visible");
  });

  it("reads the default border color from --hairline where the border is, not from the copy on :root", () => {
    // `--color-border` is computed once, on :root: a subtree that sets its own
    // --hairline would keep the default border.
    expect(
      findBlock(globalCss, "@layer base", "*")?.properties["border-color"],
    ).toBe("var(--hairline)");
  });

  it("draws the focus ring as 2 px of surface, then 6 px of focus ring, over an outline that forced-colors mode repaints", () => {
    const ring = findBlock(globalCss, "@utility focus-ring")?.properties;

    expect(ring?.["box-shadow"]).toBe(
      "0 0 0 2px var(--surface), 0 0 0 6px var(--focus-ring)",
    );
    expect(ring?.outline).toBe("2px solid transparent");
  });

  it("grows tap-target to a 44 px square around its element, without moving the layout", () => {
    const target = findBlock(globalCss, "@utility tap-target");
    const layer = findBlock(globalCss, "@utility tap-target", "&::before");

    expect(target?.properties).toEqual({ position: "relative" });
    expect(layer?.properties).toEqual({
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "max(100%, 44px)",
      height: "max(100%, 44px)",
      transform: "translate(-50%, -50%)",
    });
  });

  it("cuts animations and transitions short under prefers-reduced-motion", () => {
    const reduced = findBlock(
      globalCss,
      "@layer base",
      "@media (prefers-reduced-motion: reduce)",
      "*, ::before, ::after",
    );

    expect(reduced?.properties).toEqual({
      "animation-duration": "0.01ms !important",
      "animation-iteration-count": "1 !important",
      "animation-delay": "0s !important",
      "transition-duration": "0.01ms !important",
      "transition-delay": "0s !important",
      "scroll-behavior": "auto !important",
    });
  });

  it.each([
    ["--text-section--font-weight", "600"],
    ["--container-content", "70rem"],
    ["--ease-expo", "cubic-bezier(0.2, 0, 0, 1)"],
  ])("sets %s to %s", (name, value) => {
    expect(structural[name]).toBe(value);
  });
});

describe("fonts.ts", () => {
  const fonts = readFileSync(resolve(stylesDir, "fonts.ts"), "utf-8");
  /** The options passed to a font loader: `fontMono = Geist_Mono({ ... })`. */
  const options = (name: string) =>
    new RegExp(`${name} = \\w+\\(\\{([^}]*)\\}\\)`).exec(fonts)?.[1] ?? "";

  it("preloads the sans font, which is read above the fold", () => {
    expect(options("fontSans")).toContain("--font-geist-sans");
    expect(options("fontSans")).not.toContain("preload: false");
  });

  it("does not preload the mono font, which is not used above the fold", () => {
    expect(options("fontMono")).toContain("--font-geist-mono");
    expect(options("fontMono")).toContain("preload: false");
  });
});

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_mode, vars) => {
  const all = { ...vars, ...inline };
  const ratio = (fg: string, bg: string) =>
    contrastRatio(`var(--${fg})`, `var(--${bg})`, all);

  it.each(TEXT_PAIRS)("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SHADCN_PAIRS)("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CONTROL_PAIRS)("%s on %s reaches 3:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the quota bar and the warning bar apart", () => {
    expect(ratio("bar", "warning-bar")).toBeGreaterThanOrEqual(1.5);
  });
});
