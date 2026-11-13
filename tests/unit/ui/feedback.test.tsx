import type {
  ComponentProps,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import type { Action, ToasterProps } from "sonner";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { InlineStatus } from "@/shared/components/ui/inline-status";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { ProgressBar, quotaState } from "@/shared/components/ui/progress-bar";
import {
  toast,
  TOAST_DURATION,
  Toaster,
} from "@/shared/components/ui/sonner";
import { StatusDot } from "@/shared/components/ui/status-dot";
import {
  contrastRatio,
  parseBlock,
  parseThemeBlocks,
} from "../../helpers/color";
import { findBlock } from "../../helpers/css";
import { attribute, classesOf, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The toasts are observed through sonner, which is where they are handed over.
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: vi.fn(() => null),
}));

const uiDir = resolve(import.meta.dirname, "../../../src/shared/components/ui");
const srcDir = resolve(import.meta.dirname, "../../../src");
const stylesDir = resolve(import.meta.dirname, "../../../src/styles");

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

/** The `bg-*` utilities of a class list: variants, which start otherwise, are left out. */
function backgrounds(classes: string[]): string[] {
  return classes.filter((name) => name.startsWith("bg-"));
}

/** The first svg a node draws. */
function svgOf(node: ReactNode): string {
  return startTags(renderWithIntl(<>{node}</>), "svg")[0] ?? "";
}

describe("quotaState", () => {
  it.each([
    [0, 100, "ok"],
    [79, 100, "ok"],
    [80, 100, "warning"],
    [99, 100, "warning"],
    [100, 100, "limit"],
    [120, 100, "limit"],
    [5, -1, "ok"],
    [0, -1, "ok"],
    [0, 0, "limit"],
    [3, 0, "limit"],
    // Fractional input: 2.4 of 3 is 80 %, though 2.4 / 3 is 0.7999999999999999.
    [2.4, 3, "warning"],
    [1.6, 2, "warning"],
    [0.8, 1, "warning"],
    [0.79, 1, "ok"],
    [2.3, 3, "ok"],
    // ... and 0.3 of 0.1 + 0.2 is the whole of it, though the division says 0.9999999999999999.
    [0.3, 0.1 + 0.2, "limit"],
    // Negative input is nothing used.
    [-5, 100, "ok"],
    [-Infinity, 100, "ok"],
    // Missing input is nothing used, and infinity is everything.
    [Number.NaN, 100, "ok"],
    [Number.NaN, 0, "limit"],
    [Infinity, 100, "limit"],
    // A maximum that is not a size has no limit to reach.
    [5, Number.NaN, "ok"],
    [5, Infinity, "ok"],
    [5, -Infinity, "ok"],
  ] as const)("reads %s of %s as %s", (value, max, expected) => {
    expect(quotaState(value, max)).toBe(expected);
  });

  it("takes a negative maximum for unlimited, whatever the value", () => {
    expect(quotaState(1_000_000, -1)).toBe("ok");
  });
});

describe("progress bar", () => {
  function render(props: Partial<ComponentProps<typeof ProgressBar>> = {}) {
    return renderWithIntl(
      <ProgressBar
        label="AI credits this month"
        value={0}
        max={100}
        {...props}
      />,
    );
  }
  const track = (props?: Partial<ComponentProps<typeof ProgressBar>>) =>
    slotTag(render(props), "progress-bar");
  const fill = (props?: Partial<ComponentProps<typeof ProgressBar>>) =>
    slotTag(render(props), "progress-bar-fill");

  it("is a progress bar from 0 to its maximum, named by its label", () => {
    const tag = track({ value: 82 });

    expect(attribute(tag, "role")).toBe("progressbar");
    expect(attribute(tag, "aria-valuemin")).toBe("0");
    expect(attribute(tag, "aria-valuemax")).toBe("100");
    expect(attribute(tag, "aria-valuenow")).toBe("82");
    expect(attribute(tag, "aria-label")).toBe("AI credits this month");
  });

  it("speaks the value text, which a screen reader reads in place of the figure", () => {
    const tag = track({
      label: "Projects",
      value: 12,
      max: 50,
      valueText: "12 of 50 used",
    });

    expect(attribute(tag, "aria-valuetext")).toBe("12 of 50 used");
    // The figures stay for the tools that read them: the text only adds to them.
    expect(attribute(tag, "aria-valuenow")).toBe("12");
    expect(attribute(tag, "aria-valuemax")).toBe("50");
  });

  it("says no value text unless it is given one", () => {
    expect(attribute(track({ value: 12 }), "aria-valuetext")).toBeUndefined();
  });

  it("turns a quota that is 82 of 100 into the warning color", () => {
    const html = render({ value: 82, tone: "quota" });

    expect(html).toContain('aria-valuenow="82"');
    expect(classesOf(slotTag(html, "progress-bar-fill"))).toContain(
      "bg-warning-bar",
    );
  });

  it.each([
    [0, "bg-bar"],
    [24, "bg-bar"],
    [79, "bg-bar"],
    [80, "bg-warning-bar"],
    [99, "bg-warning-bar"],
    [100, "bg-danger"],
    [120, "bg-danger"],
  ])(
    "fills a quota of %i of 100 with %s, and with no other background",
    (value, expected) => {
      expect(backgrounds(classesOf(fill({ value })))).toEqual([expected]);
    },
  );

  it("is a quota unless it is told otherwise", () => {
    expect(classesOf(fill({ value: 82 }))).toEqual(
      classesOf(fill({ value: 82, tone: "quota" })),
    );
  });

  it.each([0, 24, 82, 100, 120])(
    "fills the signature tone with the brand gradient at %i of 100, whatever the quota says",
    (value) => {
      expect(backgrounds(classesOf(fill({ value, tone: "signature" })))).toEqual(
        ["bg-signature"],
      );
    },
  );

  it("renders nothing for an unlimited quota", () => {
    expect(render({ max: -1 })).toBe("");
    expect(render({ max: -1, value: 5_000 })).toBe("");
    expect(render({ max: -1, tone: "signature" })).toBe("");
  });

  it.each([Number.NaN, Infinity, -Infinity])(
    "renders nothing when the maximum is %s: it is not a size to fill",
    (max) => {
      expect(render({ max })).toBe("");
      expect(render({ max, value: 5 })).toBe("");
      expect(render({ max, tone: "signature" })).toBe("");
    },
  );

  it("paints a value of infinity as a full bar at the limit, not as an empty one", () => {
    const html = render({ value: Infinity });
    const barFill = slotTag(html, "progress-bar-fill");

    expect(attribute(slotTag(html, "progress-bar"), "aria-valuenow")).toBe("100");
    expect(attribute(barFill, "style")).toBe("--fill:1");
    expect(backgrounds(classesOf(barFill))).toEqual(["bg-danger"]);
  });

  it.each([-Infinity, Number.NaN])(
    "paints a value of %s as an empty bar, in the color of a quota that is not used",
    (value) => {
      const html = render({ value });
      const barFill = slotTag(html, "progress-bar-fill");

      expect(attribute(slotTag(html, "progress-bar"), "aria-valuenow")).toBe("0");
      expect(attribute(barFill, "style")).toBe("--fill:0");
      expect(backgrounds(classesOf(barFill))).toEqual(["bg-bar"]);
    },
  );

  it("warns from 80 % of a fractional quota, as it does of a whole one", () => {
    expect(backgrounds(classesOf(fill({ value: 2.4, max: 3 })))).toEqual([
      "bg-warning-bar",
    ]);
    expect(backgrounds(classesOf(fill({ value: 2.3, max: 3 })))).toEqual([
      "bg-bar",
    ]);
  });

  it("reads a quota of nothing as full, and in the limit color", () => {
    const html = render({ max: 0, value: 0 });
    const bar = slotTag(html, "progress-bar");
    const barFill = slotTag(html, "progress-bar-fill");

    expect(attribute(bar, "aria-valuemax")).toBe("0");
    expect(attribute(bar, "aria-valuenow")).toBe("0");
    expect(backgrounds(classesOf(barFill))).toEqual(["bg-danger"]);
    expect(attribute(barFill, "style")).toBe("--fill:1");
  });

  it("keeps the value inside the range it announces, and the fill inside the track", () => {
    expect(attribute(track({ value: 120 }), "aria-valuenow")).toBe("100");
    expect(attribute(fill({ value: 120 }), "style")).toBe("--fill:1");
    expect(attribute(track({ value: -4 }), "aria-valuenow")).toBe("0");
    expect(attribute(fill({ value: -4 }), "style")).toBe("--fill:0");
    expect(attribute(track({ value: Number.NaN }), "aria-valuenow")).toBe("0");
    expect(attribute(fill({ value: Number.NaN }), "style")).toBe("--fill:0");
  });

  it("sizes the fill to the share used", () => {
    expect(attribute(fill({ value: 82 }), "style")).toBe("--fill:0.82");
    expect(attribute(fill({ value: 24 }), "style")).toBe("--fill:0.24");
    expect(attribute(fill({ value: 1, max: 3 }), "style")).toBe("--fill:0.3333");
  });

  it("grows the fill from its start with scaleX, not with its width", () => {
    const classes = classesOf(fill({ value: 50 }));

    expect(classes).toContain("origin-left");
    expect(classes).toContain("scale-x-(--fill)");
    expect(classes).toContain("h-full");
    expect(classes.filter((name) => name.startsWith("w-"))).toEqual([]);
  });

  it("animates the fill when it arrives: 320 ms on the expo curve, and not under reduced motion", () => {
    const classes = classesOf(fill({ value: 50 }));

    expect(classes).toContain("starting:scale-x-0");
    expect(classes).toContain("transition-transform");
    expect(classes).toContain("duration-320");
    expect(classes).toContain("ease-expo");
    expect(classes).toContain("motion-reduce:transition-none");
  });

  it("keeps the bar visible in forced-colors mode, which replaces every background but a system color", () => {
    expect(classesOf(fill({ value: 50 }))).toContain(
      "forced-colors:bg-[color:Highlight]",
    );
    expect(classesOf(track())).toContain("forced-colors:border");
  });

  it("rests on a rounded track that clips the fill", () => {
    const classes = classesOf(track());

    expect(classes).toContain("bg-track");
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("overflow-hidden");
    expect(classes).toContain("h-2");
    // The fill is cut square: scaling a rounded end would squash it.
    expect(classesOf(fill({ value: 50 }))).not.toContain("rounded-full");
  });

  it("lets a caller's class win on the track", () => {
    const classes = classesOf(track({ className: "h-3 max-w-xs" }));

    expect(classes).toContain("h-3");
    expect(classes).not.toContain("h-2");
    expect(classes).toContain("max-w-xs");
  });
});

describe("page alert", () => {
  const TONES = ["info", "success", "warning", "danger"] as const;
  const render = (
    tone: (typeof TONES)[number],
    extra: Partial<ComponentProps<typeof PageAlert>> = {},
  ) =>
    renderWithIntl(
      <PageAlert tone={tone} {...extra}>
        Your card was declined.
      </PageAlert>,
    );
  const tag = (tone: (typeof TONES)[number]) =>
    slotTag(render(tone), "page-alert");

  it.each([
    ["danger", "alert"],
    ["warning", "alert"],
    ["info", "status"],
    ["success", "status"],
  ] as const)("announces %s with the role %s", (tone, role) => {
    expect(attribute(tag(tone), "role")).toBe(role);
  });

  it("shows the message, with a title in bold when it has one", () => {
    const html = render("danger", { title: "Payment failed" });

    expect(html).toContain("Your card was declined.");
    expect(html).toMatch(/<p class="[^"]*font-semibold[^"]*">Payment failed<\/p>/);
  });

  it("draws no title element without a title", () => {
    expect(render("info")).not.toMatch(/<p[\s>]/);
  });

  it("puts the action after the message", () => {
    const html = render("warning", {
      action: <button type="button">Update card</button>,
    });

    expect(html).toContain("<button");
    expect(html.indexOf("Your card was declined.")).toBeLessThan(
      html.indexOf("Update card"),
    );
  });

  it("draws no action unless it is given one", () => {
    expect(render("info")).not.toContain("<button");
  });

  it.each([
    ["info", ["bg-brand-tint", "text-brand-tint-ink"]],
    ["success", ["bg-success-bg", "text-success-text"]],
    ["warning", ["bg-warning-bg", "text-warning-text"]],
    ["danger", ["text-danger-text"]],
  ] as const)("dresses %s in its tone tokens", (tone, expected) => {
    const classes = classesOf(tag(tone));

    for (const name of expected) {
      expect(classes).toContain(name);
    }
  });

  it("tints danger with the danger color over the surface, as there is no danger background token", () => {
    expect(
      backgrounds(classesOf(tag("danger"))).filter((name) =>
        name.startsWith("bg-[color-mix(in_oklab,var(--danger)_"),
      ),
    ).toHaveLength(1);
  });

  it.each(TONES)("gives %s one background, and an edge in its own color", (tone) => {
    const classes = classesOf(tag(tone));

    expect(backgrounds(classes)).toHaveLength(1);
    expect(classes).toContain("border");
    expect(classes).toContain("border-current/25");
  });

  it("is a card-radius block with room around its text", () => {
    const classes = classesOf(tag("info"));

    expect(classes).toContain("rounded-lg");
    expect(classes).toContain("p-4");
    expect(classes).toContain("text-body");
  });

  it("tells each tone by an icon of its own, not by color alone, hidden from assistive technology", () => {
    const ICONS = {
      info: "lucide-info",
      success: "lucide-circle-check",
      warning: "lucide-triangle-alert",
      danger: "lucide-circle-x",
    } as const;

    for (const tone of TONES) {
      const svgs = startTags(render(tone), "svg");

      expect(svgs).toHaveLength(1);
      expect(attribute(svgs[0] ?? "", "aria-hidden")).toBe("true");
      expect(classesOf(svgs[0] ?? "")).toContain(ICONS[tone]);
    }
    expect(new Set(Object.values(ICONS)).size).toBe(TONES.length);
  });

  it("puts the action beside the message by the width of the alert, not by the width of the screen", () => {
    const html = render("warning", { action: <button type="button">Fix</button> });

    expect(classesOf(slotTag(html, "page-alert"))).toContain("@container");
    expect(html).toContain("@md:grid-cols-[auto_1fr_auto]");
    expect(html).toContain("@md:col-start-3");
    expect(html).not.toMatch(/(?:^|[\s"])sm:/);
  });

  it("lets a caller's class win", () => {
    const classes = classesOf(
      slotTag(render("info", { className: "mb-6 p-6" }), "page-alert"),
    );

    expect(classes).toContain("mb-6");
    expect(classes).toContain("p-6");
    expect(classes).not.toContain("p-4");
  });
});

describe("inline status", () => {
  const STATES = ["running", "success", "error"] as const;
  const render = (state: (typeof STATES)[number]) =>
    renderWithIntl(<InlineStatus state={state}>Syncing your files</InlineStatus>);

  it.each(STATES)("is a status in the %s state, announced once", (state) => {
    const html = render(state);

    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain("Syncing your files");
  });

  it("turns a spinner while it runs, and draws no tick or cross", () => {
    const html = render("running");

    expect(html).toContain("animate-spin");
    expect(html).not.toContain("lucide-check");
    expect(html).not.toContain("lucide-x");
  });

  it("draws a tick when it succeeded", () => {
    const html = render("success");

    expect(html).toContain("lucide-check");
    expect(html).not.toContain("animate-spin");
    expect(html).not.toContain("lucide-x");
  });

  it("draws a cross when it failed", () => {
    const html = render("error");

    expect(html).toContain("lucide-x");
    expect(html).not.toContain("animate-spin");
    expect(html).not.toContain("lucide-check");
  });

  it("keeps the spinner silent: the status around it speaks, once", () => {
    const html = render("running");

    expect(html).not.toContain("sr-only");
    expect(html).not.toContain(en.common.loading);
  });

  it("hides the tick and the cross from assistive technology", () => {
    for (const state of ["success", "error"] as const) {
      const svgs = startTags(render(state), "svg");

      expect(svgs).toHaveLength(1);
      expect(attribute(svgs[0] ?? "", "aria-hidden")).toBe("true");
    }
  });

  it.each([
    ["running", "text-ink-muted"],
    ["success", "text-success-text"],
    ["error", "text-danger-text"],
  ] as const)("writes %s in %s", (state, expected) => {
    expect(classesOf(slotTag(render(state), "inline-status"))).toContain(
      expected,
    );
  });

  it("sits in a line of text", () => {
    const classes = classesOf(slotTag(render("success"), "inline-status"));

    expect(classes).toContain("inline-flex");
    expect(classes).toContain("items-center");
    expect(classes).toContain("text-meta");
  });
});

describe("status dot", () => {
  const render = (props: Partial<ComponentProps<typeof StatusDot>> = {}) =>
    renderWithIntl(<StatusDot tone="success" label="Healthy" {...props} />);
  const dot = (html: string) =>
    startTags(html, "span").find((tag) => tag.includes("rounded-full")) ?? "";

  it("says its state in words next to the dot", () => {
    const html = render();

    expect(html).toContain("Healthy");
    expect(html).not.toContain("sr-only");
  });

  it("keeps the label for screen readers when it is hidden", () => {
    expect(render({ hideLabel: true })).toContain(
      '<span class="sr-only">Healthy</span>',
    );
  });

  it("hides the dot itself from assistive technology", () => {
    expect(attribute(dot(render()), "aria-hidden")).toBe("true");
  });

  it.each([
    ["success", "bg-success"],
    ["neutral", "bg-ink-muted"],
    ["warning", "bg-warning-bar"],
    ["danger", "bg-danger"],
    ["brand", "bg-brand"],
  ] as const)("paints %s with %s, and with no other background", (tone, expected) => {
    expect(backgrounds(classesOf(dot(render({ tone }))))).toEqual([expected]);
  });

  it("is a round 8 px dot that never shrinks beside a long label", () => {
    const classes = classesOf(dot(render()));

    expect(classes).toContain("size-2");
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("shrink-0");
  });
});

describe("toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves more time for an undo than for a success, as the person has to reach the action", () => {
    toast.success("Saved");
    toast.undo("Project deleted", vi.fn());
    const [[, success], [, undo]] = vi.mocked(sonnerToast.success).mock.calls;

    expect(success?.duration).toBeGreaterThan(0);
    expect(undo?.duration).toBeGreaterThan(success?.duration ?? Infinity);
    // Neither stays for ever: the error does
    expect(undo?.duration).not.toBe(Infinity);
  });

  it("shows a success for 6 seconds", () => {
    toast.success("Saved");

    expect(sonnerToast.success).toHaveBeenCalledWith(
      "Saved",
      expect.objectContaining({ duration: 6000 }),
    );
  });

  it("keeps an error until it is closed, with a close button", () => {
    toast.error("Failed");

    expect(sonnerToast.error).toHaveBeenCalledWith(
      "Failed",
      expect.objectContaining({ duration: Infinity, closeButton: true }),
    );
  });

  it("hands an information to sonner as it is", () => {
    toast.info("A new version is available", { id: "update" });

    expect(sonnerToast.info).toHaveBeenCalledWith(
      "A new version is available",
      { id: "update" },
    );
    expect(sonnerToast.success).not.toHaveBeenCalled();
    expect(sonnerToast.error).not.toHaveBeenCalled();
  });

  it("hands the options of the caller on, and lets them win over its own", () => {
    toast.success("Saved", { id: "profile", description: "Your profile" });
    toast.success("Copied", { duration: 1500 });
    toast.error("Failed", { id: "profile" });

    expect(vi.mocked(sonnerToast.success).mock.calls[0]?.[1]).toEqual({
      id: "profile",
      description: "Your profile",
      duration: 6000,
    });
    expect(vi.mocked(sonnerToast.success).mock.calls[1]?.[1]).toEqual({
      duration: 1500,
    });
    expect(vi.mocked(sonnerToast.error).mock.calls[0]?.[1]).toEqual({
      id: "profile",
      duration: Infinity,
      closeButton: true,
    });
  });

  it("returns the id sonner gives, so that a toast can be dismissed or updated", () => {
    vi.mocked(sonnerToast.success).mockReturnValueOnce("toast-1");
    vi.mocked(sonnerToast.error).mockReturnValueOnce(7);

    expect(toast.success("Saved")).toBe("toast-1");
    expect(toast.error("Failed")).toBe(7);
  });

  describe("undo", () => {
    /** Shows an undo toast, and what it handed to sonner. */
    function undo(onUndo = vi.fn()) {
      toast.undo("Project deleted", onUndo);
      const [message, options] =
        vi.mocked(sonnerToast.success).mock.calls[0] ?? [];
      return { message, options, onUndo };
    }

    it("shows its message for 10 seconds, as a confirmation", () => {
      const { message, options } = undo();

      expect(sonnerToast.success).toHaveBeenCalledTimes(1);
      expect(message).toBe("Project deleted");
      expect(options?.duration).toBe(10000);
    });

    it("runs the callback when the action is pressed, and not before", () => {
      const { options, onUndo } = undo();

      expect(onUndo).not.toHaveBeenCalled();
      (options?.action as Action).onClick({} as ReactMouseEvent<HTMLButtonElement>);
      expect(onUndo).toHaveBeenCalledTimes(1);
      // The click event stays with sonner.
      expect(onUndo).toHaveBeenCalledWith();
    });

    it("labels the action in the language of the page", () => {
      const action = undo().options?.action as Action;

      expect(renderWithIntl(<>{action.label}</>, "en")).toBe(en.common.undo);
      expect(renderWithIntl(<>{action.label}</>, "fr")).toBe(fr.common.undo);
    });

    it("does not stay for ever, and has no close button: the action is the way out", () => {
      const { options } = undo();

      expect(options?.duration).not.toBe(Infinity);
      expect(options?.closeButton).not.toBe(true);
    });
  });
});

describe("toaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** What the Toaster hands to sonner. */
  function propsOf(
    locale: "en" | "fr" = "en",
    props: ComponentProps<typeof Toaster> = {},
  ): ToasterProps {
    renderWithIntl(<Toaster {...props} />, locale);
    const calls = vi.mocked(SonnerToaster).mock.calls;
    return calls[calls.length - 1]?.[0] ?? {};
  }
  const classNamesOf = (slot: string) => {
    const classNames = (propsOf().toastOptions?.classNames ?? {}) as Record<
      string,
      string | undefined
    >;
    return (classNames[slot] ?? "").split(" ").filter(Boolean);
  };

  it("does not use the rich colors of sonner: the tokens dress the toast", () => {
    expect(propsOf().richColors).toBeFalsy();
  });

  it("restyles the toast from scratch, as the stylesheet of sonner would win over a utility", () => {
    expect(propsOf().toastOptions?.unstyled).toBe(true);
  });

  it("keeps an information, or any toast that is neither an error nor an undo, as long as a success", () => {
    expect(propsOf().duration).toBe(TOAST_DURATION.success);
  });

  it("lets the caller place the toasts, and change what it sets", () => {
    const props = propsOf("en", { position: "top-center", duration: 3000 });

    expect(props.position).toBe("top-center");
    expect(props.duration).toBe(3000);
  });

  // On a phone the shell has a tab bar, stuck to the bottom of the screen, which a toast must not sit over: an
  // error stays until it is closed, and would hide the tabs for as long. The toaster is outside the shell, so it
  // reads the height of the bar from the token that the page carries (global.css), 0 when there is no bar.
  it("sits above the tab bar on a phone, by the token that holds its height, and a rem clear of it", () => {
    expect(propsOf().mobileOffset).toEqual({ bottom: "calc(var(--tab-bar-height, 0px) + 1rem)" });
  });

  it("lets the caller place the toasts on a phone as well", () => {
    expect(propsOf("en", { mobileOffset: 8 }).mobileOffset).toBe(8);
  });

  it("names the close button and the region in the language of the page", () => {
    expect(propsOf("en").toastOptions?.closeButtonAriaLabel).toBe(
      en.common.close,
    );
    expect(propsOf("fr").toastOptions?.closeButtonAriaLabel).toBe(
      fr.common.close,
    );
    expect(propsOf("en").containerAriaLabel).toBe(en.common.notifications);
    expect(propsOf("fr").containerAriaLabel).toBe(fr.common.notifications);
  });

  it("reads its labels from common alone, which a project keeps when it drops the notifications feature", () => {
    renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        messages={{ common: en.common }}
        timeZone="UTC"
      >
        <Toaster />
      </NextIntlClientProvider>,
    );
    const calls = vi.mocked(SonnerToaster).mock.calls;
    const props: ToasterProps = calls[calls.length - 1]?.[0] ?? {};

    expect(props.containerAriaLabel).toBe(en.common.notifications);
    expect(props.toastOptions?.closeButtonAriaLabel).toBe(en.common.close);
  });

  // Item 3: what the caller passes is merged, not substituted
  it("keeps what it sets when the caller passes toastOptions of its own", () => {
    const props = propsOf("fr", {
      toastOptions: { duration: 2000, className: "extra" },
    });

    expect(props.toastOptions?.unstyled).toBe(true);
    expect(props.toastOptions?.closeButtonAriaLabel).toBe(fr.common.close);
    expect(props.toastOptions?.duration).toBe(2000);
    expect(props.toastOptions?.className).toBe("extra");
    expect(props.toastOptions?.classNames?.toast).toContain("bg-popover");
  });

  it("lets the caller change one of the toast options it sets", () => {
    const props = propsOf("en", {
      toastOptions: { unstyled: false, closeButtonAriaLabel: "Dismiss" },
    });

    expect(props.toastOptions?.unstyled).toBe(false);
    expect(props.toastOptions?.closeButtonAriaLabel).toBe("Dismiss");
  });

  it("merges the classNames of the caller into its own, slot by slot, and lets the caller win a conflict", () => {
    const props = propsOf("en", {
      toastOptions: {
        classNames: { toast: "rounded-xl extra", success: "mine" },
      },
    });
    const classNames = props.toastOptions?.classNames ?? {};
    const toastClasses = (classNames.toast ?? "").split(" ");

    // Kept, added, and replaced on a conflict.
    expect(toastClasses).toContain("bg-popover");
    expect(toastClasses).toContain("extra");
    expect(toastClasses).toContain("rounded-xl");
    expect(toastClasses).not.toContain("rounded-lg");
    // A slot only the caller sets, and a slot only the wrapper sets.
    expect(classNames.success).toBe("mine");
    expect(classNames.title).toContain("text-ink");
  });

  it("keeps its icons when the caller gives some of its own", () => {
    const props = propsOf("en", {
      icons: { loading: <span>wait</span>, success: null },
    });

    expect(props.icons?.loading).toBeDefined();
    expect(props.icons?.success).toBeNull();
    expect(classesOf(svgOf(props.icons?.error))).toContain("lucide-circle-x");
  });

  it("is a floating surface: popover colors, card radius, popover shadow and a hairline", () => {
    const classes = classNamesOf("toast");

    for (const name of [
      "bg-popover",
      "text-popover-foreground",
      "rounded-lg",
      "shadow-pop",
      "border",
      "font-sans",
    ]) {
      expect(classes).toContain(name);
    }
  });

  it("stays clickable while a modal dialog is open, which turns pointer events off on the page", () => {
    expect(classNamesOf("toast")).toContain("pointer-events-auto");
  });

  it("draws the focus ring of the system on the toast, over the faint one of sonner", () => {
    expect(classNamesOf("toast")).toContain("focus-visible:focus-ring!");
  });

  it("shows only the edge of the toasts stacked behind the front one", () => {
    expect(classNamesOf("toast")).toContain(
      "data-[expanded=false]:data-[front=false]:*:opacity-0",
    );
  });

  it("writes the title in ink and the description in muted ink", () => {
    expect(classNamesOf("title")).toContain("text-ink");
    expect(classNamesOf("title")).toContain("font-medium");
    expect(classNamesOf("description")).toContain("text-ink-muted");
    expect(classNamesOf("description")).toContain("text-meta");
  });

  it.each(["closeButton", "actionButton", "cancelButton"])(
    "makes the %s a 44 px target with the focus ring of the system",
    (slot) => {
      const classes = classNamesOf(slot);

      expect(classes).toContain("tap-target");
      expect(classes).toContain("focus-visible:focus-ring");
    },
  );

  it("writes the close button in muted ink, ink on hover, after the other buttons", () => {
    const classes = classNamesOf("closeButton");

    expect(classes).toContain("text-ink-muted");
    expect(classes).toContain("hover:text-ink");
    expect(classes).toContain("order-last");
  });

  it("writes the action in the brand color, before the close button", () => {
    const classes = classNamesOf("actionButton");

    expect(classes).toContain("text-brand");
    expect(classes).toContain("order-1");
    expect(classes).not.toContain("order-last");
  });

  it("draws a close icon with no text of its own", () => {
    const svg = svgOf(propsOf().icons?.close);

    expect(attribute(svg, "aria-hidden")).toBe("true");
    expect(classesOf(svg)).toContain("lucide-x");
  });

  it.each([
    ["success", "lucide-circle-check", "text-success"],
    ["error", "lucide-circle-x", "text-danger"],
    ["info", "lucide-info", "text-brand"],
    ["warning", "lucide-triangle-alert", "text-warning-bar"],
  ] as const)(
    "tells the %s toast by its %s icon in %s, not by color alone",
    (type, shape, color) => {
      const svg = svgOf(propsOf().icons?.[type]);

      expect(attribute(svg, "aria-hidden")).toBe("true");
      expect(classesOf(svg)).toContain(shape);
      expect(classesOf(svg)).toContain(color);
    },
  );
});

describe("toaster and the properties of sonner", () => {
  // Sonner defines `--success-text`, `--warning-bg`... on its own element, for
  // its rich colors. global.css hands the four that are also theme tokens
  // (`--success-bg`, `--success-text`, `--warning-bg`, `--warning-text`) back to
  // the theme, so a Badge or a PageAlert inside a toast reads the theme's
  // values. The toaster's own classes still stay off all of these names: they
  // would lean on that rule (or, for the names that are sonner's alone, on
  // nothing).
  const SHADOWED = /(?:^|[\s:])(?:bg|text|border)-(?:success|warning|info|error|normal)-(?:bg|text|border)\b/;

  it("reads none of the names that sonner defines on its own element", () => {
    renderWithIntl(<Toaster />);
    const calls = vi.mocked(SonnerToaster).mock.calls;
    const props: ToasterProps = calls[calls.length - 1]?.[0] ?? {};
    const classes = [
      ...Object.values(props.toastOptions?.classNames ?? {}),
      ...Object.values(props.icons ?? {}).flatMap((icon) =>
        classesOf(svgOf(icon)),
      ),
    ].join(" ");

    expect(classes.length).toBeGreaterThan(0);
    expect(classes).not.toMatch(SHADOWED);
  });

  it("is a rule that catches the tokens it is about", () => {
    for (const name of [
      "text-success-text",
      "bg-warning-bg",
      "hover:text-warning-text",
      "border-error-border",
    ]) {
      expect(name).toMatch(SHADOWED);
    }
    for (const name of ["text-success", "text-warning-bar", "bg-brand-tint"]) {
      expect(name).not.toMatch(SHADOWED);
    }
  });

  // What is rendered inside a toast (a Badge, a PageAlert) reads the same four
  // tokens, which sonner redefines on the toaster in its light values: the
  // toast would stay light in dark mode. The rule hands them back to the theme.
  // It sits outside any layer, like the stylesheet of sonner, and the `html`
  // in front of it makes it more specific than `[data-sonner-toaster][data-sonner-theme="light"]`.
  it("hands the four tokens that sonner redefines back to the theme, in an unlayered rule of global.css", () => {
    const rule = findBlock(
      readFileSync(resolve(stylesDir, "global.css"), "utf-8"),
      "html [data-sonner-toaster][data-sonner-theme]",
    );

    expect(rule?.properties).toEqual({
      "--success-bg": "inherit",
      "--success-text": "inherit",
      "--warning-bg": "inherit",
      "--warning-text": "inherit",
    });
  });
});

describe("toast call sites", () => {
  const sources = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => resolve(srcDir, file));

  it("has only the wrapper import sonner", () => {
    const importers = sources
      .filter((file) =>
        /\bfrom\s+["']sonner["']/.test(readFileSync(file, "utf-8")),
      )
      .map((file) => relative(srcDir, file).split(sep).join("/"));

    expect(importers).toEqual(["shared/components/ui/sonner.tsx"]);
  });

  it("mounts the toaster of the design system in the layout, without rich colors", () => {
    const layout = readFileSync(
      resolve(srcDir, "app/[locale]/layout.tsx"),
      "utf-8",
    );

    expect(layout).toContain('from "@/shared/components/ui/sonner"');
    expect(layout).not.toContain("richColors");
  });
});

describe("feedback strings", () => {
  it("has a label for the region of the toasts in both languages, in common", () => {
    expect(en.common.notifications.length).toBeGreaterThan(0);
    expect(fr.common.notifications.length).toBeGreaterThan(0);
  });

  it("has an undo label in both languages, translated rather than copied", () => {
    expect(en.common.undo.length).toBeGreaterThan(0);
    expect(fr.common.undo.length).toBeGreaterThan(0);
    expect(fr.common.undo).not.toBe(en.common.undo);
  });
});

describe("feedback sources", () => {
  const FILES = [
    "sonner",
    "page-alert",
    "inline-status",
    "status-dot",
    "progress-bar",
  ];

  it.each(FILES)(
    "%s.tsx uses the theme tokens: no raw palette color, white, black or hex",
    (name) => {
      const source = readFileSync(resolve(uiDir, `${name}.tsx`), "utf-8");

      expect(source).not.toMatch(
        /\b(?:bg|text|border|ring|fill|stroke|from|to|shadow|outline|decoration|divide|accent|caret)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/,
      );
      expect(source).not.toMatch(/#[\da-f]{3,8}\b/i);
      expect(source).not.toMatch(/\brgba?\(/);
    },
  );

  it.each(FILES)("%s.tsx never uses the destructive text color", (name) => {
    const source = readFileSync(resolve(uiDir, `${name}.tsx`), "utf-8");

    expect(source).not.toMatch(/\btext-destructive\b/);
  });

});

// theme-contrast.test.ts measures the tokens a theme provides; these are the
// pairs the feedback components put together.
describe.each([
  ["light", light],
  ["dark", { ...light, ...darkOverrides }],
])("%s theme, feedback components", (_mode, vars) => {
  const all = { ...vars, ...inline };
  const ratio = (fg: string, bg: string) =>
    contrastRatio(`var(--${fg})`, `var(--${bg})`, all);

  /** The tint of the danger alert, read from its own class and written as a theme would. */
  const dangerTint = (() => {
    const html = renderWithIntl(<PageAlert tone="danger">Declined</PageAlert>);
    const name =
      classesOf(slotTag(html, "page-alert")).find((cls) =>
        cls.startsWith("bg-[color-mix("),
      ) ?? "";
    return name
      .slice("bg-[".length, -1)
      .replaceAll("_", " ")
      .replaceAll(",", ", ");
  })();

  it.each([
    // the text of an inline status and of a status dot, on a card and on the page
    ["success-text", "surface"],
    ["success-text", "surface-sunken"],
    ["danger-text", "surface"],
    ["danger-text", "surface-sunken"],
    ["ink-muted", "surface"],
    ["ink-muted", "surface-sunken"],
    // the action of a toast, at rest and on hover, and its close button on hover
    ["brand", "surface"],
    ["brand", "brand-tint"],
    ["ink", "hairline"],
    ["ink-muted", "hairline"],
  ])("reads %s on %s at 4.5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("reads the text of a danger alert on its tint at 4.5:1", () => {
    expect(dangerTint).toMatch(/^color-mix\(in oklab, /);
    expect(
      contrastRatio("var(--danger-text)", dangerTint, all),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    // the dot of each tone, on a card and on the page
    ["success", "surface"],
    ["success", "surface-sunken"],
    ["warning-bar", "surface"],
    ["warning-bar", "surface-sunken"],
    ["danger", "surface"],
    ["danger", "surface-sunken"],
    ["brand", "surface"],
    ["brand", "surface-sunken"],
    ["ink-muted", "surface"],
    ["ink-muted", "surface-sunken"],
    // where the signature gradient starts, and where it ends, against its track
    ["brand", "track"],
    ["brand-2", "track"],
  ])("tells %s from %s at 3:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
