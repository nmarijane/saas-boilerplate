import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { InitialTile, toneOf } from "@/shared/components/ui/initial-tile";
import { attribute, classesOf, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/** The start tag of the tile a markup draws. */
function tile(props: Partial<ComponentProps<typeof InitialTile>> = {}): string {
  return (
    startTags(
      renderWithIntl(<InitialTile name="Camille Laurent" {...props} />),
      "span",
    )[0] ?? ""
  );
}

/** What sits between the tags of the tile. */
function letters(props: Partial<ComponentProps<typeof InitialTile>> = {}) {
  const html = renderWithIntl(
    <InitialTile name="Camille Laurent" {...props} />,
  );

  return />([^<]*)</.exec(html)?.[1];
}

/** The number N of the `bg-tone-N` class of a tile. */
function toneOfTile(props: Partial<ComponentProps<typeof InitialTile>> = {}) {
  const found = classesOf(tile(props)).find((name) =>
    /^bg-tone-\d$/.test(name),
  );

  return Number(found?.slice("bg-tone-".length));
}

const SEEDS = Array.from({ length: 8 }, (_, index) => `org_${index + 1}`);

describe("toneOf", () => {
  it("gives the same tone to the same seed, within 1..4", () => {
    expect(toneOf("org_1")).toBe(toneOf("org_1"));
    expect(new Set(SEEDS.map(toneOf)).size).toBeGreaterThan(1);
    for (const seed of SEEDS) {
      expect([1, 2, 3, 4]).toContain(toneOf(seed));
    }
  });

  it("always answers one of the four tones, whatever the seed is", () => {
    for (const seed of ["", " ", "é", "😀", "x".repeat(10_000), "0", "-1"]) {
      expect([1, 2, 3, 4]).toContain(toneOf(seed));
    }
  });

  it("keeps the tone of a seed from one release to the next", () => {
    // Pinned: people recognize an entity by its tile, so a new hash would
    // repaint every tile of every project.
    expect(
      Object.fromEntries(
        ["", "org_1", "org_2", "org_3", "Acme", "Camille Laurent"].map(
          (seed) => [seed, toneOf(seed)],
        ),
      ),
    ).toEqual({
      "": 4,
      org_1: 2,
      org_2: 4,
      org_3: 3,
      Acme: 4,
      "Camille Laurent": 1,
    });
  });

  it("spreads ids over the four tones, whether they count up or look random", () => {
    const shapes = [
      (index: number) => String(index),
      (index: number) => `org_${index}`,
      (index: number) =>
        `org_${((index * 2_654_435_761) >>> 0).toString(16).padStart(8, "0")}`,
    ];

    for (const shape of shapes) {
      const counts = [0, 0, 0, 0];
      for (let index = 0; index < 400; index++) {
        counts[toneOf(shape(index)) - 1] += 1;
      }

      // A fair share is 100: no tone is left rare, or crowded.
      for (const count of counts) {
        expect(count).toBeGreaterThan(60);
        expect(count).toBeLessThan(140);
      }
    }
  });

  it("reads the whole seed: two ids that differ by their last character do not always match", () => {
    const tones = new Set(
      Array.from("abcdefgh", (letter) => toneOf(`workspace-${letter}`)),
    );

    expect(tones.size).toBeGreaterThan(1);
  });
});

describe("initial tile", () => {
  it("draws two initials, hidden from assistive technology", () => {
    const html = renderWithIntl(<InitialTile name="Camille Laurent" />);
    const tag = tile();

    expect(html).toContain(">CL<");
    expect(attribute(tag, "aria-hidden")).toBe("true");
    expect(classesOf(tag).some((name) => /^bg-tone-[1-4]$/.test(name))).toBe(
      true,
    );
  });

  it("is a span of its own slot, with no role: the name beside it says what it stands for", () => {
    const tag = tile();

    expect(tag).toMatch(/^<span /);
    expect(attribute(tag, "data-slot")).toBe("initial-tile");
    expect(attribute(tag, "role")).toBeUndefined();
    expect(attribute(tag, "aria-label")).toBeUndefined();
  });

  describe("its initials", () => {
    it("are the first letter of each of the first two words, in capitals", () => {
      expect(letters({ name: "ada lovelace" })).toBe("AL");
    });

    it("are one letter for a name of one word", () => {
      expect(letters({ name: "Acme" })).toBe("A");
    });

    it("are two letters at most", () => {
      expect(letters({ name: "Jean Pierre Dupont" })).toBe("JP");
      expect(letters({ name: "Anne-Charlotte de Montmorency-Laval" })).toBe(
        "AD",
      );
    });

    it("skip the spaces that surround or separate the words", () => {
      expect(letters({ name: "  Ada   Lovelace " })).toBe("AL");
    });

    it("fall back to a question mark for an empty name, so that a tile is never blank", () => {
      expect(letters({ name: "" })).toBe("?");
      expect(letters({ name: "   " })).toBe("?");
    });
  });

  describe("its tone", () => {
    it("reads the background and the ink of the same numbered tone", () => {
      const classes = classesOf(tile());
      const n = toneOfTile();

      expect(classes).toContain(`bg-tone-${n}`);
      expect(classes).toContain(`text-tone-${n}-ink`);
    });

    it("comes from the name unless a seed is given", () => {
      expect(toneOfTile({ name: "Camille Laurent" })).toBe(
        toneOf("Camille Laurent"),
      );
    });

    it("comes from the seed when there is one, so that a rename does not repaint the tile", () => {
      const other = ["org_1", "org_2", "org_3", "org_4"].find(
        (seed) => toneOf(seed) !== toneOf("Camille Laurent"),
      );

      expect(other).toBeDefined();
      expect(toneOfTile({ seed: other })).toBe(toneOf(other ?? ""));
      expect(toneOfTile({ name: "Camille", seed: "org_1" })).toBe(
        toneOfTile({ name: "Camille Laurent", seed: "org_1" }),
      );
    });

    it.each([1, 2, 3, 4] as const)(
      "can be tone %s: the seed that gives it draws its tokens",
      (n) => {
        const seed = Array.from(
          { length: 64 },
          (_, index) => `seed-${index}`,
        ).find((candidate) => toneOf(candidate) === n);

        expect(seed).toBeDefined();
        expect(classesOf(tile({ seed }))).toEqual(
          expect.arrayContaining([`bg-tone-${n}`, `text-tone-${n}-ink`]),
        );
      },
    );

    it("has one background and one ink, never two tones", () => {
      const classes = classesOf(tile());

      expect(classes.filter((name) => name.startsWith("bg-"))).toHaveLength(1);
      expect(
        classes.filter((name) => /^text-tone-\d-ink$/.test(name)),
      ).toHaveLength(1);
    });
  });

  describe("its size", () => {
    it.each([
      ["sm", ["size-8", "rounded-sm", "text-meta"]],
      ["md", ["size-10", "rounded-md", "text-section"]],
      ["lg", ["size-14", "rounded-lg", "text-panel"]],
    ] as const)(
      "makes the %s tile 32, 40 or 56 px with its own corner and letters",
      (size, expected) => {
        expect(classesOf(tile({ size }))).toEqual(
          expect.arrayContaining([...expected]),
        );
      },
    );

    it("is a 40 px tile unless it is told otherwise", () => {
      expect(classesOf(tile())).toEqual(
        expect.arrayContaining(["size-10", "rounded-md"]),
      );
    });

    it("draws one size and one corner, never the classes of two", () => {
      for (const size of ["sm", "md", "lg"] as const) {
        const classes = classesOf(tile({ size }));

        expect(classes.filter((name) => /^size-\d+$/.test(name))).toHaveLength(
          1,
        );
        expect(
          classes.filter((name) => /^rounded-(?:sm|md|lg)$/.test(name)),
        ).toHaveLength(1);
      }
    });
  });

  it("centers its letters, never shrinks beside a long label and keeps the line as tall as the letters", () => {
    expect(classesOf(tile())).toEqual(
      expect.arrayContaining([
        "inline-grid",
        "place-items-center",
        "shrink-0",
        "leading-none",
      ]),
    );
  });

  it("writes the letters in the display face, in semibold, so that they hold the tile", () => {
    expect(classesOf(tile())).toEqual(
      expect.arrayContaining(["font-display", "font-semibold"]),
    );
  });

  it("does not let the letters be selected, as a tile is a picture and not a word", () => {
    expect(classesOf(tile())).toContain("select-none");
  });

  it("lets a caller's class win", () => {
    const classes = classesOf(tile({ className: "size-12" }));

    expect(classes).toContain("size-12");
    expect(classes).not.toContain("size-10");
  });
});
