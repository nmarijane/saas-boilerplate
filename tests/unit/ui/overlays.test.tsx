import type { JSX } from "react";
import type * as DialogModule from "@/shared/components/ui/dialog";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import {
  confirmationReady,
  ConfirmDialog,
  confirmRole,
  confirmThenClose,
  confirmVariant,
  whileConfirming,
} from "@/shared/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  dialogContentVariants,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { PopoverContent } from "@/shared/components/ui/popover";
import { SelectContent, SelectItem } from "@/shared/components/ui/select";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetOverlay,
} from "@/shared/components/ui/sheet";
import { ignoringToasts, keepToastClicks } from "@/shared/components/ui/sonner";
import {
  activeLink,
  activeTab,
  revealInStrip,
  tabStripStyles,
  tabStyles,
  watchActiveTab,
} from "@/shared/components/ui/tab-strip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { TooltipContent } from "@/shared/components/ui/tooltip";
import { attribute, classesOf, startTags, tokens } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// A failed confirmation shows an error toast: it is observed where it is handed
// to sonner.
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: vi.fn(() => null),
}));

// The confirm dialog hands its props to DialogContent: the spy lets a test read
// them, and still draws the real one.
vi.mock("@/shared/components/ui/dialog", async (importOriginal) => {
  const actual = await importOriginal<typeof DialogModule>();
  return { ...actual, DialogContent: vi.fn(actual.DialogContent) };
});

// A component without hooks is a function: calling it gives the element it
// hands to Radix, so the classes it passes can be read without a DOM. The
// content of a menu, a tooltip or a dialog sits in a portal, which a static
// render leaves out.
function propsOf(element: JSX.Element): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

function classNamesOf(element: JSX.Element): string[] {
  return tokens(String(propsOf(element).className ?? ""));
}

/** What a content component wraps in its portal: the element that carries the classes. */
function insidePortal(element: JSX.Element): JSX.Element {
  return propsOf(element).children as JSX.Element;
}

/** The types of the children of an element, without the ones React drops (null, false). */
function childTypesOf(element: JSX.Element): unknown[] {
  return React.Children.toArray(
    propsOf(element).children as React.ReactNode,
  ).map((child) => (child as JSX.Element).type);
}

/** The Content element of a dialog: the portal holds the overlay, then it. */
function dialogContent(props: Parameters<typeof DialogContent>[0] = {}) {
  const [, content] = propsOf(DialogContent(props)).children as JSX.Element[];
  return content as JSX.Element;
}

/** The Content element of a sheet: the portal holds the overlay, then it. */
function sheetContent(props: Parameters<typeof SheetContent>[0] = {}) {
  const [, content] = propsOf(SheetContent(props)).children as JSX.Element[];
  return content as JSX.Element;
}

describe("dialog content", () => {
  it.each([
    ["sm", "max-w-[420px]"],
    ["md", "max-w-[560px]"],
    ["lg", "max-w-[1080px]"],
  ] as const)("gives size %s a width of %s, and no other", (size, expected) => {
    const widths = tokens(dialogContentVariants({ size })).filter((name) =>
      name.startsWith("max-w-"),
    );

    expect(widths).toEqual([expected]);
  });

  it("is medium by default", () => {
    expect(tokens(dialogContentVariants())).toContain("max-w-[560px]");
    expect(classNamesOf(dialogContent())).toContain("max-w-[560px]");
  });

  it("takes its size from the prop", () => {
    expect(classNamesOf(dialogContent({ size: "sm" }))).toContain(
      "max-w-[420px]",
    );
    expect(classNamesOf(dialogContent({ size: "lg" }))).toContain(
      "max-w-[1080px]",
    );
  });

  it("is a floating surface with the dialog radius and the popover shadow", () => {
    const classes = tokens(dialogContentVariants());

    expect(classes).toContain("rounded-xl");
    expect(classes).toContain("shadow-pop");
    expect(classes).toContain("bg-popover");
    expect(classes).toContain("text-popover-foreground");
    // The edge of the dialog, in light and in dark: the shadow has no ring.
    expect(classes).toContain("border");
  });

  it("keeps a margin on a narrow screen and scrolls when it is taller than the viewport", () => {
    const classes = tokens(dialogContentVariants());

    expect(classes).toContain("w-[calc(100%-2rem)]");
    expect(classes).toContain("max-h-[calc(100dvh-2rem)]");
    expect(classes).toContain("overflow-y-auto");
  });

  it("has dropped the old shape", () => {
    const classes = tokens(dialogContentVariants());

    for (const old of ["max-w-lg", "rounded-lg", "shadow-lg", "bg-background"]) {
      expect(classes).not.toContain(old);
    }
  });

  it("lets a caller's class win, as the command palette needs", () => {
    const classes = classNamesOf(
      dialogContent({ className: "overflow-hidden p-0" }),
    );

    expect(classes).toContain("p-0");
    expect(classes).toContain("overflow-hidden");
    expect(classes).not.toContain("p-6");
    expect(classes).not.toContain("overflow-y-auto");
  });

  it("shows the close button after the content, so the focus lands on the content first", () => {
    expect(childTypesOf(dialogContent({ children: <p>Body</p> }))).toEqual([
      "p",
      DialogCloseButton,
    ]);
  });

  it("hides the close button when it is told to", () => {
    expect(
      childTypesOf(dialogContent({ children: <p>Body</p>, showCloseButton: false })),
    ).toEqual(["p"]);
  });
});

describe("dialog close button", () => {
  const html = (locale: "en" | "fr" = "en") =>
    renderWithIntl(
      <Dialog open>
        <DialogCloseButton />
      </Dialog>,
      locale,
    );
  const button = (locale: "en" | "fr" = "en") =>
    startTags(html(locale), "button")[0] ?? "";

  it("is named, in the language of the page", () => {
    expect(attribute(button("en"), "aria-label")).toBe(en.common.close);
    expect(attribute(button("fr"), "aria-label")).toBe(fr.common.close);
    expect(fr.common.close).not.toBe(en.common.close);
  });

  it("is a button that submits nothing, with a 44 px target", () => {
    expect(attribute(button(), "type")).toBe("button");
    expect(classesOf(button())).toContain("tap-target");
  });

  it("shows the focus ring of the system", () => {
    expect(classesOf(button())).toContain("focus-visible:focus-ring");
  });

  it("draws an icon and no text of its own", () => {
    expect(html()).toMatch(/<svg[^>]* aria-hidden="true"/);
    expect(html()).not.toContain("sr-only");
  });
});

describe("sheet close button", () => {
  const html = (locale: "en" | "fr" = "en") =>
    renderWithIntl(
      <Sheet open>
        <SheetCloseButton />
      </Sheet>,
      locale,
    );
  const button = (locale: "en" | "fr" = "en") =>
    startTags(html(locale), "button")[0] ?? "";

  it("is named with the key of the dialog close button, in the language of the page", () => {
    expect(attribute(button("en"), "aria-label")).toBe(en.common.close);
    expect(attribute(button("fr"), "aria-label")).toBe(fr.common.close);
    expect(fr.common.close).not.toBe(en.common.close);
  });

  it("leaves no English in French: the label is not hard-coded", () => {
    expect(html("fr")).toContain(fr.common.close);
    expect(html("fr")).not.toContain(en.common.close);
  });

  it("is a button that submits nothing, an icon with no text of its own", () => {
    expect(attribute(button(), "type")).toBe("button");
    expect(html()).toMatch(/<svg[^>]* aria-hidden="true"/);
    expect(html()).not.toContain("sr-only");
  });

  it("is a 44 px target in muted ink with the focus ring of the system, like the dialog's", () => {
    const classes = classesOf(button());

    expect(classes).toContain("tap-target");
    expect(classes).toContain("focus-visible:focus-ring");
    expect(classes).toContain("text-ink-muted");
    expect(classes).toContain("hover:text-ink");
  });

  it("has dropped the half-transparent icon and the ring of the old look", () => {
    const classes = classesOf(button());

    for (const old of [
      "opacity-70",
      "hover:opacity-100",
      "focus:ring-2",
      "focus:ring-offset-2",
      "ring-offset-background",
    ]) {
      expect(classes).not.toContain(old);
    }
  });

  it("closes the sheet from its corner, after the content", () => {
    const [, content] = propsOf(SheetContent({ children: <p>Menu</p> }))
      .children as JSX.Element[];

    expect(childTypesOf(content as JSX.Element)).toEqual([
      "p",
      SheetCloseButton,
    ]);
  });
});

describe("dialog parts", () => {
  const render = () =>
    renderWithIntl(
      <Dialog open>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogBody>Body</DialogBody>
        <DialogFooter>
          <button type="button">Cancel</button>
          <button type="button">Delete</button>
        </DialogFooter>
      </Dialog>,
    );
  const tagOf = (html: string, slot: string) =>
    new RegExp(`<[a-z0-9]+[^>]*data-slot="${slot}"[^>]*>`).exec(html)?.[0] ?? "";

  it("writes the title as a panel heading, in ink", () => {
    const title = tagOf(render(), "dialog-title");

    expect(title).toMatch(/^<h2 /);
    expect(classesOf(title)).toContain("text-panel");
    expect(classesOf(title)).toContain("font-semibold");
    expect(classesOf(title)).toContain("text-ink");
  });

  it("writes the description in muted ink at body size", () => {
    const description = classesOf(tagOf(render(), "dialog-description"));

    expect(description).toContain("text-body");
    expect(description).toContain("text-ink-muted");
  });

  it("aligns the header to the start, and leaves room for the close button", () => {
    const header = classesOf(tagOf(render(), "dialog-header"));

    expect(header).toContain("text-left");
    expect(header).not.toContain("text-center");
    expect(header).toContain("pr-8");
  });

  it("gives the body a slot of its own, at body size", () => {
    const html = render();

    expect(html).toContain(">Body<");
    expect(classesOf(tagOf(html, "dialog-body"))).toContain("text-body");
  });

  it("puts the footer at the right, with the main action last", () => {
    const html = render();
    const footer = classesOf(tagOf(html, "dialog-footer"));

    // Stacked on a phone, the main action (the last child) is on top.
    expect(footer).toContain("flex-col-reverse");
    expect(footer).toContain("sm:flex-row");
    expect(footer).toContain("sm:justify-end");
    expect(html.indexOf(">Cancel<")).toBeLessThan(html.indexOf(">Delete<"));
  });

  it("wraps the footer instead of cutting a button when long labels do not fit, the main action on top", () => {
    const footer = classesOf(tagOf(render(), "dialog-footer"));

    expect(footer).toContain("sm:flex-wrap-reverse");
    expect(footer).not.toContain("sm:flex-nowrap");
  });
});

describe("scrim", () => {
  it.each([
    ["dialog", DialogOverlay({})],
    ["sheet", SheetOverlay({})],
  ])(
    "draws the %s overlay with the scrim token, not a fixed black",
    (_name, overlay) => {
      const classes = classNamesOf(overlay);

      expect(classes).toContain("bg-scrim");
      expect(classes.filter((name) => name.startsWith("bg-black"))).toEqual([]);
    },
  );
});

describe("floating layers", () => {
  const SURFACE = [
    "bg-popover",
    "text-popover-foreground",
    "rounded-lg",
    "border",
    "shadow-pop",
  ];
  const OLD_LOOK = [
    "rounded-md",
    "shadow-md",
    "shadow-lg",
    "bg-primary",
    "text-primary-foreground",
  ];

  it.each([
    ["a menu", insidePortal(DropdownMenuContent({}))],
    ["a submenu", DropdownMenuSubContent({})],
    ["a tooltip", insidePortal(TooltipContent({}))],
    ["a popover", insidePortal(PopoverContent({}))],
    ["a select list", insidePortal(SelectContent({}))],
  ])("gives %s the popover surface", (_name, element) => {
    const classes = classNamesOf(element);

    for (const name of SURFACE) {
      expect(classes).toContain(name);
    }
    for (const old of OLD_LOOK) {
      expect(classes).not.toContain(old);
    }
  });

  it("sets a tooltip in 13 px text, with room around it", () => {
    const classes = classNamesOf(insidePortal(TooltipContent({})));

    expect(classes).toContain("text-meta");
    expect(classes).toContain("px-3");
    expect(classes).toContain("py-2");
  });

  it("does not balance the lines of a tooltip: the box would be wider than its text", () => {
    const classes = classNamesOf(insidePortal(TooltipContent({})));

    expect(classes).not.toContain("text-balance");
    expect(classes).toContain("text-pretty");
  });

  it("pads a popover for free content, and keeps its width", () => {
    const classes = classNamesOf(insidePortal(PopoverContent({})));

    expect(classes).toContain("p-4");
    expect(classes).toContain("w-72");
  });

  it("pads a menu so its rows sit inside the radius", () => {
    expect(classNamesOf(insidePortal(DropdownMenuContent({})))).toContain("p-1");
  });

  // Radix tells each layer the height the screen leaves it. A submenu that
  // clipped instead of scrolling, with a long list in it, made the rows below
  // the fold unreachable on a short screen.
  it.each([
    ["a menu", insidePortal(DropdownMenuContent({}))],
    ["a submenu", DropdownMenuSubContent({})],
  ])("keeps %s within the height the screen leaves it, and scrolls inside it", (_name, element) => {
    const classes = classNamesOf(element);

    expect(classes).toContain("max-h-(--radix-dropdown-menu-content-available-height)");
    expect(classes).toContain("overflow-y-auto");
    expect(classes).toContain("overflow-x-hidden");
    // `overflow-hidden` would clip the rows that do not fit, on both axes.
    expect(classes).not.toContain("overflow-hidden");
  });

  it("writes a menu label in muted 13 px text, like the label of a select", () => {
    const classes = classNamesOf(DropdownMenuLabel({}));

    expect(classes).toContain("text-meta");
    expect(classes).toContain("text-ink-muted");
  });

  it("draws the separator in the hairline color", () => {
    expect(classNamesOf(DropdownMenuSeparator({}))).toContain("bg-hairline");
  });
});

// popover-styles.ts promises one place for the surface of the layers that float
// above the page: a theme changes it there, and each of them follows.
describe("popover-styles.ts, the one place of the floating surface", () => {
  const uiDir = resolve(import.meta.dirname, "../../../src/shared/components/ui");

  it.each(["dropdown-menu", "select", "tooltip", "popover"])(
    "%s.tsx takes its surface from popoverSurface, not from classes of its own",
    (name) => {
      const source = readFileSync(resolve(uiDir, `${name}.tsx`), "utf-8");

      expect(source).toMatch(/\bpopoverSurface\b/);
      expect(source).not.toMatch(/"[^"]*\bbg-popover\b[^"]*"/);
    },
  );
});

describe("menu rows", () => {
  const ROWS = [
    ["a menu item", DropdownMenuItem({})],
    ["a checkbox item", DropdownMenuCheckboxItem({})],
    ["a radio item", DropdownMenuRadioItem({ value: "a" })],
    ["a submenu trigger", DropdownMenuSubTrigger({})],
    ["a select item", SelectItem({ value: "a" })],
  ] as const;

  // A highlighted row (the pointer or the keyboard puts the focus on it) is
  // tinted and ringed: a 2 px ring drawn inside it, as the tint alone is 1.2:1
  // against the list. The system ring, a shadow outside the row, is turned off:
  // the list would clip it, and it would double the ring inside.
  const HIGHLIGHT = [
    "focus:bg-accent",
    "focus:text-accent-foreground",
    "focus:outline-solid",
    "focus:outline-2",
    "focus:-outline-offset-2",
    "focus:outline-ring",
    "focus:shadow-none",
  ];
  const destructive = DropdownMenuItem({ variant: "destructive" });

  it.each(ROWS)("makes %s 40 px high, at body size", (_name, element) => {
    const classes = classNamesOf(element);

    expect(classes).toContain("min-h-10");
    expect(classes).toContain("text-body");
    expect(classes).toContain("rounded-md");
  });

  it.each(ROWS)(
    "highlights %s with more than a background: a ring inside it",
    (_name, element) => {
      const classes = classNamesOf(element);

      for (const name of HIGHLIGHT) {
        expect(classes).toContain(name);
      }
    },
  );

  it("gives a menu and a select the same highlight", () => {
    const highlightOf = (element: JSX.Element) =>
      classNamesOf(element)
        .filter((name) => name.startsWith("focus"))
        .sort();

    expect(highlightOf(DropdownMenuItem({}))).toEqual(
      highlightOf(SelectItem({ value: "a" })),
    );
    expect(highlightOf(DropdownMenuItem({}))).toEqual([...HIGHLIGHT].sort());
  });

  it("keeps the ring inside the row, where the list cannot clip it, and not on a keyboard-only condition", () => {
    for (const [, element] of ROWS) {
      const classes = classNamesOf(element);

      expect(classes).toContain("focus:-outline-offset-2");
      // The system ring, and a ring that engines show for the keyboard only
      // (Radix moves the focus by script on hover too): neither.
      expect(classes).not.toContain("focus-visible:focus-ring");
      expect(classes.filter((name) => name.startsWith("focus-visible:"))).toEqual(
        [],
      );
    }
  });

  it.each(ROWS)("keeps the data-slot of %s", (_name, element) => {
    expect(propsOf(element)["data-slot"]).toMatch(/^(dropdown-menu-|select-)/);
  });

  it("writes a destructive item in the danger text color, never in the destructive one", () => {
    const classes = classNamesOf(destructive);

    expect(propsOf(destructive)["data-variant"]).toBe("destructive");
    expect(classes).toContain("data-[variant=destructive]:text-danger-text");
    expect(classes).toContain(
      "data-[variant=destructive]:focus:text-danger-text",
    );
    expect(classes).not.toContain("data-[variant=destructive]:text-destructive");
  });

  it("tints a highlighted destructive item, and rings it in danger", () => {
    const classes = classNamesOf(destructive);

    expect(classes).toContain(
      "data-[variant=destructive]:focus:bg-destructive/10",
    );
    expect(classes).toContain(
      "dark:data-[variant=destructive]:focus:bg-destructive/20",
    );
    expect(classes).toContain(
      "data-[variant=destructive]:[--focus-ring:var(--danger)]",
    );
  });

  it("is a default item unless told otherwise", () => {
    expect(propsOf(DropdownMenuItem({}))["data-variant"]).toBe("default");
  });
});

describe("tabs", () => {
  const html = renderWithIntl(
    <Tabs defaultValue="overview">
      <TabsList aria-label="Sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="activity">Activity panel</TabsContent>
    </Tabs>,
  );
  const list =
    startTags(html, "div").find((tag) => tag.includes('role="tablist"')) ?? "";
  const triggers = startTags(html, "button");

  it("is a tab list", () => {
    expect(html).toContain('role="tablist"');
    expect(attribute(list, "aria-label")).toBe("Sections");
  });

  it("makes one tab per trigger and selects the first", () => {
    expect(triggers.map((tag) => attribute(tag, "role"))).toEqual([
      "tab",
      "tab",
    ]);
    expect(triggers.map((tag) => attribute(tag, "aria-selected"))).toEqual([
      "true",
      "false",
    ]);
  });

  it("shows the panel of the selected tab", () => {
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Overview panel");
  });

  it("writes an active tab in ink and an inactive one in muted ink", () => {
    const classes = classesOf(triggers[0] ?? "");

    expect(classes).toContain("text-ink-muted");
    expect(classes).toContain("data-[state=active]:text-ink");
  });

  it("draws the active line in the brand color, at the bottom of the tab", () => {
    const classes = classesOf(triggers[0] ?? "");

    expect(classes).toContain("after:absolute");
    // Inside the tab: a scrolling list clips what sticks out of it.
    expect(classes).toContain("after:bottom-0");
    expect(classes).not.toContain("after:-bottom-px");
    expect(classes).toContain("after:h-0.5");
    expect(classes).toContain("after:bg-brand");
    expect(classes).toContain("after:opacity-0");
    expect(classes).toContain("data-[state=active]:after:opacity-100");
  });

  it("keeps the active line in forced-colors mode, which replaces every background but a system color", () => {
    const classes = classesOf(triggers[0] ?? "");

    expect(classes).toContain("forced-colors:after:bg-[color:Highlight]");
  });

  it("makes each tab 44 px high", () => {
    expect(classesOf(triggers[0] ?? "")).toContain("h-11");
  });

  it("keeps the focus ring inside the tab: the list scrolls, and a scrolling box clips a ring drawn outside", () => {
    const classes = classesOf(triggers[0] ?? "");

    for (const name of [
      "focus-visible:outline-solid",
      "focus-visible:outline-2",
      "focus-visible:-outline-offset-2",
      "focus-visible:outline-ring",
      // The system ring is a shadow outside the tab, which the base styles give to every button.
      "focus-visible:shadow-none",
    ]) {
      expect(classes).toContain(name);
    }
    expect(classes).not.toContain("focus-visible:focus-ring");
  });

  it("never shrinks a tab: a long label keeps its width, and the list scrolls sideways", () => {
    expect(classesOf(triggers[0] ?? "")).toContain("shrink-0");
    expect(classesOf(list)).toContain("overflow-x-auto");
  });

  it("draws the hairline of the list inside its scroll box, where the overflow cannot clip it", () => {
    const classes = classesOf(list);

    expect(classes).toContain("shadow-[inset_0_-1px_0_var(--hairline)]");
    expect(classes).not.toContain("border-b");
    // Forced-colors mode drops shadows: a border keeps the baseline there.
    expect(classes).toContain("forced-colors:border-b");
  });

  it("hides the scrollbar of the list: the tabs are reached by swipe, wheel and keys", () => {
    expect(classesOf(list)).toContain("[scrollbar-width:none]");
  });

  it("draws its list and its tabs from the strip it shares with the route tabs, so that the two look alike", () => {
    // Static markup writes `&`, `>` and `'` of a class as entities.
    const decoded = (classes: string[]) =>
      classes.map((name) =>
        name
          .replaceAll("&amp;", "&")
          .replaceAll("&gt;", ">")
          .replaceAll("&#x27;", "'"),
      );

    expect(decoded(classesOf(list))).toEqual(
      expect.arrayContaining(tokens(tabStripStyles)),
    );
    expect(decoded(classesOf(triggers[0] ?? ""))).toEqual(
      expect.arrayContaining(tokens(tabStyles)),
    );
  });

  it("has dropped the pill look", () => {
    for (const old of ["bg-muted", "h-9", "p-1", "rounded-lg"]) {
      expect(classesOf(list)).not.toContain(old);
    }
    for (const old of [
      "data-[state=active]:bg-background",
      "data-[state=active]:shadow-sm",
    ]) {
      expect(classesOf(triggers[0] ?? "")).not.toContain(old);
    }
  });
});

describe("confirm dialog", () => {
  it("confirms in red for a danger, and in the primary color otherwise", () => {
    expect(confirmVariant("danger")).toBe("destructive");
    expect(confirmVariant("neutral")).toBe("default");
    expect(confirmVariant()).toBe("default");
  });

  it("announces a danger as an alert dialog, and anything else as a dialog", () => {
    expect(confirmRole("danger")).toBe("alertdialog");
    expect(confirmRole("neutral")).toBe("dialog");
    expect(confirmRole()).toBe("dialog");
  });

  describe("confirmThenClose", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** Runs it with a log of what the dialog is told, in order. */
    function run(onConfirm: () => void | Promise<void>) {
      const events: string[] = [];
      const done = confirmThenClose(onConfirm, {
        setPending: (pending) => events.push(`pending:${pending}`),
        close: () => events.push("close"),
        errorMessage: "Something went wrong",
      });
      return { events, done };
    }

    it("waits for the promise: pending at once, closed only when it is fulfilled", async () => {
      let release = () => {};
      const { events, done } = run(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );

      expect(events).toEqual(["pending:true"]);
      await Promise.resolve();
      expect(events).toEqual(["pending:true"]);

      release();
      await done;
      expect(events).toEqual(["pending:true", "close", "pending:false"]);
    });

    it("closes after a callback that is not a promise", async () => {
      const { events, done } = run(() => undefined);

      await done;
      expect(events).toEqual(["pending:true", "close", "pending:false"]);
    });

    it("stays open when the promise rejects, stops waiting, and shows an error toast", async () => {
      const { events, done } = run(() => Promise.reject(new Error("Network")));

      // The rejection is handled here: nothing is left unhandled.
      await expect(done).resolves.toBeUndefined();
      expect(events).toEqual(["pending:true", "pending:false"]);
      expect(sonnerToast.error).toHaveBeenCalledTimes(1);
      expect(sonnerToast.error).toHaveBeenCalledWith(
        "Something went wrong",
        expect.objectContaining({ duration: Infinity, closeButton: true }),
      );
    });

    // `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
    // gone, the role is too low): a dialog that stayed open with "something went wrong" would hold a person who is on
    // their way to sign in, and the error reporter would hear of it.
    it.each(FRAMEWORK_ERRORS)("hands on %s: the dialog does not stay open with an error toast, nothing is reported, and the wait ends", async (_, framework) => {
      const report = vi.fn();
      vi.stubGlobal("reportError", report);
      const { events, done } = run(() => Promise.reject(framework));

      expect(await outcomeOf(done)).toBe(framework);
      expect(events).toEqual(["pending:true", "pending:false"]);
      expect(sonnerToast.error).not.toHaveBeenCalled();
      expect(report).not.toHaveBeenCalled();
    });

    it("does the same when the callback throws", async () => {
      const { events, done } = run(() => {
        throw new Error("Boom");
      });

      await expect(done).resolves.toBeUndefined();
      expect(events).toEqual(["pending:true", "pending:false"]);
      expect(sonnerToast.error).toHaveBeenCalledWith(
        "Something went wrong",
        expect.anything(),
      );
    });

    it("still reports the error to the app, so that the error reporter hears it", async () => {
      const report = vi.fn();
      vi.stubGlobal("reportError", report);
      const error = new Error("Network");

      await run(() => Promise.reject(error)).done;

      expect(report).toHaveBeenCalledWith(error);
    });

    it("says nothing when the confirmation is fulfilled", async () => {
      const report = vi.fn();
      vi.stubGlobal("reportError", report);

      await run(() => Promise.resolve()).done;
      await run(() => undefined).done;

      expect(sonnerToast.error).not.toHaveBeenCalled();
      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("whileConfirming", () => {
    function changes(pending: boolean, next: boolean) {
      const seen: boolean[] = [];
      whileConfirming(pending, (open) => seen.push(open))(next);
      return seen;
    }

    it("holds back every way to close the dialog while the confirmation runs", () => {
      expect(changes(true, false)).toEqual([]);
    });

    it("lets the dialog close when nothing is pending", () => {
      expect(changes(false, false)).toEqual([false]);
    });

    it("lets the dialog open, pending or not", () => {
      expect(changes(true, true)).toEqual([true]);
      expect(changes(false, true)).toEqual([true]);
    });
  });

  describe("confirmationReady", () => {
    it("is ready at once when no text is required", () => {
      expect(confirmationReady("", undefined)).toBe(true);
      expect(confirmationReady("anything", undefined)).toBe(true);
    });

    it("takes an empty required text for none: there is nothing to type", () => {
      expect(confirmationReady("", "")).toBe(true);
    });

    it("is ready once the field holds the required text, and not before", () => {
      expect(confirmationReady("", "DELETE")).toBe(false);
      expect(confirmationReady("DELET", "DELETE")).toBe(false);
      expect(confirmationReady("DELETE", "DELETE")).toBe(true);
    });

    it("compares the text as it was typed: case counts, and a space is not dropped", () => {
      expect(confirmationReady("delete", "DELETE")).toBe(false);
      expect(confirmationReady("DELETE ", "DELETE")).toBe(false);
      expect(confirmationReady(" DELETE", "DELETE")).toBe(false);
    });

    it("reads a name with spaces and accents as it is written", () => {
      expect(confirmationReady("Studio Nord", "Studio Nord")).toBe(true);
      expect(confirmationReady("Studio  Nord", "Studio Nord")).toBe(false);
      expect(confirmationReady("Équipe", "Équipe")).toBe(true);
      expect(confirmationReady("Equipe", "Équipe")).toBe(false);
    });
  });

  describe("typed confirmation", () => {
    /**
     * What the dialog hands to its DialogContent, drawn inside a dialog so that
     * the parts of Radix find their context. The content sits in a portal,
     * which static markup never reaches: this is where it can be read.
     */
    function drawn(
      props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
      locale: "en" | "fr" = "en",
    ) {
      vi.mocked(DialogContent).mockClear();
      renderWithIntl(
        <ConfirmDialog
          open
          onOpenChange={() => undefined}
          title="Delete your account?"
          confirmLabel="Delete account"
          onConfirm={() => undefined}
          {...props}
        />,
        locale,
      );
      const passed = vi.mocked(DialogContent).mock.calls[0]?.[0];

      return renderWithIntl(<Dialog open>{passed?.children}</Dialog>, locale);
    }

    /** The start tag of the button that carries this label. */
    function buttonLabelled(html: string, label: string): string {
      return (
        new RegExp(`<button[^>]*>${label}</button>`).exec(html)?.[0] ?? ""
      );
    }

    it("waits for the typed confirmation", () => {
      const html = drawn({ requireText: "DELETE" });
      const label = /<label[^>]*\sfor="([^"]+)"[^>]*>([^<]*)<\/label>/.exec(html);
      const input = startTags(html, "input")[0] ?? "";

      expect(label?.[2]).toBe("Type DELETE to confirm");
      expect(attribute(input, "id")).toBe(label?.[1]);
      expect(attribute(input, "value")).toBe("");
      expect(attribute(buttonLabelled(html, "Delete account"), "disabled")).toBe(
        "",
      );
    });

    it("asks nothing without a required text: no field, and a button that is ready", () => {
      const html = drawn();

      expect(startTags(html, "input")).toHaveLength(0);
      expect(html).not.toContain("<label");
      expect(
        attribute(buttonLabelled(html, "Delete account"), "disabled"),
      ).toBeUndefined();
    });

    it("takes an empty required text for none", () => {
      const html = drawn({ requireText: "" });

      expect(startTags(html, "input")).toHaveLength(0);
      expect(
        attribute(buttonLabelled(html, "Delete account"), "disabled"),
      ).toBeUndefined();
    });

    it("words the field in the language of the page, with the text to type", () => {
      const html = drawn({ requireText: "DELETE" }, "fr");

      expect(html).toContain(">Saisissez DELETE pour confirmer</label>");
    });

    it("asks for a name as it is written, whatever it holds", () => {
      const html = drawn({ requireText: "Studio {Nord} & Co" });

      expect(html).toContain(">Type Studio {Nord} &amp; Co to confirm</label>");
    });

    it("leaves the keyboard's guesses off the field: there is nothing to correct, capitalize or complete", () => {
      const input = startTags(drawn({ requireText: "DELETE" }), "input")[0] ?? "";

      // Static markup keeps the camel case of the props: a browser reads
      // attribute names without regard to case.
      expect(attribute(input, "autoComplete")).toBe("off");
      expect(attribute(input, "autoCapitalize")).toBe("off");
      expect(attribute(input, "autoCorrect")).toBe("off");
      expect(attribute(input, "spellCheck")).toBe("false");
    });

    it("keeps Cancel within reach while the confirmation waits", () => {
      const html = drawn({ requireText: "DELETE" });

      expect(
        attribute(buttonLabelled(html, en.common.cancel), "disabled"),
      ).toBeUndefined();
    });

    it("keeps the red of a danger on the button that waits", () => {
      const html = drawn({ requireText: "DELETE", tone: "danger" });
      const tag = buttonLabelled(html, "Delete account");

      expect(classesOf(tag)).toContain("bg-destructive");
      expect(attribute(tag, "disabled")).toBe("");
    });
  });
});

describe("tab strip", () => {
  /** An element that is `left` to `right` on the screen. */
  function boxAt(left: number, right: number) {
    return {
      getBoundingClientRect: () => ({ left, right, width: right - left }),
    };
  }

  /** A strip that is 0 to 300 on the screen, and records how it is scrolled. */
  function strip(items: unknown[] = []) {
    const scrollBy = vi.fn();
    const querySelector = vi.fn();
    for (const item of items) {
      querySelector.mockReturnValueOnce(item);
    }
    return Object.assign(boxAt(0, 300), { scrollBy, querySelector });
  }

  describe("revealInStrip", () => {
    const reveal = (
      item: ReturnType<typeof boxAt>,
      behavior?: ScrollBehavior,
    ) => {
      const box = strip();
      revealInStrip(
        box as unknown as HTMLElement,
        item as unknown as HTMLElement,
        behavior,
      );
      return box.scrollBy;
    };

    it("leaves the strip alone when the tab shows in full", () => {
      expect(reveal(boxAt(20, 120))).not.toHaveBeenCalled();
      expect(reveal(boxAt(0, 300))).not.toHaveBeenCalled();
    });

    it("scrolls back by what a tab cut off at the start hides", () => {
      expect(reveal(boxAt(-40, 60))).toHaveBeenCalledWith({
        left: -40,
        behavior: "auto",
      });
    });

    it("scrolls on by what a tab cut off at the end hides", () => {
      expect(reveal(boxAt(240, 340))).toHaveBeenCalledWith({
        left: 40,
        behavior: "auto",
      });
    });

    it("scrolls sideways only: the page and the strip's other ancestors stay where they are", () => {
      const calls = reveal(boxAt(240, 340)).mock.calls;

      expect(Object.keys(calls[0]?.[0] as object).sort()).toEqual([
        "behavior",
        "left",
      ]);
    });

    it("takes the behavior it is given", () => {
      expect(reveal(boxAt(240, 340), "smooth")).toHaveBeenCalledWith({
        left: 40,
        behavior: "smooth",
      });
    });

    it("lines up the start of a tab wider than the strip, and never hides it", () => {
      expect(reveal(boxAt(20, 420))).toHaveBeenCalledWith({
        left: 20,
        behavior: "auto",
      });
      expect(reveal(boxAt(-20, 420))).toHaveBeenCalledWith({
        left: -20,
        behavior: "auto",
      });
    });

    it("moves on the screen's own left and right, so that a right-to-left page works the same", () => {
      // The strip is at 100 to 400: the tab is cut off at its physical left.
      const box = Object.assign(boxAt(100, 400), { scrollBy: vi.fn() });
      revealInStrip(
        box as unknown as HTMLElement,
        boxAt(60, 160) as unknown as HTMLElement,
      );

      expect(box.scrollBy).toHaveBeenCalledWith({ left: -40, behavior: "auto" });
    });
  });

  describe("watchActiveTab", () => {
    const observers: {
      callback: MutationCallback;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }[] = [];

    class FakeObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(public callback: MutationCallback) {
        observers.push(this);
      }
    }

    beforeEach(() => {
      observers.length = 0;
      vi.stubGlobal("MutationObserver", FakeObserver);
      vi.stubGlobal("matchMedia", () => ({ matches: false }));
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const watch = (
      box: ReturnType<typeof strip>,
      active: Parameters<typeof watchActiveTab>[1] = activeTab,
    ) => watchActiveTab(box as unknown as HTMLElement, active);

    it("names what marks the active tab of a list, and the active link of a nav", () => {
      expect(activeTab).toEqual({
        attribute: "data-state",
        selector: '[data-state="active"]',
      });
      expect(activeLink).toEqual({
        attribute: "aria-current",
        selector: '[aria-current="page"]',
      });
    });

    it("brings the active tab into view when it starts, without an animation", () => {
      const box = strip([boxAt(240, 340)]);

      watch(box);

      expect(box.querySelector).toHaveBeenCalledWith('[data-state="active"]');
      expect(box.scrollBy).toHaveBeenCalledTimes(1);
      expect(box.scrollBy).toHaveBeenCalledWith({ left: 40, behavior: "auto" });
    });

    it("brings the tab into view again each time the active one changes, with a glide", () => {
      const box = strip([boxAt(20, 120), boxAt(-60, 40)]);

      watch(box);
      expect(box.scrollBy).not.toHaveBeenCalled();

      observers[0]?.callback([], observers[0] as unknown as MutationObserver);

      expect(box.scrollBy).toHaveBeenCalledTimes(1);
      expect(box.scrollBy).toHaveBeenCalledWith({
        left: -60,
        behavior: "smooth",
      });
    });

    it("does not glide for someone who asks for less motion", () => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
      }));
      const box = strip([boxAt(20, 120), boxAt(240, 340)]);

      watch(box);
      observers[0]?.callback([], observers[0] as unknown as MutationObserver);

      expect(box.scrollBy).toHaveBeenCalledWith({ left: 40, behavior: "auto" });
    });

    it("watches the whole strip for a change of the mark, and nothing else", () => {
      const box = strip();

      watch(box);

      expect(observers).toHaveLength(1);
      expect(observers[0]?.observe).toHaveBeenCalledWith(box, {
        attributes: true,
        attributeFilter: ["data-state"],
        subtree: true,
      });
    });

    it("watches the mark it is told, as the route tabs mark theirs", () => {
      const box = strip();

      watch(box, activeLink);

      expect(box.querySelector).toHaveBeenCalledWith('[aria-current="page"]');
      expect(observers[0]?.observe).toHaveBeenCalledWith(box, {
        attributes: true,
        attributeFilter: ["aria-current"],
        subtree: true,
      });
    });

    it("does nothing while no tab is active", () => {
      const box = strip([null, null]);

      watch(box);
      observers[0]?.callback([], observers[0] as unknown as MutationObserver);

      expect(box.scrollBy).not.toHaveBeenCalled();
    });

    it("stops watching when it is told to, as the strip goes away", () => {
      const stop = watch(strip());

      expect(observers[0]?.disconnect).not.toHaveBeenCalled();
      stop();
      expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("the sources", () => {
    const read = (file: string) =>
      readFileSync(
        resolve(import.meta.dirname, "../../../src/shared/components/ui", file),
        "utf-8",
      );

    it.each(["tabs.tsx", "tab-links.tsx"])(
      "%s watches its active tab with the watcher of tab-strip.ts",
      (file) => {
        const source = read(file);

        expect(source).toContain('from "@/shared/components/ui/tab-strip"');
        expect(source).toContain("watchActiveTab(");
      },
    );

    it.each(["tabs.tsx", "tab-links.tsx"])(
      "%s is a client component, as it reaches into the DOM",
      (file) => {
        expect(read(file).startsWith('"use client"')).toBe(true);
      },
    );
  });
});

describe("toasts over a modal", () => {
  // A toast sits outside the dialog it reports on: for Radix, a click on its
  // close button is a click outside, which would close the dialog and lose what
  // the user typed. A modal ignores the clicks that land in the toaster.
  type Target = { closest: (selector: string) => unknown } | null;
  const inToast: Target = {
    closest: (selector) => (selector === "[data-sonner-toaster]" ? {} : null),
  };
  const elsewhere: Target = { closest: () => null };

  /** What Radix hands to `onInteractOutside`, as far as the guard reads it. */
  function outsideEvent(target: Target) {
    return { target: target as EventTarget | null, preventDefault: vi.fn() };
  }

  describe("keepToastClicks", () => {
    it("keeps the modal open when the click lands in a toast", () => {
      const event = outsideEvent(inToast);

      keepToastClicks(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it("lets a click anywhere else close it", () => {
      const event = outsideEvent(elsewhere);

      keepToastClicks(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("lets an event with no element behind it through", () => {
      for (const target of [null, {} as Target]) {
        const event = outsideEvent(target);

        keepToastClicks(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
      }
    });
  });

  describe("ignoringToasts", () => {
    it("keeps the modal open when the click lands in a toast, with no handler of the caller", () => {
      const event = outsideEvent(inToast);

      ignoringToasts()(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it("lets a click anywhere else close it", () => {
      const event = outsideEvent(elsewhere);

      ignoringToasts()(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("runs the handler of the caller for a click in a toast and for any other, with the same event", () => {
      const caller = vi.fn();
      const handler = ignoringToasts(caller);
      const inside = outsideEvent(inToast);
      const outside = outsideEvent(elsewhere);

      handler(inside);
      handler(outside);

      expect(caller).toHaveBeenCalledTimes(2);
      expect(caller).toHaveBeenNthCalledWith(1, inside);
      expect(caller).toHaveBeenNthCalledWith(2, outside);
      // The guard still does its part next to the caller.
      expect(inside.preventDefault).toHaveBeenCalledTimes(1);
      expect(outside.preventDefault).not.toHaveBeenCalled();
    });

    it("respects a caller that keeps the modal open itself: it is not undone, and not doubled", () => {
      const caller = vi.fn((event: { preventDefault: () => void }) => {
        event.preventDefault();
      });
      const event = outsideEvent(elsewhere);

      ignoringToasts(caller)(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });
  });

  describe("the content of a modal", () => {
    const MODALS = [
      ["a dialog", dialogContent],
      ["a sheet", sheetContent],
    ] as const;

    /** The `onInteractOutside` a content hands to Radix. */
    const handlerOf = (content: JSX.Element) =>
      propsOf(content).onInteractOutside as (
        event: ReturnType<typeof outsideEvent>,
      ) => void;

    it.each(MODALS)(
      "keeps %s open when the click lands in a toast, by default",
      (_name, make) => {
        const event = outsideEvent(inToast);

        handlerOf(make())(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
      },
    );

    it.each(MODALS)(
      "lets a click anywhere else close %s",
      (_name, make) => {
        const event = outsideEvent(elsewhere);

        handlerOf(make())(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
      },
    );

    it.each(MODALS)(
      "still runs the onInteractOutside of the caller on %s, and keeps the guard",
      (_name, make) => {
        const caller = vi.fn();
        const content = make({ onInteractOutside: caller });
        const inside = outsideEvent(inToast);
        const outside = outsideEvent(elsewhere);

        handlerOf(content)(inside);
        handlerOf(content)(outside);

        expect(caller).toHaveBeenCalledTimes(2);
        expect(caller).toHaveBeenCalledWith(inside);
        expect(caller).toHaveBeenCalledWith(outside);
        expect(inside.preventDefault).toHaveBeenCalledTimes(1);
        expect(outside.preventDefault).not.toHaveBeenCalled();
      },
    );

    it("keeps a confirm dialog open on a click in a toast: it draws a DialogContent, which applies the guard", () => {
      vi.mocked(DialogContent).mockClear();
      renderWithIntl(
        <ConfirmDialog
          open
          onOpenChange={() => undefined}
          title="Delete project?"
          confirmLabel="Delete"
          onConfirm={() => undefined}
        />,
      );

      const passed = vi.mocked(DialogContent).mock.calls[0]?.[0];
      expect(passed).toBeDefined();

      const inside = outsideEvent(inToast);
      const outside = outsideEvent(elsewhere);
      handlerOf(dialogContent(passed))(inside);
      handlerOf(dialogContent(passed))(outside);

      expect(inside.preventDefault).toHaveBeenCalledTimes(1);
      expect(outside.preventDefault).not.toHaveBeenCalled();
    });

    // It has no Radix Trigger to give the focus back to, so the page that opened
    // it does, from the handler it passes: left to Radix, the focus is dropped
    // on the page body when the dialog closes.
    it("hands onCloseAutoFocus to the content, so that the page that opened it takes the focus back", () => {
      const onCloseAutoFocus = vi.fn();
      vi.mocked(DialogContent).mockClear();
      renderWithIntl(
        <ConfirmDialog
          open
          onOpenChange={() => undefined}
          title="Delete project?"
          confirmLabel="Delete"
          onConfirm={() => undefined}
          onCloseAutoFocus={onCloseAutoFocus}
        />,
      );

      expect(vi.mocked(DialogContent).mock.calls[0]?.[0].onCloseAutoFocus).toBe(onCloseAutoFocus);
    });
  });
});

describe("overlay strings", () => {
  it("has a close label and a cancel label, in both languages", () => {
    for (const locale of [en, fr]) {
      expect(locale.common.close.length).toBeGreaterThan(0);
      expect(locale.common.cancel.length).toBeGreaterThan(0);
    }
  });

  it("asks for the typed confirmation with the text to type as an argument, in both languages", () => {
    for (const locale of [en, fr]) {
      expect(locale.common.typeToConfirm).toContain("{text}");
    }
    expect(fr.common.typeToConfirm).not.toBe(en.common.typeToConfirm);
  });

  it("addresses the reader of the French confirmation as « vous »", () => {
    expect(fr.common.typeToConfirm).toMatch(/^Saisissez /);
  });
});
