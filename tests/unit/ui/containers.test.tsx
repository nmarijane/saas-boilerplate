import type { ComponentProps, ReactNode } from "react";
import type { Accepts } from "../../helpers/types";
import type { Column } from "@/shared/components/data/data-table";
import type { IconTileProps } from "@/shared/components/ui/icon-tile";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UsersIcon } from "lucide-react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { ariaSort, DataTable, sortRows } from "@/shared/components/data/data-table";
import { StatCard } from "@/shared/components/data/stat-card";
import * as cardModule from "@/shared/components/ui/card";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { List, ListRow } from "@/shared/components/ui/list";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  contrastRatio,
  parseBlock,
  parseThemeBlocks,
} from "../../helpers/color";
import { attribute, classesOf, decodedClassesOf, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl is replaced: no Next router runs in a test. A plain anchor stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
  };
});

const srcDir = resolve(import.meta.dirname, "../../../src");
const stylesDir = resolve(srcDir, "styles");

const { light, dark: darkOverrides } = parseThemeBlocks(
  readFileSync(resolve(stylesDir, "theme.css"), "utf-8"),
);
const inline = parseBlock(
  readFileSync(resolve(stylesDir, "global.css"), "utf-8"),
  "@theme inline",
);

/** The start tag of the element that carries this `data-slot`. */
function slotTag(html: string, slot: string): string {
  return (
    new RegExp(`<[a-z0-9]+[^>]*\\sdata-slot="${slot}"[^>]*>`).exec(html)?.[0] ??
    ""
  );
}

/** The start tag of the element whose content starts with this text. */
function tagBefore(html: string, text: string): string {
  const escaped = text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`<[a-z0-9]+[^>]*>(?=${escaped}<)`).exec(html)?.[0] ?? "";
}

/** The classes of the element whose content is this text. */
function classesOfText(html: string, text: string): string[] {
  return classesOf(tagBefore(html, text));
}

/** The `bg-*` utilities of a class list: variants, which start otherwise, are left out. */
function backgrounds(classes: string[]): string[] {
  return classes.filter((name) => name.startsWith("bg-"));
}

/** What sits inside the first element of this name, which holds no element of its own name. */
function innerHtml(html: string, name: string): string {
  return (
    new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(html)?.[1] ?? ""
  );
}

describe("card", () => {
  const surface = (className?: string) =>
    classesOf(slotTag(renderWithIntl(<Card className={className} />), "card"));

  it("is a card-radius surface with a hairline border and the card shadow", () => {
    expect(surface()).toEqual(
      expect.arrayContaining([
        "rounded-lg",
        "border",
        "border-hairline",
        "bg-card",
        "shadow-card",
      ]),
    );
  });

  it("stacks its parts 16 px apart, with 20 px above and below", () => {
    expect(surface()).toEqual(
      expect.arrayContaining(["flex", "flex-col", "gap-4", "py-5"]),
    );
  });

  it("has dropped the old shape", () => {
    const classes = surface();

    for (const old of ["rounded-xl", "shadow-sm", "gap-6", "py-6"]) {
      expect(classes).not.toContain(old);
    }
  });

  it("lets a caller's class win", () => {
    const classes = surface("gap-0 py-3");

    expect(classes).toEqual(expect.arrayContaining(["gap-0", "py-3"]));
    expect(classes).not.toContain("gap-4");
    expect(classes).not.toContain("py-5");
  });

  it("keeps the exports the app imports", () => {
    expect(Object.keys(cardModule).sort()).toEqual([
      "Card",
      "CardContent",
      "CardDescription",
      "CardFooter",
      "CardHeader",
      "CardTitle",
    ]);
  });

  it.each([
    ["header", CardHeader, "card-header"],
    ["content", CardContent, "card-content"],
    ["footer", CardFooter, "card-footer"],
  ] as const)(
    "gives the %s 20 px on each side, as the card has",
    (_name, Part, slot) => {
      const classes = classesOf(slotTag(renderWithIntl(<Part />), slot));

      expect(classes).toContain("px-5");
      expect(classes).not.toContain("px-6");
    },
  );

  it("pads a rule between two parts by the gap, so that it sits midway", () => {
    const header = slotTag(renderWithIntl(<CardHeader />), "card-header");
    const footer = slotTag(renderWithIntl(<CardFooter />), "card-footer");

    expect(classesOf(header)).toContain("[.border-b]:pb-4");
    expect(classesOf(footer)).toContain("[.border-t]:pt-4");
  });

  describe("its title", () => {
    it("is a div unless it is told otherwise", () => {
      const html = renderWithIntl(<CardTitle>Profile</CardTitle>);

      expect(html).toContain('<div data-slot="card-title"');
      expect(html).toContain(">Profile</div>");
    });

    it("renders a heading when asked", () => {
      const html = renderWithIntl(<CardTitle as="h2">Profile</CardTitle>);

      expect(html).toContain('<h2 data-slot="card-title"');
      expect(html).toContain(">Profile</h2>");
    });

    it.each(["h2", "h3"] as const)(
      "looks the same as a %s as it does as a div: the tag says the structure, never the size",
      (tag) => {
        const classesFor = (as: "div" | "h2" | "h3") =>
          classesOf(
            slotTag(
              renderWithIntl(<CardTitle as={as}>Profile</CardTitle>),
              "card-title",
            ),
          );

        expect(classesFor(tag)).toEqual(classesFor("div"));
        expect(classesFor(tag)).toEqual(
          expect.arrayContaining(["leading-none", "font-semibold"]),
        );
      },
    );

    it("keeps the attributes and the class of the caller, whatever the tag", () => {
      const tag = slotTag(
        renderWithIntl(
          <CardTitle as="h3" id="plan-title" className="text-section">
            Plan
          </CardTitle>,
        ),
        "card-title",
      );

      expect(attribute(tag, "id")).toBe("plan-title");
      expect(classesOf(tag)).toContain("text-section");
    });

    it("takes a heading of level 2 or 3 only: the one h1 of a page is the header's", () => {
      type Title = ComponentProps<typeof CardTitle>;

      expectTypeOf<Accepts<Title, { as: "h2" }>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<Title, { as: "h3" }>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<Title, { as: "h1" }>>().toEqualTypeOf<false>();
    });
  });
});

describe("icon tile", () => {
  // What a test of a tile changes: its tone, its size and its class.
  function tile(props: Pick<IconTileProps, "tone" | "size" | "className"> = {}) {
    return slotTag(
      renderWithIntl(<IconTile icon={UsersIcon} {...props} />),
      "icon-tile",
    );
  }

  it("draws the tone tiles", () => {
    const classes = classesOf(tile({ tone: "t3" }));

    expect(classes).toContain("bg-tone-3");
    expect(classes).toContain("text-tone-3-ink");
  });

  it.each([
    ["t1", 1],
    ["t2", 2],
    ["t3", 3],
    ["t4", 4],
  ] as const)(
    "reads tone %s on the tokens of the number %s",
    (tone, n) => {
      const classes = classesOf(tile({ tone }));

      expect(classes).toContain(`bg-tone-${n}`);
      expect(classes).toContain(`text-tone-${n}-ink`);
    },
  );

  it("names the numbered tones t1 to t4, so that a tone of the shell, written t then its number, is one of them", () => {
    const fromNumber = (n: 1 | 2 | 3 | 4) => tile({ tone: `t${n}` });

    expect(classesOf(fromNumber(4))).toContain("bg-tone-4");
    // A bare number is no tone any more: it reads `t3`
    expectTypeOf<Accepts<IconTileProps, { icon: typeof UsersIcon; tone: "t3" }>>().toEqualTypeOf<true>();
    expectTypeOf<Accepts<IconTileProps, { icon: typeof UsersIcon; tone: 3 }>>().toEqualTypeOf<false>();
  });

  it.each([
    ["brand", ["bg-brand-tint", "text-brand-tint-ink"]],
    ["neutral", ["bg-secondary", "text-ink-soft"]],
    ["success", ["bg-success-bg", "text-success-text"]],
    ["warning", ["bg-warning-bg", "text-warning-text"]],
    ["danger", ["text-danger-text"]],
  ] as const)("tints %s with its tone tokens", (tone, expected) => {
    expect(classesOf(tile({ tone }))).toEqual(
      expect.arrayContaining([...expected]),
    );
  });

  it("tints danger with the danger color over the surface, as there is no danger background token", () => {
    const [background] = backgrounds(classesOf(tile({ tone: "danger" })));

    expect(background).toBe(
      "bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))]",
    );
  });

  it.each([
    "t1",
    "t2",
    "t3",
    "t4",
    "brand",
    "neutral",
    "success",
    "warning",
    "danger",
  ] as const)("gives tone %s one background, and one ink", (tone) => {
    const classes = classesOf(tile({ tone }));

    expect(backgrounds(classes)).toHaveLength(1);
    expect(classes.filter((name) => name.startsWith("text-"))).toHaveLength(1);
  });

  it("is a brand tile of 40 px unless it is told otherwise", () => {
    expect(classesOf(tile())).toEqual(
      expect.arrayContaining([
        "bg-brand-tint",
        "text-brand-tint-ink",
        "size-10",
      ]),
    );
  });

  it.each([
    ["sm", "size-8", "rounded-sm"],
    ["md", "size-10", "rounded-md"],
    ["lg", "size-14", "rounded-lg"],
  ] as const)("makes the %s tile %s, with a %s corner", (size, box, corner) => {
    expect(classesOf(tile({ size }))).toEqual(
      expect.arrayContaining([box, corner]),
    );
  });

  it("centers the icon and never shrinks beside a long label", () => {
    expect(classesOf(tile())).toEqual(
      expect.arrayContaining([
        "inline-flex",
        "items-center",
        "justify-center",
        "shrink-0",
      ]),
    );
  });

  it.each([
    ["sm", "size-4.5"],
    ["md", "size-5"],
    ["lg", "size-6.5"],
  ] as const)("sizes the icon of the %s tile %s", (size, icon) => {
    const [svg] = startTags(
      renderWithIntl(<IconTile icon={UsersIcon} size={size} />),
      "svg",
    );

    expect(classesOf(svg)).toContain(icon);
  });

  it("hides the icon from assistive technology", () => {
    const svg = startTags(renderWithIntl(<IconTile icon={UsersIcon} />), "svg");

    expect(svg).toHaveLength(1);
    expect(attribute(svg[0], "aria-hidden")).toBe("true");
  });

  it("lets a caller's class win", () => {
    const classes = classesOf(tile({ className: "size-12" }));

    expect(classes).toContain("size-12");
    expect(classes).not.toContain("size-10");
  });

  // The shell hands its icons over already drawn (a quota's, a first step's):
  // a component cannot cross from the server to the client, and a drawn icon can.
  describe("with an icon that is already drawn", () => {
    const drawn = <svg data-icon="folder" aria-hidden="true" />;

    it("draws it in the tile, in the tone it is given, and draws no other icon", () => {
      const html = renderWithIntl(<IconTile tone="t2">{drawn}</IconTile>);
      const classes = classesOf(slotTag(html, "icon-tile"));

      expect(classes).toEqual(expect.arrayContaining(["bg-tone-2", "text-tone-2-ink", "size-10", "rounded-md"]));
      expect(startTags(html, "svg")).toHaveLength(1);
      expect(html).toMatch(/data-slot="icon-tile"[^>]*><svg data-icon="folder" aria-hidden="true"/);
    });

    it.each([
      ["sm", "[&>svg]:size-4.5"],
      ["md", "[&>svg]:size-5"],
      ["lg", "[&>svg]:size-6.5"],
    ] as const)("sizes the icon of the %s tile from the tile, as it sizes one it draws itself", (size, rule) => {
      const classes = decodedClassesOf(slotTag(renderWithIntl(<IconTile size={size}>{drawn}</IconTile>), "icon-tile"));

      expect(classes).toContain(rule);
    });

    it("leaves a tile that draws its own icon without that rule", () => {
      expect(decodedClassesOf(tile())).not.toContain("[&>svg]:size-5");
    });

    it("hides the whole tile from assistive technology: it is decoration, and the shell's icon is the caller's", () => {
      const html = renderWithIntl(<IconTile>{<svg data-icon="folder" />}</IconTile>);

      // Even an icon that did not hide itself
      expect(attribute(slotTag(html, "icon-tile"), "aria-hidden")).toBe("true");
    });

    it("leaves the tile of an icon it draws itself to hide the icon alone, as before", () => {
      expect(attribute(tile(), "aria-hidden")).toBeUndefined();
    });

    it("takes an icon or a drawn one: both, or neither, is refused by the type", () => {
      expectTypeOf<Accepts<IconTileProps, { icon: typeof UsersIcon }>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<IconTileProps, { children: ReactNode }>>().toEqualTypeOf<true>();
      // Both: one of the two would be dropped without a word
      expectTypeOf<Accepts<IconTileProps, { icon: typeof UsersIcon; children: ReactNode }>>().toEqualTypeOf<false>();
      // Neither: an empty tile
      expectTypeOf<Accepts<IconTileProps, object>>().toEqualTypeOf<false>();
    });
  });
});

describe("list", () => {
  const render = (node?: ReactNode) =>
    renderWithIntl(<List>{node}</List>);

  it("is a list of rows, each one an item", () => {
    const html = render(
      <>
        <ListRow title="First" />
        <ListRow title="Second" />
      </>,
    );

    expect(startTags(html, "ul")).toHaveLength(1);
    expect(startTags(html, "li")).toHaveLength(2);
  });

  it("keeps its list role, which Safari drops from a list with no bullets", () => {
    expect(attribute(startTags(render(), "ul")[0], "role")).toBe("list");
  });

  it("divides the rows with a hairline", () => {
    expect(classesOf(startTags(render(), "ul")[0])).toEqual(
      expect.arrayContaining(["divide-y", "divide-hairline"]),
    );
  });

  it("lets a caller's class win", () => {
    const classes = classesOf(
      startTags(renderWithIntl(<List className="divide-ink-muted" />), "ul")[0],
    );

    expect(classes).toContain("divide-ink-muted");
    expect(classes).not.toContain("divide-hairline");
  });

  describe("when the order of the rows matters (as=\"ol\")", () => {
    const ordered = (props: { className?: string } = {}) =>
      renderWithIntl(
        <List as="ol" {...props}>
          <ListRow title="First" />
          <ListRow title="Second" />
        </List>,
      );

    it("is an ordered list of the same rows, and no unordered one", () => {
      const html = ordered();

      expect(startTags(html, "ol")).toHaveLength(1);
      expect(startTags(html, "ul")).toHaveLength(0);
      expect(startTags(html, "li")).toHaveLength(2);
      expect(html).toContain('data-slot="list"');
    });

    it("keeps the role and the hairlines of the list, so that the two cannot drift apart", () => {
      const [list = ""] = startTags(ordered(), "ol");

      expect(attribute(list, "role")).toBe("list");
      expect(classesOf(list)).toEqual(expect.arrayContaining(["divide-y", "divide-hairline"]));
    });

    it("lets a caller's class win, as the unordered one does", () => {
      const [list = ""] = startTags(ordered({ className: "divide-ink-muted" }), "ol");

      expect(classesOf(list)).toContain("divide-ink-muted");
      expect(classesOf(list)).not.toContain("divide-hairline");
    });

    it("stays a ul when it is not told otherwise, or told so", () => {
      expect(startTags(renderWithIntl(<List as="ul" />), "ul")).toHaveLength(1);
      expect(startTags(render(), "ol")).toHaveLength(0);
    });
  });
});

describe("list row", () => {
  const TITLE = "Léa Martin joined the team";
  const render = (props: Partial<ComponentProps<typeof ListRow>> = {}) =>
    renderWithIntl(
      <List>
        <ListRow title={TITLE} {...props} />
      </List>,
    );

  it("is a link over its whole surface when it has an href", () => {
    const html = render({
      href: "/x",
      leading: <IconTile icon={UsersIcon} size="sm" />,
      meta: "Studio Nord",
      trailing: "1 h ago",
    });

    expect(html).toContain('<a href="/x"');

    const link = innerHtml(html, "a");
    expect(link).toContain(TITLE);
    expect(link).toContain("Studio Nord");
    expect(link).toContain("1 h ago");
    expect(link).toContain('data-slot="icon-tile"');
  });

  it("is plain content with no href", () => {
    const html = render({ meta: "Studio Nord", trailing: "1 h ago" });

    expect(startTags(html, "a")).toHaveLength(0);
    expect(html).toContain(TITLE);
  });

  it("keeps the link inside the item, which is the child of the list", () => {
    expect(render({ href: "/x" })).toMatch(/<ul[^>]*><li[^>]*><a /);
  });

  it.each([
    ["a link", { href: "/x" }, "a"],
    ["a plain row", {}, "div"],
  ] as const)(
    "makes %s 56 px high at least, above the 44 px of a target",
    (_name, props, element) => {
      const [row] = startTags(render(props), element);

      expect(classesOf(row)).toEqual(
        expect.arrayContaining(["min-h-14", "items-center"]),
      );
    },
  );

  it("shows the focus ring of the system on a link, and lights it on hover", () => {
    expect(classesOf(startTags(render({ href: "/x" }), "a")[0])).toEqual(
      expect.arrayContaining([
        "focus-visible:focus-ring",
        "hover:bg-accent",
        "rounded-md",
      ]),
    );
  });

  it("reaches 12 px beyond its list on each side, so that the highlight has room and the text stays aligned", () => {
    expect(classesOf(startTags(render({ href: "/x" }), "a")[0])).toEqual(
      expect.arrayContaining(["-mx-3", "px-3"]),
    );
  });

  it("does not light a row that is not a link", () => {
    expect(render({ trailing: "1 h ago" })).not.toContain("hover:bg-accent");
  });

  it("writes the title in ink and the meta below it in muted ink", () => {
    const html = render({ meta: "Studio Nord" });

    expect(classesOfText(html, TITLE)).toContain("text-ink");
    expect(classesOfText(html, "Studio Nord")).toEqual(
      expect.arrayContaining(["text-meta", "text-ink-muted"]),
    );
  });

  it("draws no empty slot", () => {
    const html = render();

    expect(html).not.toContain("text-meta");
    expect(html).not.toContain("shrink-0");
  });

  it("puts the leading slot first and the trailing one last, never shrunk", () => {
    const html = render({
      leading: <span>lead</span>,
      meta: "meta",
      trailing: <span>trail</span>,
    });

    expect(html.indexOf("lead")).toBeLessThan(html.indexOf("Léa Martin"));
    expect(html.indexOf("Léa Martin")).toBeLessThan(html.indexOf("meta"));
    expect(html.indexOf("meta")).toBeLessThan(html.indexOf("trail"));
    expect(html).toMatch(/class="[^"]*\bshrink-0\b[^"]*"><span>lead</);
    expect(html).toMatch(/class="[^"]*\bshrink-0\b[^"]*"><span>trail</);
  });

  it("lets a long title wrap, so that nothing is cut in French", () => {
    const classes = classesOfText(render(), TITLE);

    expect(classes).toContain("wrap-break-word");
    expect(render()).toMatch(/class="[^"]*\bmin-w-0\b[^"]*"/);
  });

  it("puts a caller's class and attributes on the item", () => {
    const item = startTags(render({ className: "py-1", id: "row-1" }), "li")[0];

    expect(classesOf(item)).toContain("py-1");
    expect(attribute(item, "id")).toBe("row-1");
  });
});

describe("stat card", () => {
  const render = (props: Partial<ComponentProps<typeof StatCard>> = {}) =>
    renderWithIntl(
      <StatCard title="Members" value={1234} icon={UsersIcon} {...props} />,
    );

  it("colors a positive trend with the success text, with no raw palette color", () => {
    const html = render({ trend: { value: 12, positive: true } });

    expect(html).toContain("text-success-text");
    expect(html).not.toContain("green-");
    expect(html).not.toContain("red-");
  });

  it("writes the trend with its sign, so that the color is never the only sign", () => {
    expect(render({ trend: { value: 12, positive: true } })).toContain("+12%");
  });

  it("colors a negative trend with the danger text", () => {
    const html = render({ trend: { value: -4, positive: false } });

    expect(html).toContain("text-danger-text");
    expect(html).toContain("\u22124%");
    expect(html).not.toContain("text-success-text");
    expect(html).not.toContain("green-");
    expect(html).not.toContain("red-");
  });

  // The sign says which way the figure went, the color says whether that is
  // good: a rise in churn is "+5%" in the danger color.
  it.each([
    [{ value: 5, positive: true }, "+5%", "text-success-text", "text-danger-text"],
    [{ value: 5, positive: false }, "+5%", "text-danger-text", "text-success-text"],
    [{ value: -5, positive: true }, "\u22125%", "text-success-text", "text-danger-text"],
    [{ value: -5, positive: false }, "\u22125%", "text-danger-text", "text-success-text"],
  ])(
    "reads a trend of %j as %s, in %s",
    (trend, text, color, otherColor) => {
      const classes = classesOfText(render({ trend }), text);

      expect(classes).toContain(color);
      expect(classes).not.toContain(otherColor);
    },
  );

  it("writes a fall with a true minus sign, not a hyphen", () => {
    const html = render({ trend: { value: -5, positive: false } });

    expect(html).toContain(">\u22125%<");
    expect(html).not.toContain("-5%");
  });

  it("writes no sign for no change", () => {
    const html = render({ trend: { value: 0, positive: true } });

    expect(html).toContain(">0%<");
    expect(html).not.toContain("+0%");
    expect(html).not.toContain("\u22120%");
  });

  it("writes the trend in tabular figures, as the value above it", () => {
    expect(
      classesOfText(render({ trend: { value: 12, positive: true } }), "+12%"),
    ).toEqual(expect.arrayContaining(["text-meta", "font-medium", "tabular-nums"]));
  });

  it("draws no trend without one", () => {
    const html = render();

    expect(html).not.toContain("%");
    expect(html).not.toContain("text-success-text");
    expect(html).not.toContain("text-danger-text");
  });

  it("writes the value in a monospace face with tabular figures", () => {
    expect(classesOfText(render({ value: "$1,234.00" }), "$1,234.00")).toEqual(
      expect.arrayContaining(["font-mono", "tabular-nums", "text-panel"]),
    );
  });

  it("writes the title in muted ink", () => {
    expect(classesOfText(render(), "Members")).toEqual(
      expect.arrayContaining(["text-meta", "text-ink-muted"]),
    );
  });

  it("puts the icon in a tinted tile, hidden from assistive technology", () => {
    const html = render();
    const svg = startTags(html, "svg");

    expect(html).toContain('data-slot="icon-tile"');
    expect(svg).toHaveLength(1);
    expect(attribute(svg[0], "aria-hidden")).toBe("true");
    expect(html).not.toContain("bg-muted");
  });

  it("keeps the tile at the top, with or without a trend, so that a row of cards lines up", () => {
    for (const trend of [undefined, { value: 12, positive: true }]) {
      const classes = classesOf(slotTag(render({ trend }), "card-content"));

      expect(classes).toEqual(
        expect.arrayContaining(["flex", "items-start", "justify-between"]),
      );
      expect(classes).not.toContain("items-center");
    }
  });

  it("is a card, and lets a caller's class win over its own", () => {
    const classes = classesOf(slotTag(render({ className: "py-3" }), "card"));

    expect(classes).toEqual(
      expect.arrayContaining(["rounded-lg", "border-hairline", "py-3"]),
    );
    expect(classes).not.toContain("py-5");
  });

  it("keeps its old props: a text for a value, and no trend", () => {
    expect(render({ value: "Pro" })).toContain(">Pro<");
  });
});

// The primitive the data table is built on, and the one the admin tables that
// do not need a search or pages use directly (the waitlist). Everything below is
// a class: a static render cannot measure a row, so the 48 px is the class that
// sets it, and tests/unit/admin/ reads the pages for the rest.
describe("table", () => {
  const render = () =>
    renderWithIntl(
      <Table>
        <TableCaption>Two people</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Projects</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice Martin</TableCell>
            <TableCell>12</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Bob Johnson</TableCell>
            <TableCell>3</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>15</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

  it("draws table headers in the meta style: 13 px, muted ink, medium weight", () => {
    const heads = startTags(render(), "th");

    expect(heads).toHaveLength(2);
    for (const head of heads) {
      expect(classesOf(head)).toEqual(
        expect.arrayContaining(["text-meta", "text-ink-muted", "font-medium"]),
      );
      expect(classesOf(head)).not.toContain("text-muted-foreground");
    }
  });

  it("sets every row 48 px high at least, divided from the next by a hairline", () => {
    const rows = startTags(render(), "tr");

    // The header row, two rows of data and the footer's
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(classesOf(row)).toEqual(
        expect.arrayContaining(["h-12", "border-b", "border-hairline"]),
      );
    }
  });

  it("draws no stripes: no row, and no cell, has a background of its own to alternate", () => {
    const html = render();

    for (const tag of [
      ...startTags(html, "tr"),
      ...startTags(html, "td"),
      ...startTags(html, "tbody"),
    ]) {
      expect(decodedClassesOf(tag).filter((name) => /^(?:even|odd|nth-)/.test(name))).toEqual([]);
    }
  });

  it("lights a row on hover with the accent, and leaves the rows of the header alone", () => {
    const html = render();

    for (const row of startTags(html, "tr")) {
      expect(classesOf(row)).toContain("hover:bg-accent");
      expect(classesOf(row)).not.toContain("hover:bg-muted/50");
    }
    // A header is not something to point at: its rows take no highlight
    expect(decodedClassesOf(slotTag(html, "table-header"))).toContain(
      "[&_tr]:hover:bg-transparent",
    );
  });

  it("sets figures in tabular numbers, so that a column of them lines up", () => {
    expect(classesOf(slotTag(render(), "table"))).toContain("tabular-nums");
  });

  it("sets the text at 14 px, with room round it, and keeps a cell on one line", () => {
    const html = render();

    expect(classesOf(slotTag(html, "table"))).toContain("text-body");
    for (const cell of startTags(html, "td")) {
      expect(classesOf(cell)).toEqual(
        expect.arrayContaining(["px-4", "py-3", "align-middle", "whitespace-nowrap"]),
      );
    }
    for (const head of startTags(html, "th")) {
      expect(classesOf(head)).toEqual(
        expect.arrayContaining(["px-4", "whitespace-nowrap"]),
      );
    }
  });

  it("scrolls sideways inside its own box: a wide table never widens the page", () => {
    const html = render();

    expect(classesOf(slotTag(html, "table-container"))).toEqual(
      expect.arrayContaining(["w-full", "max-w-full", "overflow-x-auto"]),
    );
    // The table keeps the width of its columns: the box is what scrolls
    expect(classesOf(slotTag(html, "table"))).toContain("w-full");
  });

  it("writes the caption in muted 13 px text", () => {
    expect(classesOfText(render(), "Two people")).toEqual(
      expect.arrayContaining(["text-meta", "text-ink-muted"]),
    );
  });

  // A table that holds a control (a sort button, an action in a row) lets the
  // keyboard scroll the box: the control takes the focus, and the box moves to
  // it. One that can hold none has nothing to focus, and the box that scrolls
  // is unreachable (axe: scrollable-region-focusable), so it is named, and it
  // becomes a region a tab reaches.
  it("leaves its box a plain div while it is not named, so that a table of controls takes no extra stop", () => {
    const box = slotTag(render(), "table-container");

    expect(attribute(box, "role")).toBeUndefined();
    expect(attribute(box, "tabindex")).toBeUndefined();
    expect(attribute(box, "aria-labelledby")).toBeUndefined();
  });

  it("makes its box a region the keyboard reaches, named by the title of the table, once it is given that title", () => {
    const html = renderWithIntl(
      <Table scrollLabelledBy="people-title">
        <TableBody>
          <TableRow>
            <TableCell>Alice Martin</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const box = slotTag(html, "table-container");

    expect(attribute(box, "role")).toBe("region");
    expect(attribute(box, "aria-labelledby")).toBe("people-title");
    expect(attribute(box, "tabindex")).toBe("0");
    // The table itself is not renamed by it, and takes no stop of its own
    expect(attribute(slotTag(html, "table"), "aria-labelledby")).toBeUndefined();
    expect(attribute(slotTag(html, "table"), "tabindex")).toBeUndefined();
  });
});

interface Person {
  name: string;
  projects: number;
  status: string;
  [key: string]: unknown;
}

const people: Person[] = [
  { name: "Alice Martin", projects: 12, status: "Active" },
  { name: "Bob Johnson", projects: 3, status: "Inactive" },
  { name: "Charlie Brown", projects: 7, status: "Active" },
];

const columns: Column<Person>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "projects", header: "Projects", sortable: true },
  { key: "status", header: "Status" },
];

describe("data table", () => {
  const render = (
    props: Partial<ComponentProps<typeof DataTable<Person>>> = {},
    locale: "en" | "fr" = "en",
  ) =>
    renderWithIntl(
      <DataTable columns={columns} data={people} {...props} />,
      locale,
    );

  /** The pagination buttons: the only ones that carry a label of their own. */
  const pagers = (html: string) =>
    startTags(html, "button").filter((tag) => attribute(tag, "aria-label"));

  const selectTrigger = (html: string) =>
    startTags(html, "button").find(
      (tag) => attribute(tag, "role") === "combobox",
    ) ?? "";

  it("keeps its props: columns, data, search, page size and class", () => {
    const html = render({
      searchKey: "name",
      searchPlaceholder: "Find a person",
      pageSize: 2,
      className: "mt-8",
    });

    expect(classesOf(slotTag(html, "data-table"))).toContain("mt-8");
    expect(html).toContain('placeholder="Find a person"');
    expect(startTags(html, "tr")).toHaveLength(1 + 2);
  });

  // The look of a table (the text, the headers, the rows, their rules and their
  // highlight) is the primitive's, pinned once by the table block above: this
  // table is made of the primitive and adds only what is its own.
  it("is built on the table primitive, so that the look of a table has one source", () => {
    const html = render();

    expect(startTags(html, "th")).toHaveLength(columns.length);
    expect(html).toContain('data-slot="table-container"');
    for (const [tag, slot] of [
      ["table", "table"],
      ["th", "table-head"],
      ["tr", "table-row"],
      ["td", "table-cell"],
    ] as const) {
      for (const start of startTags(html, tag)) {
        expect(attribute(start, "data-slot"), tag).toBe(slot);
      }
    }
  });

  it("exposes the sort state on each sortable header, as the arrows are hidden from assistive technology", () => {
    const [name, projects, status] = startTags(render(), "th");

    expect(attribute(name, "aria-sort")).toBe("none");
    expect(attribute(projects, "aria-sort")).toBe("none");
    // A column that cannot be sorted has no sort state to expose.
    expect(attribute(status, "aria-sort")).toBeUndefined();
  });

  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
    [null, "none"],
  ] as const)("says %s as aria-sort=%s", (direction, expected) => {
    expect(ariaSort(direction)).toBe(expected);
  });

  it("sits in a card-radius surface with a hairline border", () => {
    expect(classesOf(slotTag(render(), "data-table-surface"))).toEqual(
      expect.arrayContaining([
        "rounded-lg",
        "border",
        "border-hairline",
        "bg-card",
        "shadow-card",
      ]),
    );
  });

  // The figures are tabular because the table is (pinned in the block of the
  // primitive): what is the data table's own is the monospace face of a number.
  it("writes a number in a monospace face, and a word in the text face", () => {
    const html = render();
    const [name, projects, status] = startTags(html, "td");

    expect(classesOf(projects)).toContain("font-mono");
    expect(classesOf(name)).not.toContain("font-mono");
    expect(classesOf(status)).not.toContain("font-mono");
    expect(classesOf(slotTag(html, "table"))).toContain("tabular-nums");
  });

  it("makes a sort button a 44 px target with the focus ring, and hides its arrow", () => {
    const html = render();
    const sorts = startTags(html, "button").filter(
      (tag) => !attribute(tag, "aria-label") && !attribute(tag, "role"),
    );

    expect(sorts).toHaveLength(2);
    for (const sort of sorts) {
      expect(attribute(sort, "type")).toBe("button");
      expect(classesOf(sort)).toEqual(
        expect.arrayContaining([
          "tap-target",
          "focus-visible:focus-ring",
          "hover:text-ink",
        ]),
      );
    }
    for (const svg of startTags(html, "svg")) {
      expect(attribute(svg, "aria-hidden")).toBe("true");
    }
  });

  it("names the pagination buttons, in the language of the page", () => {
    const labels = (html: string) =>
      pagers(html).map((tag) => attribute(tag, "aria-label"));

    expect(labels(render())).toEqual([
      "First page",
      "Previous page",
      "Next page",
      "Last page",
    ]);
    expect(labels(render({}, "fr"))).toEqual([
      "Première page",
      "Page précédente",
      "Page suivante",
      "Dernière page",
    ]);
  });

  it("sets the pagination buttons 44 px apart, so that their targets touch and do not overlap", () => {
    const html = render();

    // 36 px of button, then 8 px of gap: the 44 px targets abut.
    for (const button of pagers(html)) {
      expect(classesOf(button)).toContain("size-9");
      expect(classesOf(button)).not.toContain("size-8");
    }
    expect(classesOf(slotTag(html, "data-table-pages"))).toContain("gap-2");
  });

  it("disables the buttons that go back, on the first page", () => {
    const disabled = pagers(render({ pageSize: 2 })).map((tag) =>
      attribute(tag, "disabled"),
    );

    expect(disabled).toEqual(["", "", undefined, undefined]);
  });

  it("counts the pages in figures that keep their width", () => {
    expect(classesOfText(render({ pageSize: 2 }), "1 / 2")).toEqual(
      expect.arrayContaining(["font-mono", "tabular-nums"]),
    );
  });

  it("writes the result count in tabular figures, so that it does not jump as the search narrows", () => {
    expect(classesOfText(render(), "3 results")).toEqual(
      expect.arrayContaining(["text-meta", "text-ink-muted", "tabular-nums"]),
    );
  });

  it("counts the results, with the plural of the language of the page", () => {
    expect(render()).toContain(">3 results<");
    expect(render({ data: people.slice(0, 1) })).toContain(">1 result<");
    expect(render({ data: [] })).toContain(">0 results<");
    expect(render({}, "fr")).toContain(">3 résultats<");
    expect(render({ data: people.slice(0, 1) }, "fr")).toContain(">1 résultat<");
    expect(render({ data: [] }, "fr")).toContain(">0 résultat<");
  });

  it("says there is nothing to show, in muted text and with no highlight", () => {
    const html = render({ data: [] });
    const [, empty] = startTags(html, "tr");
    const [cell] = startTags(html, "td");

    expect(html).toContain(">No results found<");
    expect(classesOf(empty)).toContain("hover:bg-transparent");
    expect(classesOf(cell)).toEqual(
      expect.arrayContaining(["text-center", "text-ink-muted"]),
    );
    expect(classesOf(cell)).not.toContain("text-muted-foreground");
    expect(render({ data: [] }, "fr")).toContain(">Aucun résultat trouvé<");
  });

  // A line the caller writes, in the card, above the table: what the rows are
  // not (the newest 100 of more, the latest 50 of a log with no end), so that a
  // search that finds nothing is not taken for a list with nothing in it.
  it("holds a note in its card, above the table, and describes the table by it", () => {
    const html = render({ note: "This list shows the 3 newest people out of 12." });
    const note = slotTag(html, "data-table-note");

    expect(note).toContain("<p");
    expect(classesOf(note)).toEqual(
      expect.arrayContaining(["border-b", "border-hairline", "px-4", "text-meta", "text-ink-muted"]),
    );
    expect(textOf(html)).toContain("This list shows the 3 newest people out of 12.");
    // In the surface, before the table that it speaks of
    expect(html.indexOf('data-slot="data-table-surface"')).toBeLessThan(html.indexOf('data-slot="data-table-note"'));
    expect(html.indexOf('data-slot="data-table-note"')).toBeLessThan(html.indexOf("<table"));
    expect(attribute(note, "id")).toBeTruthy();
    expect(attribute(slotTag(html, "table"), "aria-describedby")).toBe(attribute(note, "id"));
  });

  it("holds no note, and describes its table by nothing, unless it is given one", () => {
    const html = render();

    expect(html).not.toContain('data-slot="data-table-note"');
    expect(attribute(slotTag(html, "table"), "aria-describedby")).toBeUndefined();
  });

  it("asks for a search in the language of the page, unless the caller words it", () => {
    // With the real ellipsis (U+2026), not three full stops.
    expect(render({ searchKey: "name" })).toContain('placeholder="Search\u2026"');
    expect(render({ searchKey: "name" }, "fr")).toContain(
      'placeholder="Rechercher\u2026"',
    );
    expect(
      render({ searchKey: "name", searchPlaceholder: "Find" }),
    ).toContain('placeholder="Find"');
  });

  it("names the search field with its placeholder", () => {
    const [input] = startTags(
      render({ searchKey: "name", searchPlaceholder: "Find a person" }),
      "input",
    );

    expect(attribute(input, "aria-label")).toBe("Find a person");
  });

  it("draws no search field without a search key", () => {
    expect(startTags(render(), "input")).toHaveLength(0);
  });

  it.each([
    ["en", "Rows"],
    ["fr", "Lignes"],
  ] as const)(
    "names the page-size select with the words next to it, in %s",
    (locale, label) => {
      const html = render({}, locale);
      const id = attribute(tagBefore(html, label), "id");

      expect(id).toBeTruthy();
      expect(attribute(selectTrigger(html), "aria-labelledby")).toBe(id);
    },
  );

  it.each([
    [undefined, ">10<"],
    [5, ">5<"],
    [25, ">25<"],
  ])(
    "shows the page size in the select when the server draws it, as the list of choices only fills in once mounted (%s)",
    (pageSize, shown) => {
      const html = render({ pageSize });

      expect(html).toMatch(new RegExp(`data-slot="select-value"[^>]*${shown}`));
    },
  );

  it("makes the page-size select a 36 px control with a 44 px target", () => {
    const classes = classesOf(selectTrigger(render()));

    expect(classes).toEqual(expect.arrayContaining(["h-9", "tap-target"]));
    expect(classes).not.toContain("h-8");
  });

  // Padding, gap and chevron leave 14 px of a 64 px select to the figure: "100"
  // was cut at 13 px, and so was "10" at 16 px, the size under 768 px.
  it("gives the page-size select room for three figures: an 80 px floor, and no fixed width to clip them", () => {
    const classes = classesOf(selectTrigger(render()));

    expect(classes).toContain("min-w-20");
    expect(classes).not.toContain("w-16");
    // It keeps the width of its content, so that a size of four figures fits too.
    expect(classes.filter((name) => name.startsWith("w-"))).toEqual(["w-fit"]);
  });

  it("wraps the footer instead of overflowing a narrow screen", () => {
    expect(classesOf(slotTag(render(), "data-table-footer"))).toContain(
      "flex-wrap",
    );
  });
});

describe("data table sort", () => {
  interface Row {
    id: string;
    value: unknown;
    [key: string]: unknown;
  }
  const row = (id: string, value: unknown): Row => ({ id, value });
  const ids = (rows: Row[]) => rows.map((entry) => entry.id);

  // The weekday of these dates runs against their order: Wednesday the 4th,
  // Thursday the 5th and Friday the 6th of November read Fri, Thu, Wed as text.
  it("sorts a column of dates by the time, both ways, and not by the text of the date", () => {
    const rows = [
      row("thu", new Date("2026-11-05T09:00:00Z")),
      row("wed", new Date("2026-11-04T09:00:00Z")),
      row("fri", new Date("2026-11-06T09:00:00Z")),
      row("jan", new Date("2026-01-23T09:00:00Z")),
    ];

    expect(ids(sortRows(rows, "value", "asc"))).toEqual(["jan", "wed", "thu", "fri"]);
    expect(ids(sortRows(rows, "value", "desc"))).toEqual(["fri", "thu", "wed", "jan"]);
  });

  // As text, -10 would come after -5 and 2.25 after 2.5
  it("sorts a column of numbers by value, negatives and decimals included", () => {
    const rows = [row("a", 2.5), row("b", -10), row("c", 2.25), row("d", -5), row("e", 0)];

    expect(ids(sortRows(rows, "value", "asc"))).toEqual(["b", "d", "e", "c", "a"]);
    expect(ids(sortRows(rows, "value", "desc"))).toEqual(["a", "c", "e", "d", "b"]);
  });

  it("sorts text with its numbers read as numbers: item 2 comes before item 10", () => {
    const rows = [row("ten", "item 10"), row("two", "item 2"), row("one", "item 1")];

    expect(ids(sortRows(rows, "value", "asc"))).toEqual(["one", "two", "ten"]);
    expect(ids(sortRows(rows, "value", "desc"))).toEqual(["ten", "two", "one"]);
  });

  it("puts a row with no value last, whichever way the column is sorted", () => {
    const rows = [
      row("none", null),
      row("b", "banana"),
      row("blank", ""),
      row("a", "apple"),
      row("missing", undefined),
      row("bad", new Date("not a date")),
    ];

    expect(ids(sortRows(rows, "value", "asc"))).toEqual(["a", "b", "none", "blank", "missing", "bad"]);
    expect(ids(sortRows(rows, "value", "desc"))).toEqual(["b", "a", "none", "blank", "missing", "bad"]);
  });

  it("puts a row with no date last among dates, and a row with no number last among numbers", () => {
    const dates = [row("none", null), row("late", new Date("2026-11-04")), row("early", new Date("2026-01-01"))];
    const numbers = [row("none", undefined), row("big", 9), row("small", 1)];

    expect(ids(sortRows(dates, "value", "desc"))).toEqual(["late", "early", "none"]);
    expect(ids(sortRows(numbers, "value", "asc"))).toEqual(["small", "big", "none"]);
  });

  it("keeps equal rows in the order they came in, whichever way the column is sorted, and leaves its input alone", () => {
    const rows = [row("x1", 1), row("x2", 1), row("x3", 1)];

    expect(ids(sortRows(rows, "value", "asc"))).toEqual(["x1", "x2", "x3"]);
    expect(ids(sortRows(rows, "value", "desc"))).toEqual(["x1", "x2", "x3"]);
    expect(ids(rows)).toEqual(["x1", "x2", "x3"]);
  });
});

describe("container strings", () => {
  const KEYS = [
    "searchPlaceholder",
    "results",
    "rows",
    "firstPage",
    "previousPage",
    "nextPage",
    "lastPage",
  ] as const;

  it.each(KEYS)(
    "has table.%s in both languages, translated rather than copied",
    (key) => {
      expect(en.common.table[key].length).toBeGreaterThan(0);
      expect(fr.common.table[key].length).toBeGreaterThan(0);
      expect(fr.common.table[key]).not.toBe(en.common.table[key]);
    },
  );
});

describe("container sources", () => {
  const FILES = [
    "ui/card.tsx",
    "ui/icon-tile.tsx",
    "ui/list.tsx",
    "ui/table.tsx",
    "data/stat-card.tsx",
    "data/data-table.tsx",
  ].map((file) => `shared/components/${file}`);
  const STORIES = [
    "ui/card.stories.tsx",
    "ui/icon-tile.stories.tsx",
    "ui/list.stories.tsx",
    "data/stat-card.stories.tsx",
    "data/data-table.stories.tsx",
  ].map((file) => `shared/components/${file}`);

  const read = (file: string) => readFileSync(resolve(srcDir, file), "utf-8");

  it.each([...FILES, ...STORIES])(
    "%s uses the theme tokens: no raw palette color, white, black or hex",
    (file) => {
      const source = read(file);

      expect(source).not.toMatch(
        /\b(?:bg|text|border|ring|fill|stroke|from|to|shadow|outline|decoration|divide|accent|caret)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/,
      );
      expect(source).not.toMatch(/#[\da-f]{3,8}\b/i);
      expect(source).not.toMatch(/\brgba?\(/);
    },
  );

  it.each(FILES)("%s never uses the destructive text color", (file) => {
    expect(read(file)).not.toMatch(/\btext-destructive\b/);
  });

  // The look of a table is the primitive's alone: a copy of its classes in the
  // data table would be a second source, which drifts.
  it("leaves the look of a table to the primitive: the data table repeats none of its classes", () => {
    const source = read("shared/components/data/data-table.tsx");
    const table = /<Table\b[\s\S]*<\/Table>/.exec(source)?.[0] ?? "";

    expect(table).not.toBe("");
    for (const copied of ["text-body", "text-meta", "h-11", "px-4", "py-3", "hover:bg-accent"]) {
      expect(table, copied).not.toContain(copied);
    }
    // The one highlight it takes off is its own: the row that says there is nothing to show
    expect(table.match(/hover:bg-transparent/g)).toHaveLength(1);
  });

  it("keeps a linked row on the locale-aware Link, so that the language of the page is kept", () => {
    const source = read("shared/components/ui/list.tsx");

    expect(source).toContain('from "@/shared/lib/i18n-navigation"');
    expect(source).not.toContain('from "next/link"');
  });
});

// theme-contrast.test.ts measures the tokens a theme provides; these are the
// pairs the containers put together.
describe.each([
  ["light", light],
  ["dark", { ...light, ...darkOverrides }],
])("%s theme, containers", (_mode, vars) => {
  const all = { ...vars, ...inline };
  const ratio = (fg: string, bg: string) =>
    contrastRatio(`var(--${fg})`, `var(--${bg})`, all);

  /** The tint of the danger tile, read from its own class and written as a theme would. */
  const dangerTint = (() => {
    const html = renderWithIntl(<IconTile icon={UsersIcon} tone="danger" />);
    const name =
      classesOf(slotTag(html, "icon-tile")).find((cls) =>
        cls.startsWith("bg-[color-mix("),
      ) ?? "";
    return name
      .slice("bg-[".length, -1)
      .replaceAll("_", " ")
      .replaceAll(",", ", ");
  })();

  it.each([
    // the icon of a neutral tile, on its tint
    ["ink-soft", "hairline"],
    // the figures, the headers and the trend of a card or a table, on the surface
    ["ink", "surface"],
    ["ink-muted", "surface"],
    ["success-text", "surface"],
    ["danger-text", "surface"],
  ])("reads %s on %s at 4.5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("reads the icon of a danger tile on its tint at 4.5:1", () => {
    expect(dangerTint).toMatch(/^color-mix\(in oklab, /);
    expect(
      contrastRatio("var(--danger-text)", dangerTint, all),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
