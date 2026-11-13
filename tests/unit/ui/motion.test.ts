import type { Block } from "../../helpers/css";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findBlock } from "../../helpers/css";

/**
 * A layer that opens (a menu, a dialog, a drawer) moves through utilities that
 * global.css defines: `animate-pop`, `animate-fade` and `animate-sheet-*`. Each
 * plays its entrance on `[data-state=open]` and its exit on `[data-state=closed]`,
 * which is where Radix puts the state, and none plays under reduced motion.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const globalCss = readFileSync(join(ROOT, "src/styles/global.css"), "utf-8");

/**
 * The classes of an animation plugin this project does not install: written in
 * a class list, they do nothing.
 */
const INERT =
  /\b(?:animate-in|animate-out|fade-(?:in|out)-0|zoom-(?:in|out)-95|slide-(?:in|out)-(?:from|to)-[a-z]+(?:-\d+)?)\b/;

/** What each utility plays when its layer opens and when it closes: keyframes, then duration. */
const UTILITIES = [
  { name: "animate-pop", enter: "pop-in 200ms", exit: "pop-out 150ms" },
  { name: "animate-fade", enter: "fade-in 200ms", exit: "fade-out 150ms" },
  {
    name: "animate-sheet-left",
    enter: "sheet-in-left 280ms",
    exit: "sheet-out-left 200ms",
  },
  {
    name: "animate-sheet-right",
    enter: "sheet-in-right 280ms",
    exit: "sheet-out-right 200ms",
  },
  {
    name: "animate-sheet-top",
    enter: "sheet-in-top 280ms",
    exit: "sheet-out-top 200ms",
  },
  {
    name: "animate-sheet-bottom",
    enter: "sheet-in-bottom 280ms",
    exit: "sheet-out-bottom 200ms",
  },
] as const;

const KEYFRAMES = [
  "pop-in",
  "pop-out",
  "fade-in",
  "fade-out",
  "sheet-in-left",
  "sheet-out-left",
  "sheet-in-right",
  "sheet-out-right",
  "sheet-in-top",
  "sheet-out-top",
  "sheet-in-bottom",
  "sheet-out-bottom",
];

/** Where a drawer comes from and goes back to, as a `translate`. */
const OFF_SCREEN = {
  left: "-100% 0",
  right: "100% 0",
  top: "0 -100%",
  bottom: "0 100%",
};

/** The `.ts` and `.tsx` sources of src, as paths from the root of the project. */
const sources = readdirSync(join(ROOT, "src"), {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => /\.tsx?$/.test(file))
  .map((file) => `src/${file.split("\\").join("/")}`)
  .sort();

/** `file:line: text` for each line of a source that holds an inert animation class. */
function offences(file: string): string[] {
  return readFileSync(join(ROOT, file), "utf-8")
    .split("\n")
    .flatMap((line, index) =>
      INERT.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [],
    );
}

/** Every block nested in a block, at any depth. */
function descendants(block: Block | undefined): Block[] {
  return (block?.children ?? []).flatMap((child) => [
    child,
    ...descendants(child),
  ]);
}

/** The rule of a utility that applies to one `data-state`, outside its reduced-motion rule. */
function ruleFor(utility: string, state: string): Block | undefined {
  return findBlock(globalCss, `@utility ${utility}`)?.children.find(
    (child) =>
      !child.header.startsWith("@") &&
      child.header.includes(`[data-state="${state}"]`),
  );
}

function ui(file: string): string {
  return readFileSync(join(ROOT, "src/shared/components/ui", file), "utf-8");
}

describe("inert animation classes", () => {
  it.each([
    "animate-in",
    "data-[state=open]:animate-out",
    "fade-in-0",
    "data-[state=closed]:fade-out-0",
    "zoom-in-95",
    "data-[side=bottom]:slide-in-from-top-2",
    "data-[state=closed]:slide-out-to-left",
  ])("flags %s", (className) => {
    expect(INERT.test(className)).toBe(true);
  });

  it.each([
    "animate-pop",
    "animate-fade",
    "animate-sheet-left",
    "animate-spin",
    "animate-pulse",
    "motion-reduce:animate-none",
    "data-[state=open]:rotate-180",
  ])("lets %s through", (className) => {
    expect(INERT.test(className)).toBe(false);
  });

  it("scans the sources of the primitives", () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        "src/shared/components/ui/dialog.tsx",
        "src/shared/components/ui/sheet.tsx",
      ]),
    );
  });

  it("leaves no animation class without a definition in src", () => {
    const found = sources.flatMap(offences);

    expect(
      found,
      `Animate with animate-pop, animate-fade or animate-sheet-* (src/styles/global.css):\n${found.join("\n")}`,
    ).toEqual([]);
  });
});

describe("motion utilities", () => {
  it("defines the keyframes the motion utilities use", () => {
    const used = UTILITIES.flatMap(({ enter, exit }) => [enter, exit]).map(
      (animation) => animation.split(" ")[0],
    );

    expect([...used].sort()).toEqual([...KEYFRAMES].sort());
    for (const name of KEYFRAMES) {
      expect(
        findBlock(globalCss, `@keyframes ${name}`),
        `@keyframes ${name}`,
      ).toBeDefined();
    }
  });

  it.each(UTILITIES)(
    "plays $name in as $enter and out as $exit, on the expo curve",
    ({ name, enter, exit }) => {
      expect(ruleFor(name, "open")?.properties.animation).toBe(
        `${enter} var(--ease-expo)`,
      );
      expect(ruleFor(name, "closed")?.properties.animation).toBe(
        `${exit} var(--ease-expo)`,
      );
    },
  );

  it("pops a tooltip in too: its open states are delayed-open and instant-open, not open", () => {
    const entrance = ruleFor("animate-pop", "open");

    expect(entrance?.header).toContain('[data-state="delayed-open"]');
    expect(entrance?.header).toContain('[data-state="instant-open"]');
  });

  it("grows a popover from 95 % while it fades in, and shrinks it back as it fades out", () => {
    expect(
      findBlock(globalCss, "@keyframes pop-in", "from")?.properties,
    ).toEqual({ opacity: "0", scale: "0.95" });
    expect(
      findBlock(globalCss, "@keyframes pop-out", "to")?.properties,
    ).toEqual({ opacity: "0", scale: "0.95" });
  });

  it("fades a scrim in and out, and nothing else", () => {
    expect(
      findBlock(globalCss, "@keyframes fade-in", "from")?.properties,
    ).toEqual({ opacity: "0" });
    expect(
      findBlock(globalCss, "@keyframes fade-out", "to")?.properties,
    ).toEqual({ opacity: "0" });
  });

  it.each(Object.entries(OFF_SCREEN))(
    "slides the %s drawer in from, and out to, its own edge",
    (side, translate) => {
      expect(
        findBlock(globalCss, `@keyframes sheet-in-${side}`, "from")?.properties,
      ).toEqual({ translate });
      expect(
        findBlock(globalCss, `@keyframes sheet-out-${side}`, "to")?.properties,
      ).toEqual({ translate });
    },
  );

  it.each(UTILITIES)(
    "turns $name off for reduced motion, in both states",
    ({ name }) => {
      // The last block of the utility: as specific as the rules of the two
      // states above it (a class and an attribute), so it wins by coming after.
      const reduced = findBlock(globalCss, `@utility ${name}`)?.children.at(-1);

      expect(reduced?.header).toBe("@media (prefers-reduced-motion: reduce)");
      expect(
        descendants(reduced).map(
          ({ header, properties }) =>
            `${header} { animation: ${properties.animation} }`,
        ),
      ).toEqual(["&[data-state] { animation: none }"]);
    },
  );
});

describe("the primitives that open and close", () => {
  it.each([
    ["popover.tsx", ["animate-pop"]],
    ["tooltip.tsx", ["animate-pop"]],
    ["dropdown-menu.tsx", ["animate-pop"]],
    ["select.tsx", ["animate-pop"]],
    ["dialog.tsx", ["animate-pop", "animate-fade"]],
    [
      "sheet.tsx",
      [
        "animate-fade",
        "animate-sheet-left",
        "animate-sheet-right",
        "animate-sheet-top",
        "animate-sheet-bottom",
      ],
    ],
  ])("%s animates with %j", (file, utilities) => {
    const source = ui(file);

    for (const utility of utilities) {
      expect(source, `${utility} in ${file}`).toMatch(
        new RegExp(`(?<![\\w-])${utility}(?![\\w-])`),
      );
    }
  });

  it.each([
    ["popover.tsx", "popover"],
    ["tooltip.tsx", "tooltip"],
    ["dropdown-menu.tsx", "dropdown-menu"],
    ["select.tsx", "select"],
  ])(
    "%s grows from the transform origin that Radix exposes for %s",
    (file, primitive) => {
      expect(ui(file)).toContain(
        `origin-(--radix-${primitive}-content-transform-origin)`,
      );
    },
  );
});
