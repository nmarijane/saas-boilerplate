import type { ComponentProps, ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { EntityHeader } from "@/shared/components/data/entity-header";
import { PageHeader } from "@/shared/components/data/page-header";
import {
  EntityHeaderSkeleton,
  ListSkeleton,
  LoadingRegion,
} from "@/shared/components/data/skeletons";
import { attribute, classesOf, startTags } from "../../helpers/html";
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

// The line heights of the type scale, as global.css declares them (in rem).
const textTokens = Object.fromEntries(
  [
    ...readFileSync(resolve(srcDir, "styles/global.css"), "utf-8").matchAll(
      /(--text-[a-z]+--line-height):\s*([\d.]+)rem/g,
    ),
  ].map(([, name, value]) => [name, value]),
);

const BREADCRUMB = [
  { label: "Projects", href: "/projects" },
  { label: "Website redesign" },
];

const render = (
  props: Partial<ComponentProps<typeof EntityHeader>> = {},
  locale: "en" | "fr" = "en",
) =>
  renderWithIntl(
    <EntityHeader
      breadcrumb={BREADCRUMB}
      title="Website redesign"
      {...props}
    />,
    locale,
  );

/** The start tags of the elements that carry this `data-slot`, in document order. */
function slotTags(html: string, slot: string): string[] {
  return (
    html.match(
      new RegExp(`<[a-z0-9]+[^>]*\\sdata-slot="${slot}"[^>]*>`, "g"),
    ) ?? []
  );
}

/** The start tag of the first element that carries this `data-slot`. */
function slotTag(html: string, slot: string): string {
  return slotTags(html, slot)[0] ?? "";
}

/** The crumbs of the breadcrumb, whole, in order. */
function crumbs(html: string): string[] {
  return html.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
}

/** The start tag of an element written out whole. */
function startOf(element: string): string {
  return /^<[a-z0-9][^>]*>/.exec(element)?.[0] ?? "";
}

/** The text of each element that carries the `sr-only` class, which only a screen reader hears. */
function screenReaderTexts(html: string): string[] {
  return [...html.matchAll(/<[a-z][^>]*>([^<]*)(?=<)/g)]
    .filter(([tag]) => classesOf(tag).includes("sr-only"))
    .map(([, text]) => text);
}

/** What a reader sees and hears: the markup without its tags. */
function textOf(html: string): string {
  return html.replaceAll(/<[^>]*>/g, "");
}

/** An attribute value as the browser reads it: static markup writes an apostrophe as `&#x27;`. */
function unescaped(value: string | undefined): string | undefined {
  return value?.replaceAll("&#x27;", "'");
}

describe("entity header", () => {
  describe("its title", () => {
    it("has one h1 at the entity size", () => {
      const html = render();
      const titles = startTags(html, "h1");

      expect(titles).toHaveLength(1);
      expect(classesOf(titles[0] ?? "")).toEqual(
        expect.arrayContaining(["text-entity", "font-bold"]),
      );
      expect(html).toContain(">Website redesign</h1>");
    });

    it("is smaller than the title of a page header, and never takes its size", () => {
      const classes = classesOf(startTags(render(), "h1")[0] ?? "");

      for (const name of ["text-page", "text-panel", "font-semibold"]) {
        expect(classes).not.toContain(name);
      }
    });

    it("is set in the display face, in ink, and breaks a long word instead of leaving the row", () => {
      expect(classesOf(startTags(render(), "h1")[0] ?? "")).toEqual(
        expect.arrayContaining([
          "font-display",
          "text-ink",
          "text-balance",
          "wrap-break-word",
        ]),
      );
    });
  });

  describe("its breadcrumb", () => {
    it("is a navigation named in the language of the page", () => {
      const nav = startTags(render(), "nav");

      expect(nav).toHaveLength(1);
      expect(attribute(nav[0] ?? "", "aria-label")).toBe(en.common.breadcrumb);
      expect(
        unescaped(
          attribute(startTags(render({}, "fr"), "nav")[0] ?? "", "aria-label"),
        ),
      ).toBe(fr.common.breadcrumb);
    });

    it("is an ordered list with one item per crumb", () => {
      const html = render();

      expect(startTags(html, "ol")).toHaveLength(1);
      expect(crumbs(html)).toHaveLength(2);
    });

    it("ends on the current page", () => {
      const [first, last] = crumbs(render());

      expect(attribute(startOf(last ?? ""), "aria-current")).toBe("page");
      expect(last).not.toContain("<a");
      expect(last).toContain("Website redesign");
      expect(first).toContain("<a ");
      expect(first).toContain('href="/projects"');
      expect(attribute(startOf(first ?? ""), "aria-current")).toBeUndefined();
    });

    it("marks the current page once, however long the trail is", () => {
      const html = render({
        breadcrumb: [
          { label: "Projects", href: "/projects" },
          { label: "Studio Nord", href: "/projects/nord" },
          { label: "Website redesign" },
        ],
      });

      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(startTags(html, "a")).toHaveLength(2);
    });

    it("links every crumb but the last, to the page it names", () => {
      const html = render({
        breadcrumb: [
          { label: "Projects", href: "/projects" },
          { label: "Studio Nord", href: "/projects/nord" },
          { label: "Website redesign", href: "/projects/nord/redesign" },
        ],
      });

      expect(startTags(html, "a").map((tag) => attribute(tag, "href"))).toEqual(
        ["/projects", "/projects/nord"],
      );
    });

    it("shows a crumb with no link as plain text: there is no page to go to", () => {
      const html = render({
        breadcrumb: [
          { label: "Workspace" },
          { label: "Projects", href: "/projects" },
          { label: "Website redesign" },
        ],
      });

      expect(startTags(html, "a")).toHaveLength(1);
      expect(crumbs(html)[0]).toContain("Workspace");
      expect(crumbs(html)[0]).not.toContain("<a");
    });

    it("is the current page alone when it has one crumb, with nothing to separate", () => {
      const html = render({ breadcrumb: [{ label: "Website redesign" }] });

      expect(crumbs(html)).toHaveLength(1);
      expect(attribute(startOf(crumbs(html)[0] ?? ""), "aria-current")).toBe(
        "page",
      );
      expect(startTags(html, "svg")).toHaveLength(0);
    });

    it("draws nothing without a crumb: an empty navigation would be announced for nothing", () => {
      const html = render({ breadcrumb: [] });

      expect(startTags(html, "nav")).toHaveLength(0);
      expect(startTags(html, "ol")).toHaveLength(0);
    });

    it("separates the crumbs with a chevron that assistive technology skips", () => {
      const html = render({
        breadcrumb: [
          { label: "Projects", href: "/projects" },
          { label: "Studio Nord", href: "/projects/nord" },
          { label: "Website redesign" },
        ],
      });
      const chevrons = startTags(html, "svg");

      expect(chevrons).toHaveLength(2);
      for (const tag of chevrons) {
        expect(attribute(tag, "aria-hidden")).toBe("true");
      }
    });

    it("writes the links in muted ink with a 44 px target, and the current page in ink", () => {
      const [first, last] = crumbs(render());

      expect(classesOf(startTags(first ?? "", "a")[0] ?? "")).toEqual(
        expect.arrayContaining(["text-ink-muted", "tap-target"]),
      );
      expect(classesOf(startOf(last ?? ""))).toContain("text-ink");
    });

    it("keeps a long crumb inside the row: the trail wraps and the last crumb is cut, never the page", () => {
      const html = render();

      expect(classesOf(startTags(html, "ol")[0] ?? "")).toEqual(
        expect.arrayContaining(["flex", "flex-wrap"]),
      );
      expect(crumbs(html)[1]).toContain("truncate");
    });

    it("links with the locale-aware Link, so that the language of the page is kept", () => {
      const source = readFileSync(
        resolve(srcDir, "shared/components/data/entity-header.tsx"),
        "utf-8",
      );

      expect(source).toContain('from "@/shared/lib/i18n-navigation"');
      expect(source).not.toContain('from "next/link"');
    });
  });

  describe("its words", () => {
    it("writes the description in muted ink, under the title", () => {
      const html = render({ description: "Redo the marketing site." });
      const tag = slotTag(html, "entity-header-description");

      expect(classesOf(tag)).toContain("text-ink-muted");
      expect(html.indexOf(">Website redesign</h1>")).toBeLessThan(
        html.indexOf("Redo the marketing site."),
      );
    });

    it("draws no description without one", () => {
      expect(slotTags(render(), "entity-header-description")).toHaveLength(0);
    });

    it("lets a long description wrap inside the column", () => {
      const tag = slotTag(
        render({ description: "x" }),
        "entity-header-description",
      );

      expect(classesOf(tag)).toContain("wrap-break-word");
    });

    it("shows the meta under the description, in a row that wraps", () => {
      const html = render({
        description: "Redo the marketing site.",
        meta: <span>Active</span>,
      });
      const tag = slotTag(html, "entity-header-meta");

      expect(classesOf(tag)).toEqual(
        expect.arrayContaining(["flex", "flex-wrap", "items-center"]),
      );
      expect(html).toContain("<span>Active</span>");
      expect(html.indexOf("Redo the marketing site.")).toBeLessThan(
        html.indexOf("<span>Active</span>"),
      );
    });

    it("draws no meta slot without a meta", () => {
      expect(slotTags(render(), "entity-header-meta")).toHaveLength(0);
    });
  });

  describe("its actions", () => {
    const actions = (html: string) => slotTag(html, "entity-header-actions");
    const pageActions = (html: string) => slotTag(html, "page-header-actions");
    const moreButton = (html: string, label = en.common.moreActions) =>
      startTags(html, "button").find(
        (tag) => attribute(tag, "aria-label") === label,
      ) ?? "";

    it("shows the primary action", () => {
      const html = render({
        primaryAction: <button type="button">Share</button>,
      });

      expect(actions(html)).not.toBe("");
      expect(html).toContain(">Share</button>");
    });

    it("opens the other actions from a « ⋯ » button named in the language of the page", () => {
      const moreActions = [{ label: "Rename", onSelect: vi.fn() }];

      expect(moreButton(render({ moreActions }))).not.toBe("");
      expect(
        moreButton(render({ moreActions }, "fr"), fr.common.moreActions),
      ).not.toBe("");
    });

    it("puts the « ⋯ » button after the primary action", () => {
      const html = render({
        primaryAction: <button type="button">Share</button>,
        moreActions: [{ label: "Rename", onSelect: vi.fn() }],
      });

      expect(html.indexOf(">Share</button>")).toBeLessThan(
        html.indexOf(`aria-label="${en.common.moreActions}"`),
      );
    });

    it("draws no actions slot, and no « ⋯ » button, without an action", () => {
      for (const html of [render(), render({ moreActions: [] })]) {
        expect(actions(html)).toBe("");
        expect(html).not.toContain(en.common.moreActions);
        expect(startTags(html, "button")).toHaveLength(0);
      }
    });

    it("places its actions as the page header does, so that the two families sit alike", () => {
      const props = {
        primaryAction: <button type="button">Share</button>,
        moreActions: [{ label: "Rename", onSelect: vi.fn() }],
      };
      const entity = render(props);
      const page = renderWithIntl(<PageHeader title="Settings" {...props} />);

      expect(classesOf(actions(entity))).toEqual(classesOf(pageActions(page)));
    });

    it("lays out its row as the page header does: a column on a phone, a row from sm", () => {
      const entity = classesOf(slotTag(render(), "entity-header-row"));
      const page = classesOf(
        slotTag(
          renderWithIntl(<PageHeader title="Settings" />),
          "page-header-row",
        ),
      );

      expect(entity).toEqual(page);
      expect(entity).toEqual(
        expect.arrayContaining([
          "flex",
          "flex-col",
          "sm:flex-row",
          "sm:items-center",
          "sm:justify-between",
        ]),
      );
    });
  });

  describe("its tabs", () => {
    it("shows the tabs under the title and the actions", () => {
      const tabs: ReactNode = <nav aria-label="Project tabs">Tabs here</nav>;
      const html = render({
        tabs,
        primaryAction: <button type="button">Share</button>,
      });

      expect(html).toContain("Tabs here");
      expect(html.indexOf(">Share</button>")).toBeLessThan(
        html.indexOf("Tabs here"),
      );
      expect(html.indexOf(">Website redesign</h1>")).toBeLessThan(
        html.indexOf("Tabs here"),
      );
    });

    it("draws nothing for tabs it is not given", () => {
      expect(startTags(render(), "nav")).toHaveLength(1);
    });
  });

  describe("its surface", () => {
    it("stacks the breadcrumb, the row and the tabs 16 px apart", () => {
      expect(classesOf(slotTag(render(), "entity-header"))).toEqual(
        expect.arrayContaining(["flex", "flex-col", "gap-4"]),
      );
    });

    it("merges the class of the caller onto the root", () => {
      expect(
        classesOf(slotTag(render({ className: "mb-6" }), "entity-header")),
      ).toContain("mb-6");
    });

    it("lets the text column take the room the actions leave, and give it up", () => {
      const column = /(<div[^>]*>)<h1/.exec(render())?.[1] ?? "";

      expect(classesOf(column)).toEqual(
        expect.arrayContaining(["min-w-0", "flex-1", "space-y-1"]),
      );
    });
  });
});

describe("entity header skeleton", () => {
  const skeleton = (props: ComponentProps<typeof EntityHeaderSkeleton> = {}) =>
    renderWithIntl(<EntityHeaderSkeleton {...props} />);
  const blocks = (html: string) =>
    slotTags(html, "skeleton").map((tag) => classesOf(tag));

  it("is busy", () => {
    expect(
      attribute(slotTag(skeleton(), "entity-header-skeleton"), "aria-busy"),
    ).toBe("true");
  });

  it.each([
    ["en", en.common.loading],
    ["fr", fr.common.loading],
  ] as const)(
    "says it is loading once in %s, to screen readers only",
    (locale, loading) => {
      expect(
        screenReaderTexts(renderWithIntl(<EntityHeaderSkeleton />, locale)),
      ).toEqual([loading]);
      expect(textOf(renderWithIntl(<EntityHeaderSkeleton />, locale))).toBe(
        loading,
      );
    },
  );

  it("stays busy but says nothing of its own with announce={false}", () => {
    const html = skeleton({ announce: false });

    expect(
      attribute(slotTag(html, "entity-header-skeleton"), "aria-busy"),
    ).toBe("true");
    expect(screenReaderTexts(html)).toEqual([]);
    expect(textOf(html)).toBe("");
  });

  it("does not pose as a heading, a list or a navigation", () => {
    const html = skeleton();

    for (const name of ["h1", "h2", "h3", "ul", "ol", "li", "nav", "a"]) {
      expect(startTags(html, name)).toHaveLength(0);
    }
  });

  it("draws every bar in hairline, pulsing, and still under reduced motion", () => {
    const all = blocks(skeleton());

    expect(all.length).toBeGreaterThan(0);
    for (const classes of all) {
      expect(classes).toEqual(
        expect.arrayContaining([
          "bg-hairline",
          "animate-pulse",
          "motion-reduce:animate-none",
        ]),
      );
    }
  });

  it("has the breadcrumb, the title, the description and the action of a header", () => {
    const all = blocks(skeleton());

    expect(all).toHaveLength(4);
    expect(all.filter((classes) => classes.includes("h-10"))).toHaveLength(1);
  });

  it("takes a class of the caller on its root, over its layout", () => {
    const classes = classesOf(
      slotTag(skeleton({ className: "gap-8" }), "entity-header-skeleton"),
    );

    expect(classes).toContain("gap-8");
    expect(classes).not.toContain("gap-4");
  });

  it("lays out its row and its text column as the header does, so that the page does not move when it arrives", () => {
    const drawn = skeleton();
    const header = render({ description: "Redo the marketing site." });
    const box = (html: string, ...names: string[]) =>
      startTags(html, "div")
        .map(classesOf)
        .find((classes) => names.every((name) => classes.includes(name))) ?? [];

    for (const names of [
      ["flex", "flex-col", "gap-4"],
      ["sm:flex-row"],
      ["min-w-0", "flex-1", "space-y-1"],
    ]) {
      const standIn = box(drawn, ...names);

      expect(standIn.length).toBeGreaterThan(0);
      expect(box(header, ...names)).toEqual(expect.arrayContaining(standIn));
    }
  });

  it("sets each line in a box as tall as the line it stands for", () => {
    // 18, 32 and 20 px: the line heights of `text-meta` (the breadcrumb),
    // `text-entity` (the title) and `text-body` (the description), which the
    // skeleton draws as `h-4.5`, `h-8` and `h-5` (a step of 0.25 rem each).
    const heights = startTags(skeleton(), "div")
      .map(classesOf)
      .flatMap((classes) =>
        classes.filter((name) => /^h-(?:4\.5|8|5)$/.test(name)),
      );

    expect(heights).toEqual(["h-4.5", "h-8", "h-5"]);
    expect(heights.map((name) => Number(name.slice(2)) * 0.25)).toEqual([
      Number.parseFloat(textTokens["--text-meta--line-height"]),
      Number.parseFloat(textTokens["--text-entity--line-height"]),
      Number.parseFloat(textTokens["--text-body--line-height"]),
    ]);
  });

  describe("in a loading region", () => {
    const page = (locale: "en" | "fr" = "en") =>
      renderWithIntl(
        <LoadingRegion>
          <EntityHeaderSkeleton />
          <ListSkeleton />
        </LoadingRegion>,
        locale,
      );

    it.each([
      ["en", en.common.loading],
      ["fr", fr.common.loading],
    ] as const)(
      "is recognized: the region announces loading once in %s, and the header stays silent",
      (locale, loading) => {
        expect(screenReaderTexts(page(locale))).toEqual([loading]);
      },
    );

    it("keeps every skeleton busy: the region and its two skeletons", () => {
      expect(page().match(/aria-busy="true"/g)).toHaveLength(3);
    });
  });
});

describe("entity header strings", () => {
  it.each(["en", "fr"] as const)(
    "has the name of the breadcrumb in %s",
    (locale) => {
      const common = { en: en.common, fr: fr.common }[locale];

      expect(common.breadcrumb.length).toBeGreaterThan(0);
    },
  );

  it("words the breadcrumb in French rather than copying the English", () => {
    expect(fr.common.breadcrumb).toBe("Fil d'Ariane");
    expect(fr.common.breadcrumb).not.toBe(en.common.breadcrumb);
  });
});
