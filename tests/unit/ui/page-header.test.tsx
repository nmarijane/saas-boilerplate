import type { ComponentProps, ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HouseIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { PageHeader } from "@/shared/components/data/page-header";
import { PageHeaderSkeleton } from "@/shared/components/data/skeletons";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { attribute, classesOf, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// A closed menu draws its trigger only: its list is a portal, which static
// markup never reaches. The parts of the list are stood in for by plain
// elements, and the props of every row are kept, in order, so that the list can
// be read. The menu and its trigger stay the real ones.
const rows = vi.hoisted(
  () =>
    [] as {
      variant?: string;
      onSelect?: (event: Event) => void;
    }[],
);

vi.mock("@/shared/components/ui/dropdown-menu", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/components/ui/dropdown-menu")>();
  const { createElement } = await import("react");
  return {
    ...actual,
    DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
      createElement("div", { "data-slot": "menu" }, children),
    DropdownMenuItem: ({
      children,
      variant,
      onSelect,
    }: ComponentProps<typeof actual.DropdownMenuItem>) => {
      rows.push({ variant, onSelect });
      return createElement(
        "div",
        { role: "menuitem", "data-variant": variant },
        children,
      );
    },
    DropdownMenuSeparator: () => createElement("hr"),
  };
});

beforeEach(() => {
  rows.length = 0;
});

const srcDir = resolve(import.meta.dirname, "../../../src");

// The line heights of the type scale, as global.css declares them (in rem).
const textTokens = Object.fromEntries(
  [
    ...readFileSync(resolve(srcDir, "styles/global.css"), "utf-8").matchAll(
      /(--text-[a-z]+--line-height):\s*([\d.]+)rem/g,
    ),
  ].map(([, name, value]) => [name, value]),
);

const DEFAULT_STRINGS = {
  en: { moreActions: "More actions" },
  fr: { moreActions: "Autres actions" },
} as const;

const render = (
  props: Partial<ComponentProps<typeof PageHeader>> = {},
  locale: "en" | "fr" = "en",
) =>
  renderWithIntl(
    <PageHeader title="Welcome back, Camille" {...props} />,
    locale,
  );

/** The start tag of the first element that carries this `data-slot`. */
function slotTag(html: string, slot: string): string {
  return (
    new RegExp(`<[a-z0-9]+[^>]*\\sdata-slot="${slot}"[^>]*>`).exec(html)?.[0] ??
    ""
  );
}

/** The classes of a start tag, with the `&` and the `>` that static markup writes as entities. */
function decoded(tag: string): string[] {
  return classesOf(tag).map((name) =>
    name.replaceAll("&amp;", "&").replaceAll("&gt;", ">"),
  );
}

/** The classes that apply at every width: those without a `max-[...]:` prefix. */
function atEveryWidth(classes: string[]): string[] {
  return classes.filter((name) => !name.startsWith("max-[")).toSorted();
}

/** The start tag of the « More actions » button, or an empty string. */
function moreButton(html: string, label = "More actions"): string {
  return (
    startTags(html, "button").find(
      (tag) => attribute(tag, "aria-label") === label,
    ) ?? ""
  );
}

/** What follows a start tag, up to the next closing tag. */
function contentAfter(html: string, tag: string, closing: string): string {
  const start = html.indexOf(tag) + tag.length;
  return html.slice(start, html.indexOf(closing, start));
}

/** The rows of the menu in order, with `|` where the separator falls. */
function menuOutline(html: string): string[] {
  return [...html.matchAll(/<div role="menuitem"[^>]*>(.*?)<\/div>|<hr\/>/g)].map(
    ([, row]) => (row === undefined ? "|" : row.replaceAll(/<[^>]*>/g, "")),
  );
}

describe("page header", () => {
  describe("its « ⋯ » button", () => {
    const onSelect = vi.fn();
    const moreActions = [{ label: "Rename", onSelect }];

    it("is named « More actions » when the menu has an action", () => {
      const html = render({ moreActions });

      expect(moreButton(html)).not.toBe("");
    });

    it("is named in French from the locale", () => {
      const html = render({ moreActions }, "fr");

      expect(moreButton(html, "Autres actions")).not.toBe("");
      expect(moreButton(html)).toBe("");
    });

    it("is absent when the menu has no action", () => {
      for (const html of [render(), render({ moreActions: [] })]) {
        expect(html).not.toContain("More actions");
        expect(startTags(html, "button")).toHaveLength(0);
      }
    });

    it("is a menu button of the design system, a real button and the only one it adds", () => {
      const html = render({ moreActions });
      const tag = moreButton(html);

      expect(startTags(html, "button")).toHaveLength(1);
      expect(attribute(tag, "type")).toBe("button");
      expect(attribute(tag, "aria-haspopup")).toBe("menu");
      expect(attribute(tag, "aria-expanded")).toBe("false");
      expect(classesOf(tag)).toEqual(
        expect.arrayContaining(["size-10", "tap-target"]),
      );
    });

    it("draws its dots for the eye only: the name says what the button does", () => {
      const html = render({ moreActions });
      const content = contentAfter(html, moreButton(html), "</button>");

      expect(content).toMatch(/^<svg[^>]*\saria-hidden="true"/);
      expect(content.replaceAll(/<[^>]*>/g, "")).toBe("");
    });
  });

  describe("its menu", () => {
    const rename = { label: "Rename", onSelect: vi.fn(), icon: PencilIcon };
    const duplicate = { label: "Duplicate", onSelect: vi.fn() };
    const remove = {
      label: "Delete project",
      onSelect: vi.fn(),
      icon: Trash2Icon,
      destructive: true,
    };

    it("lists the actions in the order given", () => {
      const html = render({ moreActions: [duplicate, rename] });

      expect(menuOutline(html)).toEqual(["Duplicate", "Rename"]);
    });

    it("puts a destructive action last, after a separator, wherever it was given", () => {
      const html = render({ moreActions: [remove, rename, duplicate] });

      expect(menuOutline(html)).toEqual([
        "Rename",
        "Duplicate",
        "|",
        "Delete project",
      ]);
    });

    it("draws no separator when every action is of one kind", () => {
      expect(menuOutline(render({ moreActions: [rename, duplicate] }))).toEqual(
        ["Rename", "Duplicate"],
      );
      expect(menuOutline(render({ moreActions: [remove] }))).toEqual([
        "Delete project",
      ]);
    });

    it("gives the destructive variant to a destructive action only", () => {
      render({ moreActions: [rename, remove] });

      expect(rows.map((row) => row.variant)).toEqual([
        "default",
        "destructive",
      ]);
    });

    it("draws the icon of an action before its label, for the eye only", () => {
      const html = render({ moreActions: [rename, duplicate] });
      const [withIcon, withoutIcon] = [
        ...html.matchAll(/<div role="menuitem"[^>]*>(.*?)<\/div>/g),
      ].map(([, row]) => row);

      expect(withIcon).toMatch(/^<svg[^>]*\saria-hidden="true"[^>]*>.*<\/svg>Rename$/);
      expect(withoutIcon).toBe("Duplicate");
    });

    it("calls the handler of an action without the event of the menu", () => {
      const onSelect = vi.fn();
      render({ moreActions: [{ label: "Rename", onSelect }] });

      expect(rows[0].onSelect).toBeTypeOf("function");
      rows[0].onSelect?.(new Event("select"));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith();
    });
  });

  describe("its title and its context", () => {
    it("has exactly one h1, the title, with the other slots filled", () => {
      const html = render({
        icon: HouseIcon,
        context: "Studio Nord · Pro plan",
        primaryAction: <button type="button">New project</button>,
        moreActions: [{ label: "Rename", onSelect: vi.fn() }],
        alert: <p>Heads up</p>,
        tabs: <p>Tabs</p>,
      });

      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toContain(">Welcome back, Camille</h1>");
    });

    it("sets the title in the display face, at the page size, tightly", () => {
      const classes = classesOf(startTags(render(), "h1")[0]);

      expect(classes).toEqual(
        expect.arrayContaining([
          "font-display",
          "text-page",
          "tracking-tight",
          "text-ink",
        ]),
      );
    });

    it("lets a long word of the title wrap inside the row, at 320 px", () => {
      const classes = classesOf(startTags(render(), "h1")[0]);

      expect(classes).toContain("wrap-break-word");
    });

    it("sets the context under the title, in muted meta text", () => {
      const html = render({ context: "Studio Nord · Pro plan" });
      const tag = slotTag(html, "page-header-context");

      expect(html.indexOf("</h1>")).toBeLessThan(html.indexOf(tag));
      expect(html).toContain(">Studio Nord · Pro plan</div>");
      expect(classesOf(tag)).toEqual(
        expect.arrayContaining(["text-meta", "text-ink-muted", "wrap-break-word"]),
      );
    });

    it("takes a node as the context, not only a string", () => {
      const html = render({ context: <span data-plan="pro">Pro plan</span> });

      expect(html).toContain('<span data-plan="pro">Pro plan</span>');
    });

    it("draws no context line without a context", () => {
      expect(render()).not.toContain('data-slot="page-header-context"');
    });

    it("renders the legacy description as the context", () => {
      const html = render({ description: "Legacy" });

      expect(html).toContain(">Legacy<");
      expect(classesOf(slotTag(html, "page-header-context"))).toContain(
        "text-ink-muted",
      );
    });

    it("prefers the context to the legacy description", () => {
      const html = render({ context: "Context", description: "Legacy" });

      expect(html).toContain(">Context<");
      expect(html).not.toContain("Legacy");
    });
  });

  describe("its tile", () => {
    it("draws the icon in a 56 px brand tile", () => {
      const html = render({ icon: HouseIcon });
      const classes = classesOf(slotTag(html, "icon-tile"));

      expect(classes).toEqual(
        expect.arrayContaining(["size-14", "bg-brand-tint", "shrink-0"]),
      );
      expect(html).toMatch(/data-slot="icon-tile"[^>]*><svg[^>]*\saria-hidden="true"/);
      expect(html.indexOf("data-slot=\"icon-tile\"")).toBeLessThan(
        html.indexOf("<h1"),
      );
    });

    it("draws an illustration where the tile would be, hidden from assistive technology", () => {
      const html = render({ illustration: <svg data-art="workspace" /> });
      const tag = slotTag(html, "page-header-illustration");

      expect(attribute(tag, "aria-hidden")).toBe("true");
      expect(classesOf(tag)).toContain("shrink-0");
      expect(html).toContain('<svg data-art="workspace"></svg>');
      expect(html.indexOf(tag)).toBeLessThan(html.indexOf("<h1"));
    });

    it("lets the illustration win when it comes with an icon", () => {
      const html = render({ icon: HouseIcon, illustration: <svg data-art="workspace" /> });

      expect(html).toContain('data-slot="page-header-illustration"');
      expect(html).not.toContain('data-slot="icon-tile"');
    });

    it("draws no tile without an icon or an illustration", () => {
      const html = render();

      expect(html).not.toContain('data-slot="icon-tile"');
      expect(html).not.toContain('data-slot="page-header-illustration"');
    });
  });

  describe("its actions", () => {
    it("draws the primary action first, then the « ⋯ » button, after the title", () => {
      const html = render({
        primaryAction: <button type="button">New project</button>,
        moreActions: [{ label: "Rename", onSelect: vi.fn() }],
      });
      const primary = html.indexOf(">New project</button>");
      const more = html.indexOf(moreButton(html));

      expect(html.indexOf("</h1>")).toBeLessThan(primary);
      expect(primary).toBeLessThan(more);
    });

    it("draws the legacy actions where the primary action goes, when there is none", () => {
      const html = render({
        actions: <button type="button">Export</button>,
        moreActions: [{ label: "Rename", onSelect: vi.fn() }],
      });

      expect(html).toContain(">Export</button>");
      expect(html.indexOf(">Export</button>")).toBeLessThan(
        html.indexOf(moreButton(html)),
      );
    });

    it("prefers the primary action to the legacy actions", () => {
      const html = render({
        primaryAction: <button type="button">New project</button>,
        actions: <button type="button">Export</button>,
      });

      expect(html).toContain(">New project</button>");
      expect(html).not.toContain("Export");
    });

    it("draws no area for the actions when there are none", () => {
      expect(render()).not.toContain('data-slot="page-header-actions"');
      expect(render({ moreActions: [] })).not.toContain(
        'data-slot="page-header-actions"',
      );
    });

    it("lets the actions wrap, with room between lines for two 44 px targets", () => {
      const html = render({
        primaryAction: <button type="button">New project</button>,
      });

      expect(classesOf(slotTag(html, "page-header-actions"))).toEqual(
        expect.arrayContaining(["flex", "flex-wrap", "gap-x-2", "gap-y-3"]),
      );
    });
  });

  describe("its alert and its tabs", () => {
    it("draws the alert, then the tabs, under the title and the actions", () => {
      const html = render({
        primaryAction: <button type="button">New project</button>,
        alert: <p>Alert text</p>,
        tabs: <p>Tabs text</p>,
      });
      const at = (text: string) => html.indexOf(text);

      expect(at("</h1>")).toBeLessThan(at(">New project</button>"));
      expect(at(">New project</button>")).toBeLessThan(at("Alert text"));
      expect(at("Alert text")).toBeLessThan(at("Tabs text"));
    });

    it("draws the tabs alone, when there is no alert", () => {
      const html = render({ tabs: <p>Tabs text</p> });

      expect(html.indexOf("</h1>")).toBeLessThan(html.indexOf("Tabs text"));
    });
  });

  describe("its layout", () => {
    it("stacks on a phone and sits on one row from the sm breakpoint, as its skeleton does", () => {
      const html = render({ icon: HouseIcon });
      const row = startTags(html, "div")[1];

      expect(attribute(row, "data-slot")).toBe("page-header-row");
      expect(classesOf(row)).toEqual(
        expect.arrayContaining([
          "flex",
          "flex-col",
          "gap-4",
          "sm:flex-row",
          "sm:items-center",
          "sm:justify-between",
        ]),
      );
    });

    it("lets the text shrink beside the tile, so that nothing overflows at 320 px", () => {
      const html = render({ icon: HouseIcon, context: "Studio Nord" });
      // The column of the title and the context, and the block that holds it
      // with the tile: both take the room left and give it up.
      const column = /(<div[^>]*>)<h1/.exec(html)?.[1] ?? "";
      const block = /(<div[^>]*>)<span data-slot="icon-tile"/.exec(html)?.[1] ?? "";

      for (const tag of [column, block]) {
        expect(classesOf(tag)).toEqual(
          expect.arrayContaining(["min-w-0", "flex-1"]),
        );
      }
    });

    it("lays out its row, its text block and its text column as its skeleton does, so that the page does not move when it arrives", () => {
      const skeleton = renderWithIntl(<PageHeaderSkeleton />);
      const header = render({ icon: HouseIcon, context: "Studio Nord" });
      // A box is told by two or three of its classes, wherever it sits in the
      // markup: the row, the block of tile and text, the column of text.
      const box = (html: string, ...names: string[]) =>
        startTags(html, "div")
          .map(classesOf)
          .find((classes) => names.every((name) => classes.includes(name))) ?? [];

      for (const names of [
        ["sm:flex-row"],
        ["min-w-0", "items-center"],
        ["space-y-1"],
      ]) {
        const drawn = box(skeleton, ...names);

        expect(drawn.length).toBeGreaterThan(0);
        expect(box(header, ...names)).toEqual(expect.arrayContaining(drawn));
      }
    });

    it("sets the title and the context in boxes as tall as the lines its skeleton stands in for", () => {
      // 34 px and 18 px: the line heights of `text-page` and `text-meta`, which
      // the skeleton draws as `h-8.5` and `h-4.5` (a step of 0.25 rem each).
      const skeleton = renderWithIntl(<PageHeaderSkeleton />);
      const heights = startTags(skeleton, "div")
        .map(classesOf)
        .flatMap((classes) => classes.filter((name) => /^h-(?:8\.5|4\.5)$/.test(name)));

      expect(heights).toEqual(["h-8.5", "h-4.5"]);
      expect(heights.map((name) => Number(name.slice(2)) * 0.25)).toEqual([
        Number.parseFloat(textTokens["--text-page--line-height"]),
        Number.parseFloat(textTokens["--text-meta--line-height"]),
      ]);
    });

    it("merges the class of the caller onto the root", () => {
      const html = render({ className: "mb-6" });
      const root = slotTag(html, "page-header");

      expect(classesOf(root)).toEqual(
        expect.arrayContaining(["flex", "flex-col", "mb-6"]),
      );
    });
  });

  describe("its step-down under 480 px", () => {
    // Under 30rem (a phone) the tile is 40 px and the title 20 px; from 30rem up
    // they are 56 px and 28 px. IconTile has no responsive size, so the small
    // size is a set of `max-[30rem]:` classes on the one tile.
    const tile = (html: string) => decoded(slotTag(html, "icon-tile"));
    const icon = (html: string) => decoded(startTags(html, "svg")[0]);
    const title = (html: string) => decoded(startTags(html, "h1")[0]);

    it("shrinks the tile to the box of a medium tile under 30rem", () => {
      const medium = renderWithIntl(<IconTile icon={HouseIcon} size="md" />);
      const box = tile(medium).filter((name) => /^(?:size|rounded)-/.test(name));

      expect(box).toEqual(["size-10", "rounded-md"]);
      expect(tile(render({ icon: HouseIcon }))).toEqual(
        expect.arrayContaining(box.map((name) => `max-[30rem]:${name}`)),
      );
    });

    it("shrinks the icon to the icon of a medium tile under 30rem", () => {
      const medium = renderWithIntl(<IconTile icon={HouseIcon} size="md" />);
      const size = icon(medium).find((name) => name.startsWith("size-"));

      expect(size).toBe("size-5");
      expect(tile(render({ icon: HouseIcon }))).toContain(
        `max-[30rem]:[&>svg]:${size}`,
      );
    });

    it("keeps the large tile and its own icon from 30rem up, as they were", () => {
      const large = renderWithIntl(<IconTile icon={HouseIcon} tone="brand" size="lg" />);
      const html = render({ icon: HouseIcon });

      expect(atEveryWidth(tile(html))).toEqual(atEveryWidth(tile(large)));
      expect(atEveryWidth(tile(html))).toEqual(
        expect.arrayContaining(["size-14", "rounded-lg"]),
      );
      expect(icon(html)).toEqual(expect.arrayContaining(icon(large)));
    });

    it("draws one tile, which changes size, and not two", () => {
      const html = render({ icon: HouseIcon });

      expect(html.match(/data-slot="icon-tile"/g)).toHaveLength(1);
    });

    it("steps the title down to the panel size under 30rem", () => {
      const classes = title(render());

      expect(classes).toContain("max-[30rem]:text-panel");
      expect(classes).not.toContain("text-panel");
    });

    it("keeps the title at the page size from 30rem up, as it was", () => {
      expect(atEveryWidth(title(render()))).toEqual(
        [
          "font-display",
          "font-semibold",
          "text-balance",
          "text-ink",
          "text-page",
          "tracking-tight",
          "wrap-break-word",
        ].toSorted(),
      );
    });

    it("leaves the context line at its size at every width", () => {
      const classes = decoded(
        slotTag(render({ context: "Studio Nord" }), "page-header-context"),
      );

      expect(classes.some((name) => name.startsWith("max-["))).toBe(false);
      expect(classes).toContain("text-meta");
    });

    it("steps its skeleton down at the same width and to the same sizes, so that the page does not move on a phone", () => {
      const boxes = startTags(renderWithIntl(<PageHeaderSkeleton />), "div").map(
        decoded,
      );
      const skeletonTile = boxes.find((classes) => classes.includes("size-14"));
      const skeletonTitle = boxes.find((classes) => classes.includes("h-8.5"));
      // `h-7` is 1.75 rem, the line height of `text-panel`.
      const panel = Number.parseFloat(textTokens["--text-panel--line-height"]);

      expect(skeletonTile).toEqual(
        expect.arrayContaining(["max-[30rem]:size-10", "max-[30rem]:rounded-md"]),
      );
      expect(skeletonTitle).toContain("max-[30rem]:h-7");
      expect(7 * 0.25).toBe(panel);
    });

    it("adds no breakpoint to the theme: 30rem is written where it is used", () => {
      const css = readFileSync(resolve(srcDir, "styles/global.css"), "utf-8");

      expect(css).not.toMatch(/--breakpoint-/);
    });
  });
});

describe("page header strings", () => {
  it.each(["en", "fr"] as const)(
    "has the label of the « ⋯ » button in %s, with its default copy",
    (locale) => {
      const common = { en: en.common, fr: fr.common }[locale];

      expect(common).toMatchObject(DEFAULT_STRINGS[locale]);
    },
  );
});

describe("page header sources", () => {
  const FILES = [
    "shared/components/data/page-header",
    "shared/components/data/page-header.stories",
  ];

  it.each(FILES)(
    "%s.tsx uses the theme tokens: no raw palette color, white, black or hex",
    (name) => {
      const source = readFileSync(resolve(srcDir, `${name}.tsx`), "utf-8");

      expect(source).not.toMatch(
        /\b(?:bg|text|border|ring|fill|stroke|from|to|shadow|outline|decoration|divide|accent|caret)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/,
      );
      expect(source).not.toMatch(/#[\da-f]{3,8}\b/i);
      expect(source).not.toMatch(/\brgba?\(/);
    },
  );

  it("page-header.tsx says on `moreActions` that it needs a client component", () => {
    const source = readFileSync(
      resolve(srcDir, "shared/components/data/page-header.tsx"),
      "utf-8",
    );
    const at = source.indexOf("moreActions?:");
    const doc = source.slice(source.lastIndexOf("/**", at), at);

    expect(doc).toMatch(/needs a client component/);
  });

  it("page-header.tsx has no visible string of its own: they come from the locales or the caller", () => {
    const source = readFileSync(
      resolve(srcDir, "shared/components/data/page-header.tsx"),
      "utf-8",
    );

    expect(source).not.toMatch(/More actions|Autres actions/);
    expect(source).not.toMatch(/aria-label="[^"{]/);
  });
});
