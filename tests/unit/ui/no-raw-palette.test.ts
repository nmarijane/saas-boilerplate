import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A component takes its colors from the theme (`bg-surface`, `text-ink-muted`,
 * `bg-success-bg`...), never from a step of the Tailwind palette, `white` or
 * `black`: a rebrand and the dark theme cannot reach those. A hex color and a
 * typeface are the same kind of mistake: their values live in the theme files
 * (`src/styles/theme.css`, `src/styles/fonts.ts`), and a component only names
 * a token.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

/**
 * The folders the palette guard covers. Each project adds its own components
 * here. A folder that a removed feature took with it is skipped, so that
 * removing a feature (docs/SETUP.md, Phase 3) never breaks this file.
 */
const SCANNED = [
  "src/shared/components",
  "src/features/billing/components",
].filter((directory) => existsSync(join(ROOT, directory)));

const RAW_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;

/** `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, but not `&#160;` or an anchor such as `#main-content`. */
const HEX_COLOR = /(?<![&\w])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})\b/i;

/** A font family declared in CSS, in a style object, or as a Tailwind arbitrary value. */
const FONT_FAMILY = /\bfont-?family\s*:|\bfont-\[family-name:/i;

/** Files that keep their hex colors: the logo of a third-party service is drawn in its own colors, whatever the brand. */
const THIRD_PARTY_MARKS = [
  "src/features/auth/components/social-buttons.tsx",
  "src/features/settings/components/connected-accounts.tsx",
];

/**
 * Pages and emails that are drawn without the stylesheet of the app, so they
 * name a system font themselves: the error page that replaces the root layout,
 * the not-found page that has no layout above it, and the emails, whose
 * clients read inline styles only.
 */
const STANDALONE_SURFACES = [
  "src/app/global-error.tsx",
  "src/app/not-found.tsx",
  "src/features/email/templates/base-layout.tsx",
];

/** The only files that name a typeface. */
const TYPEFACE_FILES = ["src/styles/theme.css", "src/styles/fonts.ts"];

/** The sources of a folder, as paths from the root of the project. */
function sources(directory: string, extension = /\.tsx?$/): string[] {
  if (!existsSync(join(ROOT, directory))) {
    return [];
  }

  return readdirSync(join(ROOT, directory), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((file) => extension.test(file))
    .map((file) => `${directory}/${file.split("\\").join("/")}`)
    .sort();
}

/** A source inside a `components` folder of a feature, at any depth. */
function isFeatureComponent(file: string): boolean {
  return /^src\/features\/(?:[^/]+\/)+components\/.+\.tsx?$/.test(file);
}

function isStory(file: string): boolean {
  return /\.stories\.tsx?$/.test(file);
}

/** `file:line: text` for each line of a source that matches the pattern. */
function offences(file: string, pattern: RegExp): string[] {
  return readFileSync(join(ROOT, file), "utf-8")
    .split("\n")
    .flatMap((line, index) =>
      pattern.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [],
    );
}

const files = SCANNED.flatMap((directory) => sources(directory));

// The stories are left out of the hex guard: the "Other brand" story sets a
// demo brand inline, on purpose.
const componentFiles = [
  ...sources("src/shared/components"),
  ...sources("src/features").filter(isFeatureComponent),
].filter((file) => !isStory(file));

const typefaceFiles = sources("src", /\.(?:tsx?|css)$/).filter(
  (file) => !TYPEFACE_FILES.includes(file),
);

describe("raw palette guard", () => {
  it.each([
    "bg-gray-100",
    "dark:text-gray-300",
    "hover:bg-red-600",
    "border-slate-200",
    "text-white",
    "bg-black/50",
    "from-blue-500",
    "to-purple-500/10",
    "text-green-600",
  ])("flags %s", (className) => {
    expect(RAW_PALETTE.test(className)).toBe(true);
  });

  it.each([
    "bg-surface",
    "text-ink-muted",
    "bg-scrim",
    "text-danger-text",
    "border-border",
    "border-transparent",
    "bg-success-bg",
    "to-brand-2",
    "text-primary-foreground",
    "bg-tone-1",
  ])("lets %s through", (className) => {
    expect(RAW_PALETTE.test(className)).toBe(false);
  });

  it("covers the primitives and the screen states", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "src/shared/components/ui/button.tsx",
        "src/shared/components/ui/popover-styles.ts",
        "src/shared/components/data/page-header.tsx",
      ]),
    );
  });

  it("finds no raw palette color in the shared and billing components", () => {
    const found = files.flatMap((file) => offences(file, RAW_PALETTE));

    expect(
      found,
      `Use a theme token instead of a raw color:\n${found.join("\n")}`,
    ).toEqual([]);
  });
});

describe("hex color guard", () => {
  it.each([
    "#fff",
    "#FFFFFF",
    "#2557f2",
    "#2557f280",
    "#fff8",
    'fill="#4285F4"',
    "bg-[#101217]",
    "color: #e5484d;",
    'backgroundColor: "#000000"',
  ])("flags %s", (text) => {
    expect(HEX_COLOR.test(text)).toBe(true);
  });

  it.each([
    "bg-surface",
    "var(--brand)",
    "color-mix(in oklab, var(--brand) 10%, var(--surface))",
    'href="#main-content"',
    "&#160;",
    "&#x2014;",
    "url(#gradient)",
    "#section",
    "#2557f",
    "#2557f2800",
  ])("lets %s through", (text) => {
    expect(HEX_COLOR.test(text)).toBe(false);
  });

  it.each([
    ["src/features/auth/components/login-form.tsx", true],
    ["src/features/auth/organization/components/org-switcher.tsx", true],
    ["src/features/billing/components/plan-badge.tsx", true],
    ["src/features/email/templates/base-layout.tsx", false],
    ["src/features/billing/actions.ts", false],
    ["src/features/ui-components/helpers.ts", false],
    ["src/shared/components/ui/button.tsx", false],
  ])("tells whether %s is a component of a feature: %s", (file, expected) => {
    expect(isFeatureComponent(file)).toBe(expected);
  });

  it("covers the shared components and leaves the stories out", () => {
    expect(componentFiles).toEqual(
      expect.arrayContaining([
        "src/shared/components/ui/button.tsx",
        "src/shared/components/ui/popover-styles.ts",
        "src/shared/components/data/page-header.tsx",
      ]),
    );
    expect(componentFiles.filter(isStory)).toEqual([]);
  });

  it("finds no hex color in them: token values live in theme.css", () => {
    const found = componentFiles
      .filter((file) => !THIRD_PARTY_MARKS.includes(file))
      .flatMap((file) => offences(file, HEX_COLOR));

    expect(
      found,
      `Add a token to src/styles/theme.css and use it, instead of a hex color:\n${found.join("\n")}`,
    ).toEqual([]);
  });
});

describe("typeface guard", () => {
  it.each([
    "font-family: Georgia, serif;",
    'fontFamily: "system-ui, sans-serif"',
    "[font-family:Georgia]",
    "font-[family-name:var(--font-body)]",
    "  FONT-FAMILY : serif",
  ])("flags %s", (text) => {
    expect(FONT_FAMILY.test(text)).toBe(true);
  });

  it.each([
    "font-sans",
    "font-display",
    "font-mono",
    "font-medium",
    "font-semibold",
    "--typeface-ui: var(--font-geist-sans), ui-sans-serif;",
    '"--typeface-display": "Georgia, serif",',
    "font: inherit;",
  ])("lets %s through", (text) => {
    expect(FONT_FAMILY.test(text)).toBe(false);
  });

  it("covers every source of the app except the two files that name the typefaces", () => {
    expect(typefaceFiles).toEqual(
      expect.arrayContaining([
        "src/styles/global.css",
        "src/shared/components/ui/button.tsx",
      ]),
    );
    for (const file of TYPEFACE_FILES) {
      expect(typefaceFiles).not.toContain(file);
    }
  });

  it("finds no font family outside theme.css and fonts.ts", () => {
    const found = typefaceFiles
      .filter((file) => !STANDALONE_SURFACES.includes(file))
      .flatMap((file) => offences(file, FONT_FAMILY));

    expect(
      found,
      `Name the typeface in src/styles/theme.css (--typeface-*) and use a font-* utility:\n${found.join("\n")}`,
    ).toEqual([]);
  });
});
