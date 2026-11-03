import type { ComponentProps, ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FolderIcon } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { EmptyState } from "@/shared/components/data/empty-state";
import { ErrorState } from "@/shared/components/data/error-state";
import {
  CardsRowSkeleton,
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/shared/components/data/skeletons";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  contrastRatio,
  parseBlock,
  parseThemeBlocks,
} from "../../helpers/color";
import { attribute, classesOf, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl cannot be imported in Node: its ESM build
// resolves `next/navigation` without an extension. A plain anchor stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
  };
});

// The click of a button cannot be made in static markup, so the handler is read
// where it is handed over: this keeps the props of every Button the states draw,
// in order, and still draws the real one.
const buttonProps = vi.hoisted(
  () => [] as (ComponentProps<"button"> & { asChild?: boolean })[],
);

vi.mock("@/shared/components/ui/button", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/components/ui/button")>();
  const { createElement } = await import("react");
  return {
    ...actual,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      buttonProps.push(props);
      return createElement(actual.Button, props);
    },
  };
});

beforeEach(() => {
  buttonProps.length = 0;
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

/** The start tag of the element whose content starts with this text. */
function tagBefore(html: string, text: string): string {
  const escaped = text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`<[a-z0-9]+[^>]*>(?=${escaped}<)`).exec(html)?.[0] ?? "";
}

/** The classes of the element whose content is this text. */
function classesOfText(html: string, text: string): string[] {
  return classesOf(tagBefore(html, text));
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

/** The classes of every `Skeleton` block in this markup. */
function blocks(html: string): string[][] {
  return slotTags(html, "skeleton").map((tag) => classesOf(tag));
}

const DEFAULT_STRINGS = {
  en: {
    errorTitle: "Something went wrong",
    errorDescription: "Please try again in a moment.",
    retry: "Try again",
  },
  fr: {
    errorTitle: "Une erreur est survenue",
    errorDescription: "Réessayez dans un instant.",
    retry: "Réessayer",
  },
} as const;

describe("empty state", () => {
  const copy = {
    title: "No projects yet",
    description: "Create a project to see it here.",
  };
  // The types ask for an icon or an illustration. A test that leaves both out
  // checks what a JavaScript caller gets, so the props are cast.
  const render = (props: Partial<ComponentProps<typeof EmptyState>> = {}) =>
    renderWithIntl(
      <EmptyState {...copy} {...(props as ComponentProps<typeof EmptyState>)} />,
    );

  describe("its action", () => {
    it("is a single link, and no button, when it has an href", () => {
      const html = render({
        action: { label: "New project", href: "/projects/new" },
      });
      const [anchor] = startTags(html, "a");

      expect(startTags(html, "a")).toHaveLength(1);
      expect(startTags(html, "button")).toHaveLength(0);
      expect(attribute(anchor, "href")).toBe("/projects/new");
      expect(html).toContain(">New project</a>");
    });

    it("gives the link the look of the primary button", () => {
      const html = render({
        action: { label: "New project", href: "/projects/new" },
      });
      const classes = classesOf(startTags(html, "a")[0]);

      expect(attribute(startTags(html, "a")[0], "data-slot")).toBe("button");
      expect(classes).toEqual(
        expect.arrayContaining(["bg-primary", "tap-target", "h-10"]),
      );
    });

    it("is a single button, and no link, when it has a handler", () => {
      const html = render({ action: { label: "New project", onClick: vi.fn() } });

      expect(startTags(html, "button")).toHaveLength(1);
      expect(startTags(html, "a")).toHaveLength(0);
      expect(html).toContain(">New project</button>");
    });

    it("never submits a form it happens to sit in", () => {
      const html = render({ action: { label: "New project", onClick: vi.fn() } });

      expect(attribute(startTags(html, "button")[0], "type")).toBe("button");
    });

    it("is absent when there is none", () => {
      const html = render();

      expect(startTags(html, "button")).toHaveLength(0);
      expect(startTags(html, "a")).toHaveLength(0);
    });

    it("hands its handler to the button, which calls it without the click event", () => {
      const onClick = vi.fn();
      render({ action: { label: "New project", onClick } });
      const [button] = buttonProps;

      expect(button.onClick).toBeTypeOf("function");
      button.onClick?.({} as never);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith();
    });

    it("hands no handler to the button of a link", () => {
      render({ action: { label: "New project", href: "/projects/new" } });
      const [button] = buttonProps;

      expect(button.asChild).toBe(true);
      expect(button.onClick).toBeUndefined();
    });
  });

  describe("its picture", () => {
    it("draws the icon in a tinted tile of 56 px", () => {
      const classes = classesOf(slotTag(render({ icon: FolderIcon }), "icon-tile"));

      expect(classes).toEqual(
        expect.arrayContaining(["size-14", "rounded-lg", "bg-brand-tint"]),
      );
    });

    it("hides the icon from assistive technology", () => {
      const [svg] = startTags(render({ icon: FolderIcon }), "svg");

      expect(attribute(svg, "aria-hidden")).toBe("true");
    });

    it("shows the illustration of the project instead of the icon", () => {
      const html = render({
        icon: FolderIcon,
        illustration: <svg data-art="project" />,
      });

      expect(html).toContain('data-art="project"');
      expect(slotTags(html, "icon-tile")).toHaveLength(0);
    });

    it("hides the illustration from assistive technology: it is decoration, the title says the rest", () => {
      const html = render({ illustration: <svg data-art="project" /> });
      const wrapper = slotTag(html, "empty-state-illustration");

      expect(attribute(wrapper, "aria-hidden")).toBe("true");
      expect(html).toContain(`${wrapper}<svg data-art="project"`);
    });

    it("shows an illustration with no icon at all", () => {
      const html = render({ illustration: <svg data-art="project" /> });

      expect(html).toContain('data-art="project"');
      expect(slotTags(html, "icon-tile")).toHaveLength(0);
    });

    it("shows no picture when it is given none, and never a bare icon", () => {
      const html = render();

      expect(slotTags(html, "icon-tile")).toHaveLength(0);
      expect(startTags(html, "svg")).toHaveLength(0);
    });
  });

  describe("its words", () => {
    it("says its title as a heading and its sentence below", () => {
      const html = render();

      expect(startTags(html, "h3")).toHaveLength(1);
      expect(html).toContain(`>${copy.title}</h3>`);
      expect(html).toContain(`>${copy.description}</p>`);
    });

    it("sets the title in ink and the sentence in muted ink", () => {
      const html = render();

      expect(classesOfText(html, copy.title)).toEqual(
        expect.arrayContaining(["text-section", "text-ink"]),
      );
      expect(classesOfText(html, copy.description)).toEqual(
        expect.arrayContaining(["text-body", "text-ink-muted"]),
      );
    });

    // The state is a centered flex column: its title and its sentence are boxes
    // that size to their content. `break-word` leaves the min-content width of an
    // unbroken token whole, so the box grows past the card (measured: 384 px for
    // the sentence and 503 px for the title in a 240 px card); `anywhere` lowers
    // it to one character, so the box stays inside.
    it("lets a long unbroken token wrap inside the card, with wrap-anywhere and not wrap-break-word", () => {
      const html = render();

      for (const text of [copy.title, copy.description]) {
        const classes = classesOfText(html, text);

        expect(classes).toContain("wrap-anywhere");
        expect(classes).not.toContain("wrap-break-word");
      }
    });
  });

  describe("its surface", () => {
    const surface = (className?: string) =>
      classesOf(slotTag(render({ className }), "empty-state"));

    it("is a surface with a hairline border, centered", () => {
      expect(surface()).toEqual(
        expect.arrayContaining([
          "bg-surface",
          "border",
          "border-hairline",
          "rounded-lg",
          "flex",
          "flex-col",
          "items-center",
          "text-center",
        ]),
      );
    });

    it("has dropped the dashed border and the old tints", () => {
      const classes = surface();

      for (const old of ["border-dashed", "bg-muted", "text-muted-foreground"]) {
        expect(classes).not.toContain(old);
      }
    });

    it("lets a caller's class win", () => {
      const classes = surface("p-4");

      expect(classes).toContain("p-4");
      expect(classes).not.toContain("p-8");
    });
  });

  it("asks at compile time for an icon or an illustration, and for a handler or a link, never both", () => {
    // @ts-expect-error a picture is required: an icon in a tile, or an illustration
    const bare = <EmptyState title="Title" description="Sentence." />;
    const both = (
      <EmptyState
        icon={FolderIcon}
        title="Title"
        description="Sentence."
        // @ts-expect-error an action runs a handler or follows a link, never both
        action={{ label: "Go", onClick: vi.fn(), href: "/go" }}
      />
    );

    expect(bare).toBeDefined();
    expect(both).toBeDefined();
  });

  it("still renders as the dashboard and the notifications page use it", () => {
    const html = renderWithIntl(
      <EmptyState
        icon={FolderIcon}
        title="No activity"
        description="Your recent activity will appear here."
      />,
    );

    expect(html).toContain(">No activity</h3>");
    expect(html).toContain(">Your recent activity will appear here.</p>");
    expect(slotTags(html, "icon-tile")).toHaveLength(1);
    expect(startTags(html, "button")).toHaveLength(0);
    expect(startTags(html, "a")).toHaveLength(0);
  });
});

describe("error state", () => {
  it.each([
    ["en", "Try again"],
    ["fr", "Réessayer"],
  ] as const)("is an alert with a retry button in %s", (locale, label) => {
    const html = renderWithIntl(<ErrorState onRetry={vi.fn()} />, locale);

    expect(attribute(slotTag(html, "error-state"), "role")).toBe("alert");
    expect(startTags(html, "button")).toHaveLength(1);
    expect(html).toContain(`>${label}</button>`);
  });

  it("never submits a form it happens to sit in", () => {
    const html = renderWithIntl(<ErrorState onRetry={vi.fn()} />);

    expect(attribute(startTags(html, "button")[0], "type")).toBe("button");
  });

  it("hands its retry to the button, which calls it without the click event", () => {
    const onRetry = vi.fn();
    renderWithIntl(<ErrorState onRetry={onRetry} />);
    const [button] = buttonProps;

    expect(button.onClick).toBeTypeOf("function");
    button.onClick?.({} as never);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith();
  });

  it("lets a long unbroken token wrap inside the card, with wrap-anywhere and not wrap-break-word", () => {
    const html = renderWithIntl(
      <ErrorState title="A long title" description="A long sentence." />,
    );

    for (const text of ["A long title", "A long sentence."]) {
      const classes = classesOfText(html, text);

      expect(classes).toContain("wrap-anywhere");
      expect(classes).not.toContain("wrap-break-word");
    }
  });

  it("has no button, and still its alert, when there is nothing to retry", () => {
    const html = renderWithIntl(<ErrorState />);

    expect(attribute(slotTag(html, "error-state"), "role")).toBe("alert");
    expect(startTags(html, "button")).toHaveLength(0);
  });

  it.each(["en", "fr"] as const)(
    "tells what happened in %s with the words of the locale",
    (locale) => {
      const html = renderWithIntl(<ErrorState />, locale);

      expect(html).toContain(`>${DEFAULT_STRINGS[locale].errorTitle}</h3>`);
      expect(html).toContain(`>${DEFAULT_STRINGS[locale].errorDescription}</p>`);
    },
  );

  it("takes the words of the caller in place of the defaults", () => {
    const html = renderWithIntl(
      <ErrorState
        title="Projects did not load"
        description="The server did not answer."
        onRetry={vi.fn()}
        retryLabel="Reload projects"
      />,
    );

    expect(html).toContain(">Projects did not load</h3>");
    expect(html).toContain(">The server did not answer.</p>");
    expect(html).toContain(">Reload projects</button>");
    for (const word of Object.values(DEFAULT_STRINGS.en)) {
      expect(html).not.toContain(word);
    }
  });

  it("puts the icon in a danger tile of 56 px, hidden from assistive technology", () => {
    const html = renderWithIntl(<ErrorState />);

    expect(classesOf(slotTag(html, "icon-tile"))).toEqual(
      expect.arrayContaining(["size-14", "text-danger-text"]),
    );
    expect(attribute(startTags(html, "svg")[0], "aria-hidden")).toBe("true");
  });

  it("sits on the same surface as the empty state, so one can stand for the other", () => {
    const empty = classesOf(
      slotTag(
        renderWithIntl(
          <EmptyState icon={FolderIcon} title="Title" description="Sentence." />,
        ),
        "empty-state",
      ),
    );
    const error = classesOf(slotTag(renderWithIntl(<ErrorState />), "error-state"));

    expect(error).toEqual(expect.arrayContaining(empty));
    expect(error).not.toContain("border-dashed");
  });

  it("lets a caller's class win", () => {
    const classes = classesOf(
      slotTag(renderWithIntl(<ErrorState className="p-4" />), "error-state"),
    );

    expect(classes).toContain("p-4");
    expect(classes).not.toContain("p-8");
  });
});

type Level = 1 | 2 | 3;

describe.each<[string, (headingLevel?: Level) => ReactNode]>([
  [
    "empty state",
    (headingLevel) => (
      <EmptyState
        icon={FolderIcon}
        title="No projects yet"
        description="Create a project to see it here."
        headingLevel={headingLevel}
      />
    ),
  ],
  ["error state", (headingLevel) => <ErrorState headingLevel={headingLevel} />],
])("heading of the %s", (_name, make) => {
  const headings = (html: string) =>
    [1, 2, 3, 4, 5, 6].filter((level) => startTags(html, `h${level}`).length > 0);

  it("is an h3 by default", () => {
    expect(headings(renderWithIntl(make()))).toEqual([3]);
    expect(startTags(renderWithIntl(make()), "h3")).toHaveLength(1);
  });

  it.each([
    [1, "h1"],
    [2, "h2"],
    [3, "h3"],
  ] as const)("renders headingLevel %s as an %s, and no other heading", (level, tag) => {
    const html = renderWithIntl(make(level));

    expect(startTags(html, tag)).toHaveLength(1);
    expect(headings(html)).toEqual([level]);
  });

  it("looks the same at every level", () => {
    const classesAt = (level: Level) =>
      classesOf(startTags(renderWithIntl(make(level)), `h${level}`)[0]);

    expect(classesAt(3)).toEqual(
      expect.arrayContaining(["text-section", "text-ink", "mt-4"]),
    );
    expect(classesAt(1)).toEqual(classesAt(3));
    expect(classesAt(2)).toEqual(classesAt(3));
  });
});

describe("skeleton", () => {
  const classes = (className?: string) =>
    classesOf(
      slotTag(renderWithIntl(<Skeleton className={className} />), "skeleton"),
    );

  it("is a block in the hairline color, which shows on a surface and on the page", () => {
    expect(classes()).toEqual(
      expect.arrayContaining(["bg-hairline", "rounded-md"]),
    );
  });

  it("has dropped the muted fill, and never takes the track color, 1.04:1 on the light page", () => {
    expect(classes()).not.toContain("bg-muted");
    expect(classes()).not.toContain("bg-track");
  });

  it("pulses, and stops when the user asks for less motion", () => {
    expect(classes()).toEqual(
      expect.arrayContaining(["animate-pulse", "motion-reduce:animate-none"]),
    );
  });

  it("lets a caller's class win, as the two settings lists use it", () => {
    const custom = classes("h-14 w-full rounded-full bg-brand-tint");

    expect(custom).toEqual(
      expect.arrayContaining(["h-14", "w-full", "rounded-full", "bg-brand-tint"]),
    );
    expect(custom).not.toContain("rounded-md");
    expect(custom).not.toContain("bg-hairline");
  });
});

describe("page skeletons", () => {
  interface Common {
    announce?: boolean;
    className?: string;
  }
  const COMPOSITIONS: [string, string, (props?: Common) => ReactNode][] = [
    ["page header", "page-header-skeleton", (props) => <PageHeaderSkeleton {...props} />],
    ["cards row", "cards-row-skeleton", (props) => <CardsRowSkeleton {...props} />],
    ["list", "list-skeleton", (props) => <ListSkeleton {...props} />],
    ["table", "table-skeleton", (props) => <TableSkeleton {...props} />],
  ];

  describe.each(COMPOSITIONS)("%s skeleton", (_name, slot, make) => {
    it("is busy", () => {
      expect(attribute(slotTag(renderWithIntl(make()), slot), "aria-busy")).toBe(
        "true",
      );
    });

    it.each([
      ["en", en.common.loading],
      ["fr", fr.common.loading],
    ] as const)("says it is loading once in %s, to screen readers only", (locale, loading) => {
      expect(screenReaderTexts(renderWithIntl(make(), locale))).toEqual([
        loading,
      ]);
    });

    it("shows no text of its own", () => {
      expect(textOf(renderWithIntl(make()))).toBe(en.common.loading);
    });

    it("announces with announce={true}, as it does by default", () => {
      expect(
        screenReaderTexts(renderWithIntl(make({ announce: true }))),
      ).toEqual([en.common.loading]);
    });

    it("stays busy but says nothing of its own with announce={false}", () => {
      const html = renderWithIntl(make({ announce: false }));

      expect(attribute(slotTag(html, slot), "aria-busy")).toBe("true");
      expect(screenReaderTexts(html)).toEqual([]);
      expect(textOf(html)).toBe("");
    });

    it("is made of skeleton blocks that stop pulsing for reduced motion", () => {
      const all = blocks(renderWithIntl(make()));

      expect(all.length).toBeGreaterThan(0);
      for (const classes of all) {
        expect(classes).toEqual(
          expect.arrayContaining(["animate-pulse", "motion-reduce:animate-none"]),
        );
      }
    });

    it("draws every bar in hairline, one color for all, never in track", () => {
      for (const classes of blocks(renderWithIntl(make()))) {
        expect(classes).toContain("bg-hairline");
        expect(classes).not.toContain("bg-track");
      }
    });

    it("takes a class of the caller on its container", () => {
      const html = renderWithIntl(make({ className: "mt-6" }));

      expect(classesOf(slotTag(html, slot))).toContain("mt-6");
    });

    it("does not pose as a list, a table or a heading", () => {
      const html = renderWithIntl(make());

      for (const name of ["ul", "ol", "li", "table", "tr", "td", "th", "h1", "h2", "h3"]) {
        expect(startTags(html, name)).toHaveLength(0);
      }
    });
  });

  describe("page header", () => {
    const html = renderWithIntl(<PageHeaderSkeleton />);

    it("has the tile, the title, the context line and the action of a header", () => {
      const tile = blocks(html).filter((classes) => classes.includes("size-14"));
      const action = blocks(html).filter((classes) => classes.includes("h-10"));

      expect(tile).toHaveLength(1);
      expect(action).toHaveLength(1);
      expect(blocks(html)).toHaveLength(4);
    });

    it("lets a caller's class win over its layout", () => {
      const classes = classesOf(
        slotTag(renderWithIntl(<PageHeaderSkeleton className="gap-8" />), "page-header-skeleton"),
      );

      expect(classes).toContain("gap-8");
      expect(classes).not.toContain("gap-4");
    });

    it("lays itself out as the header does, a column that becomes a row", () => {
      expect(classesOf(slotTag(html, "page-header-skeleton"))).toEqual(
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

  describe("cards row", () => {
    const cards = (props: ComponentProps<typeof CardsRowSkeleton> = {}) =>
      slotTags(renderWithIntl(<CardsRowSkeleton {...props} />), "card");

    it("shows three cards unless it is told otherwise", () => {
      expect(cards()).toHaveLength(3);
    });

    it.each([0, 1, 4, 6])("shows %s cards when asked for them", (count) => {
      expect(cards({ count })).toHaveLength(count);
    });

    it("wraps its cards on a grid that fits any number of them", () => {
      const classes = classesOf(
        slotTag(renderWithIntl(<CardsRowSkeleton count={5} />), "cards-row-skeleton"),
      );

      expect(classes).toEqual(expect.arrayContaining(["grid", "gap-4"]));
      expect(
        classes.some((name) => name.startsWith("grid-cols-[repeat(auto-fit,")),
      ).toBe(true);
    });

    const gridOf = (className?: string) =>
      classesOf(
        slotTag(
          renderWithIntl(<CardsRowSkeleton className={className} />),
          "cards-row-skeleton",
        ),
      );
    const autoFit = (classes: string[]) =>
      classes.some((name) => name.startsWith("grid-cols-[repeat(auto-fit,"));

    it.each([
      "grid-cols-2",
      "sm:grid-cols-2 lg:grid-cols-4",
      "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    ])("lets the columns of the page, %s, replace the auto-fit grid", (className) => {
      const classes = gridOf(className);

      expect(classes).toEqual(expect.arrayContaining(className.split(" ")));
      expect(classes).toEqual(expect.arrayContaining(["grid", "gap-4"]));
      expect(autoFit(classes)).toBe(false);
    });

    it("keeps the auto-fit grid when the caller sets no columns", () => {
      const classes = gridOf("gap-2");

      expect(classes).toContain("gap-2");
      expect(classes).not.toContain("gap-4");
      expect(autoFit(classes)).toBe(true);
    });

    it("sizes the tile of a card as the icon tile of a stat card is", () => {
      const tile = blocks(renderWithIntl(<CardsRowSkeleton count={1} />)).filter(
        (classes) => classes.includes("size-10"),
      );

      expect(tile).toHaveLength(1);
      expect(tile[0]).toContain("rounded-md");
    });
  });

  describe("list", () => {
    const rows = (props: ComponentProps<typeof ListSkeleton> = {}) =>
      slotTags(renderWithIntl(<ListSkeleton {...props} />), "list-skeleton-row");

    it("shows four rows unless it is told otherwise", () => {
      expect(rows()).toHaveLength(4);
    });

    it.each([0, 1, 2, 7])("shows %s rows when asked for them", (count) => {
      expect(rows({ rows: count })).toHaveLength(count);
    });

    it("is as tall as a list row, and divided by hairlines as a list is", () => {
      const html = renderWithIntl(<ListSkeleton />);

      expect(classesOf(rows()[0])).toEqual(
        expect.arrayContaining(["min-h-14", "items-center", "gap-3", "py-2"]),
      );
      expect(classesOf(slotTag(html, "list-skeleton-rows"))).toEqual(
        expect.arrayContaining(["divide-y", "divide-hairline"]),
      );
    });
  });

  describe("table", () => {
    const render = (props: ComponentProps<typeof TableSkeleton> = {}) =>
      renderWithIntl(<TableSkeleton {...props} />);

    it("shows five rows of four columns unless it is told otherwise", () => {
      const html = render();

      expect(slotTags(html, "table-skeleton-row")).toHaveLength(5);
      expect(attribute(slotTag(html, "table-skeleton-header"), "style")).toContain(
        "repeat(4,",
      );
      for (const row of slotTags(html, "table-skeleton-row")) {
        expect(attribute(row, "style")).toContain("repeat(4,");
      }
    });

    it.each([
      [0, 1],
      [2, 3],
      [8, 6],
    ])("shows %s rows of %s columns when asked for them", (rows, columns) => {
      const html = render({ rows, columns });

      expect(slotTags(html, "table-skeleton-row")).toHaveLength(rows);
      for (const tag of [
        slotTag(html, "table-skeleton-header"),
        ...slotTags(html, "table-skeleton-row"),
      ]) {
        expect(attribute(tag, "style")).toContain(`repeat(${columns},`);
      }
    });

    it("has one header bar per column", () => {
      const html = render({ rows: 0, columns: 5 });

      expect(blocks(html)).toHaveLength(5);
    });

    it("has one bar per cell", () => {
      const html = render({ rows: 3, columns: 2 });

      expect(blocks(html)).toHaveLength(2 + 3 * 2);
    });

    it("sits on the surface of the data table", () => {
      expect(classesOf(slotTag(render(), "table-skeleton"))).toEqual(
        expect.arrayContaining([
          "overflow-hidden",
          "rounded-lg",
          "border",
          "border-hairline",
          "bg-card",
          "shadow-card",
        ]),
      );
    });

    // Measured on the data table in Chromium: a header of 44 px, and rows of 46
    // px (44 px of content and the 2 px its collapsed borders add).
    it("is as tall as the data table: a header of 44 px and rows of 46 px", () => {
      const html = render();
      const header = classesOf(slotTag(html, "table-skeleton-header"));
      const row = classesOf(slotTags(html, "table-skeleton-row")[0]);

      expect(header).toEqual(expect.arrayContaining(["h-11", "border-b"]));
      expect(row).toContain("h-11.5");
      expect(header).not.toContain("box-content");
      expect(row).not.toContain("box-content");
    });

    it("takes a class of the caller over its surface", () => {
      const classes = classesOf(
        slotTag(renderWithIntl(<TableSkeleton className="rounded-none" />), "table-skeleton"),
      );

      expect(classes).toContain("rounded-none");
      expect(classes).not.toContain("rounded-lg");
    });
  });
});

describe("loading region", () => {
  const page = (locale: "en" | "fr" = "en") =>
    renderWithIntl(
      <LoadingRegion>
        <PageHeaderSkeleton />
        <CardsRowSkeleton />
        <ListSkeleton />
        <TableSkeleton />
      </LoadingRegion>,
      locale,
    );

  it("is a busy region", () => {
    expect(
      attribute(slotTag(page(), "loading-region"), "aria-busy"),
    ).toBe("true");
  });

  it.each([
    ["en", en.common.loading],
    ["fr", fr.common.loading],
  ] as const)("announces loading once in %s for the skeletons inside it, which stay silent", (locale, loading) => {
    expect(screenReaderTexts(page(locale))).toEqual([loading]);
  });

  it("keeps every skeleton busy: the region and its four skeletons", () => {
    expect(page().match(/aria-busy="true"/g)).toHaveLength(5);
  });

  it("silences a skeleton that is a direct child only: a nested one says so itself, or is told not to", () => {
    const nested = (announce: boolean) =>
      screenReaderTexts(
        renderWithIntl(
          <LoadingRegion>
            <div>
              <ListSkeleton announce={announce} />
            </div>
          </LoadingRegion>,
        ),
      );

    expect(nested(true)).toEqual([en.common.loading, en.common.loading]);
    expect(nested(false)).toEqual([en.common.loading]);
  });

  it("passes what is not a skeleton through, untouched", () => {
    const html = renderWithIntl(
      <LoadingRegion>
        <p>Almost there</p>
        <ListSkeleton />
      </LoadingRegion>,
    );

    expect(html).toContain("<p>Almost there</p>");
    expect(html).not.toContain("announce");
  });

  it("takes a class of the caller", () => {
    const html = renderWithIntl(
      <LoadingRegion className="space-y-6">
        <ListSkeleton />
      </LoadingRegion>,
    );

    expect(classesOf(slotTag(html, "loading-region"))).toContain("space-y-6");
  });
});

describe("state strings", () => {
  it.each(["en", "fr"] as const)(
    "has the words of the error state in %s, with its default copy",
    (locale) => {
      const common = { en: en.common, fr: fr.common }[locale];

      expect(common).toMatchObject(DEFAULT_STRINGS[locale]);
    },
  );

  it("writes the loading text with the ellipsis character, not three dots", () => {
    expect(en.common.loading).toBe("Loading\u2026");
    expect(fr.common.loading).toBe("Chargement\u2026");
    expect(en.common.loading).not.toContain("...");
    expect(fr.common.loading).not.toContain("...");
  });
});

describe("state sources", () => {
  const FILES = [
    "shared/components/data/empty-state",
    "shared/components/data/error-state",
    "shared/components/data/skeletons",
    "shared/components/ui/skeleton",
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

  it.each([
    "shared/components/ui/skeleton",
    "shared/components/ui/skeleton.stories",
    "shared/components/data/skeletons",
    "shared/components/data/skeletons.stories",
  ])("%s.tsx never takes the track color, 1.04:1 on the light page", (name) => {
    const source = readFileSync(resolve(srcDir, `${name}.tsx`), "utf-8");

    expect(source).not.toMatch(/\bbg-track\b/);
  });

  it("empty-state.tsx links on the locale-aware Link of the app, which the tests stand in for", () => {
    const source = readFileSync(
      resolve(srcDir, "shared/components/data/empty-state.tsx"),
      "utf-8",
    );

    expect(source).toMatch(
      /import\s*\{\s*Link\s*\}\s*from\s*"@\/shared\/lib\/i18n-navigation"/,
    );
    expect(source).not.toMatch(/from\s*"next\/link"/);
  });

  it.each(FILES.slice(0, 3))(
    "%s.tsx has no visible string of its own: they come from the locales or the caller",
    (name) => {
      const source = readFileSync(resolve(srcDir, `${name}.tsx`), "utf-8");

      expect(source).not.toMatch(
        />\s*(?:Loading|Try again|Something went wrong|Retry)/i,
      );
    },
  );
});

// theme-contrast.test.ts measures the tokens a theme provides; these are the
// pairs the state screens put together.
describe.each([
  ["light", light],
  ["dark", { ...light, ...darkOverrides }],
])("%s theme, state screens", (_mode, vars) => {
  const all = { ...vars, ...inline };

  it("keeps the icon of the error tile readable over its danger tint", () => {
    expect(
      contrastRatio(
        "var(--danger-text)",
        "color-mix(in oklab, var(--danger) 10%, var(--surface))",
        all,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  // A placeholder carries no information, so it asks no 3:1. It must still be
  // seen, on a card or a table and on the page itself: these floors sit just
  // under what the tokens give today. The track color, 1.04:1 on the light
  // page, would fail the second.
  it("shows a hairline bar against the surface of a card or a table", () => {
    expect(
      contrastRatio("var(--hairline)", "var(--surface)", all),
    ).toBeGreaterThanOrEqual(1.2);
  });

  it("shows a hairline bar against the page", () => {
    expect(
      contrastRatio("var(--hairline)", "var(--surface-sunken)", all),
    ).toBeGreaterThanOrEqual(1.15);
  });
});
