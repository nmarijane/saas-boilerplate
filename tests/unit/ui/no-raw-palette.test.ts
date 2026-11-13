import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A component, a page or a layout takes its colors from the theme (`bg-surface`,
 * `text-ink-muted`, `bg-success-bg`...), never from a step of the Tailwind
 * palette, `white` or `black`: a rebrand and the dark theme cannot reach those.
 * A hex color and a typeface are the same kind of mistake: their values live in
 * the theme files (`src/styles/theme.css`, `src/styles/fonts.ts`), and the code
 * only names a token. The palette and hex guards read the folders of SCANNED
 * and the typeface guard all of `src`; the five exceptions below say what each
 * of them leaves out.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

/**
 * The folders the guards cover: the shared layer, the features and the routes,
 * which is all the code of the app that draws. A folder that a project adds
 * there is covered with no edit here, and a folder that a removed feature took
 * with it is skipped, so that removing a feature (docs/SETUP.md, Phase 3) never
 * breaks this file.
 */
const SCANNED = ["src/shared", "src/features", "src/app"].filter((directory) =>
  existsSync(join(ROOT, directory)),
);

const RAW_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;

/** `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, but not `&#160;` or an anchor such as `#main-content`. */
const HEX_COLOR = /(?<![&\w])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})\b/i;

/** A font family declared in CSS, in a style object, or as a Tailwind arbitrary value. */
const FONT_FAMILY = /\bfont-?family\s*:|\bfont-\[family-name:/i;

/**
 * Left out of the hex guard only: the logo of a third-party service is drawn in
 * its own colors, whatever the brand. These files are read for the palette like
 * the rest.
 */
const THIRD_PARTY_MARKS = [
  "src/features/auth/components/social-buttons.tsx",
  "src/features/settings/components/connected-accounts.tsx",
];

/**
 * Left out of the hex guard only: the other brand of the "Other brand" story,
 * which the README's screenshot sets on <html> as well, is a second brand's
 * colors written out on purpose.
 */
const DEMO_BRANDS = ["src/shared/components/foundations/other-brand.ts"];

/**
 * Left out of the three guards (palette, hex color and typeface): pages that are
 * drawn without the stylesheet of the app, so they write their colors and their
 * system font out as inline styles. They are the error page that replaces the
 * root layout, the not-found page that has no layout above it, and the base
 * layout of the emails.
 */
const STANDALONE_SURFACES = [
  "src/app/global-error.tsx",
  "src/app/not-found.tsx",
  "src/features/email/templates/base-layout.tsx",
];

/**
 * Left out of the three guards as well: the folders drawn the same way. The
 * templates of the emails write their colors and their fonts out, as mail
 * clients read inline styles only.
 */
const STANDALONE_FOLDERS = ["src/features/email/templates"];

/** The only files that name a typeface: the typeface guard reads every other source of src. */
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

/** A source that is drawn outside the theme: a standalone page, or a file of a standalone folder. */
function isStandalone(file: string): boolean {
  return (
    STANDALONE_SURFACES.includes(file) ||
    STANDALONE_FOLDERS.some((folder) => file.startsWith(`${folder}/`))
  );
}

function isStory(file: string): boolean {
  return /\.stories\.tsx?$/.test(file);
}

/**
 * A source with its comments blanked out, line for line: a reference such as
 * `// see #106` is not a color. A comment opens at the start of a line, after a
 * space or after a `{` (as a JSX comment does), so the slash and the star of
 * `accept="image/*"` open none.
 */
function withoutComments(source: string): string {
  return source
    .replace(
      /(^|[\s{])(\/\*[\s\S]*?\*\/)/g,
      (_, lead: string, block: string) =>
        lead + block.replace(/[^\n]/g, " "),
    )
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** `file:line: text` for each line of a source that matches the pattern, once `read` has had its say on the source. */
function offences(
  file: string,
  pattern: RegExp,
  read = (source: string) => source,
): string[] {
  const source = readFileSync(join(ROOT, file), "utf-8");
  const lines = source.split("\n");

  return read(source)
    .split("\n")
    .flatMap((line, index) =>
      pattern.test(line)
        ? [`${file}:${index + 1}: ${lines[index]?.trim()}`]
        : [],
    );
}

const files = SCANNED.flatMap((directory) => sources(directory)).filter(
  (file) => !isStandalone(file),
);

// The stories are left out of the hex guard, and the demo brand they share is
// exempt (DEMO_BRANDS): the "Other brand" story sets a second brand, on purpose.
const hexFiles = files.filter((file) => !isStory(file));

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

  // The guards read every source of the shared layer, of the features and of the
  // routes, not only the folders named components: a page, a layout or a helper
  // that draws is held to the theme as well.
  it("covers the routes and the code of the features that is not a component", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "src/app/[locale]/layout.tsx",
        "src/features/app-shell.ts",
      ]),
    );
  });

  it("leaves out the surfaces that are drawn outside the theme", () => {
    for (const file of STANDALONE_SURFACES.filter((one) =>
      existsSync(join(ROOT, one)),
    )) {
      expect(files, file).not.toContain(file);
    }
  });

  // A feature that is removed takes its folder with it, and its files are no
  // longer asked for: removing a feature never breaks this file.
  it("covers the components of the API keys and of the webhooks", () => {
    const expected = [
      "src/features/api-keys/components/api-key-list.tsx",
      "src/features/api-keys/components/create-key-modal.tsx",
      "src/features/webhooks/components/webhook-list.tsx",
      "src/features/webhooks/components/create-webhook-modal.tsx",
    ].filter((file) => existsSync(join(ROOT, file)));

    expect(files).toEqual(expect.arrayContaining(expected));
  });

  // The sign-in pages and the account menu share this folder. The logos of
  // Google and GitHub keep their own colors (THIRD_PARTY_MARKS, below) but are
  // read for the palette like the rest.
  it("covers the components of the sign-in pages and the account menu", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "src/features/auth/components/auth-card.tsx",
        "src/features/auth/components/sign-in-form.tsx",
        "src/features/auth/components/sign-up-form.tsx",
        "src/features/auth/components/forgot-password-form.tsx",
        "src/features/auth/components/reset-password-form.tsx",
        "src/features/auth/components/password-strength.tsx",
        "src/features/auth/components/social-buttons.tsx",
        "src/features/auth/components/account-menu.tsx",
      ]),
    );
  });

  it("finds no raw palette color in the scanned sources", () => {
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
    ["src/app/global-error.tsx", true],
    ["src/features/email/templates/base-layout.tsx", true],
    ["src/features/email/templates/welcome.tsx", true],
    ["src/features/email/templates/parts/footer.tsx", true],
    ["src/features/email/send.ts", false],
    ["src/features/email/templates-draft/welcome.tsx", false],
    ["src/app/[locale]/layout.tsx", false],
    ["src/shared/components/ui/button.tsx", false],
  ])("tells whether %s is drawn outside the theme: %s", (file, expected) => {
    expect(isStandalone(file)).toBe(expected);
  });

  it.each([
    ["// see #106", false],
    ["const size = 1; // #fff", false],
    ["/* #fff */", false],
    ["{/* the #E5484D of the other brand */}", false],
    ["/*\n * #123456\n */", false],
    ['fill="#fff" // white', true],
    ['<input accept="image/*" style={{ color: "#E5484D" }} />\n{/* the end */}', true],
    ['const link = "https://example.com"; const color = "#fff";', true],
  ])("reads the colors of the code and not those of a comment: %j", (text, flagged) => {
    expect(HEX_COLOR.test(withoutComments(text))).toBe(flagged);
  });

  it("keeps the lines of a source when it blanks the comments, so that an offence is reported at its line", () => {
    const source = "a\n/* b\n c */\nd // e\nf";

    expect(withoutComments(source).split("\n")).toHaveLength(
      source.split("\n").length,
    );
  });

  it("covers the shared components and the routes, and leaves the stories out", () => {
    expect(hexFiles).toEqual(
      expect.arrayContaining([
        "src/shared/components/ui/button.tsx",
        "src/shared/components/ui/popover-styles.ts",
        "src/shared/components/data/page-header.tsx",
        "src/app/[locale]/layout.tsx",
      ]),
    );
    expect(hexFiles.filter(isStory)).toEqual([]);
  });

  it("finds no hex color in them: token values live in theme.css", () => {
    const found = hexFiles
      .filter((file) => !THIRD_PARTY_MARKS.includes(file))
      .filter((file) => !DEMO_BRANDS.includes(file))
      .flatMap((file) => offences(file, HEX_COLOR, withoutComments));

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
      .filter((file) => !isStandalone(file))
      .flatMap((file) => offences(file, FONT_FAMILY));

    expect(
      found,
      `Name the typeface in src/styles/theme.css (--typeface-*) and use a font-* utility:\n${found.join("\n")}`,
    ).toEqual([]);
  });
});
