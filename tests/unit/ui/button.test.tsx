import type {
  ComponentProps,
  MouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  clickWhileLoading,
  LoadingButton,
} from "@/shared/components/ui/loading-button";
import { attribute, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

const VARIANTS = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;
const SIZES = ["default", "sm", "lg", "icon", "icon-sm"] as const;

function tokens(classes: string): string[] {
  return classes.split(" ");
}

/** The classes of the first element that has any, as the browser sees them. */
function renderedClasses(html: string): string[] {
  return tokens(/class="([^"]*)"/.exec(html)?.[1] ?? "");
}

/**
 * The element a Button returns, with its type and the props it hands over.
 * Static markup keeps no handler and no component boundary, so this is where
 * the split between the server and the client can be read. Button is called
 * inside a render, so that its hook has a component to belong to.
 */
function elementOf(props: ComponentProps<typeof Button>) {
  let element: ReactElement<Record<string, unknown>> | undefined;
  function Probe() {
    element = Button(props) as ReactElement<Record<string, unknown>>;
    return null;
  }
  renderWithIntl(<Probe />);

  if (!element) {
    throw new Error("Button drew nothing");
  }
  return element;
}

const uiDir = resolve(import.meta.dirname, "../../../src/shared/components/ui");

/** A source of the primitives, whole. */
function sourceOf(file: string): string {
  return readFileSync(resolve(uiDir, file), "utf-8");
}

/** The code of a source, with no comment: what a comment says is not what the code does. */
function codeOf(file: string): string {
  return sourceOf(file).replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
}

describe("button", () => {
  describe("loading", () => {
    /** The start tag of the one button a markup draws. */
    const buttonTag = (node: ReactNode) =>
      startTags(renderWithIntl(node), "button")[0] ?? "";

    it("keeps a loading button focusable", () => {
      const tag = buttonTag(
        <Button loading loadingText="Saving">
          Save
        </Button>,
      );

      expect(attribute(tag, "disabled")).toBeUndefined();
      expect(attribute(tag, "aria-disabled")).toBe("true");
      expect(attribute(tag, "data-loading")).toBe("");
      expect(attribute(tag, "aria-busy")).toBeUndefined();
    });

    it("leaves the disabled attribute to the caller, loading or not", () => {
      expect(
        attribute(
          buttonTag(
            <Button loading disabled>
              Save
            </Button>,
          ),
          "disabled",
        ),
      ).toBe("");
      expect(
        attribute(buttonTag(<Button disabled>Save</Button>), "disabled"),
      ).toBe("");
    });

    it("keeps the type of the button, so that a submit button stays one", () => {
      const tag = buttonTag(
        <Button loading type="submit">
          Save
        </Button>,
      );

      expect(attribute(tag, "type")).toBe("submit");
    });

    describe("its click", () => {
      const clickEvent = () =>
        ({
          preventDefault: vi.fn(),
        }) as unknown as MouseEvent<HTMLButtonElement>;

      /** The handler of a loading button: there always is one, to take the click. */
      const whileLoading = (
        onClick?: (event: MouseEvent<HTMLButtonElement>) => void,
      ) => {
        const handler = clickWhileLoading(true, onClick);

        expect(handler).toBeTypeOf("function");
        return handler as NonNullable<typeof handler>;
      };

      it("is dropped while loading: the handler of the caller does not run", () => {
        const onClick = vi.fn();

        whileLoading(onClick)(clickEvent());

        expect(onClick).not.toHaveBeenCalled();
      });

      it("is cancelled while loading, so that a submit button does not send its form", () => {
        const event = clickEvent();

        whileLoading(vi.fn())(event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
      });

      it("is cancelled even when the caller has no handler: the form still waits", () => {
        const event = clickEvent();

        whileLoading()(event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
      });

      it("reaches the handler of the caller when the button is idle, untouched", () => {
        const onClick = vi.fn();

        expect(clickWhileLoading(false, onClick)).toBe(onClick);
        expect(clickWhileLoading(false, undefined)).toBeUndefined();
      });
    });

    // A Server Component renders Button, so Button must hand the page nothing
    // that a Server Component cannot hand over. A function is one: React's
    // serializer throws "Event handlers cannot be passed to Client Component
    // props" for any on[A-Z] function. The handler that holds the click of a
    // loading button is therefore made on the client, in a leaf of its own, and
    // Button only gives that leaf data. No static render can see the throw, so
    // the split itself is what these tests hold.
    describe("its split between the server and the client", () => {
      const withoutFunctions = (props: Record<string, unknown>) =>
        Object.entries(props).filter(
          ([, value]) => typeof value === "function",
        );

      it("is a module with no directive, so that a Server Component can render it and call its variants", () => {
        expect(codeOf("button.tsx")).not.toMatch(/["']use client["']/);
      });

      it("keeps the click of a loading button in a client module of its own", () => {
        expect(sourceOf("loading-button.tsx").trimStart()).toMatch(
          /^["']use client["'];?/,
        );
      });

      it("makes no handler of its own: nothing in it is an on[A-Z] attribute", () => {
        expect(codeOf("button.tsx")).not.toMatch(/\bon[A-Z]\w*\s*=\s*\{/);
      });

      it("imports the leaf, and the leaf imports nothing of the button, so that the two modules never loop", () => {
        expect(codeOf("button.tsx")).toContain(
          'from "@/shared/components/ui/loading-button"',
        );
        expect(codeOf("loading-button.tsx")).not.toContain(
          "@/shared/components/ui/button",
        );
      });

      it("stays a plain button, with no leaf and no handler, while it is not given loading", () => {
        const element = elementOf({ type: "submit", children: "Save" });

        expect(element.type).toBe("button");
        expect(element.props.onClick).toBeUndefined();
        expect(withoutFunctions(element.props)).toEqual([]);
      });

      it("hands a button that is given loading to the client leaf, loading or not", () => {
        expect(elementOf({ loading: true, children: "Save" }).type).toBe(
          LoadingButton,
        );
        expect(elementOf({ loading: false, children: "Save" }).type).toBe(
          LoadingButton,
        );
      });

      it("keeps the same element when it starts and stops loading, so that its node, and the focus that sits on it, stay", () => {
        // A different type would make React replace the node: the one who
        // pressed the button would lose the focus as the button starts to load.
        expect(elementOf({ loading: false, children: "Save" }).type).toBe(
          elementOf({ loading: true, children: "Save" }).type,
        );
      });

      it("hands the leaf data only: nothing it makes is a function", () => {
        const { props } = elementOf({
          loading: true,
          type: "submit",
          name: "save",
          "aria-label": "Save",
          className: "mt-2",
          children: "Save",
        });

        expect(withoutFunctions(props)).toEqual([]);
        expect(
          Object.keys(props).filter((name) => /^on[A-Z]/.test(name)),
        ).toEqual([]);
        expect(props.loading).toBe(true);
        expect(props.type).toBe("submit");
        expect(props["data-slot"]).toBe("button");
        expect(String(props.className)).toContain("mt-2");
      });

      it("hands the leaf the loading text and the spinner as its content, which a Server Component renders itself", () => {
        const { props } = elementOf({
          loading: true,
          loadingText: "Saving",
          children: "Save",
        });

        expect(renderWithIntl(<>{props.children as ReactNode}</>)).toContain(
          "Saving",
        );
      });

      it("is rendered by the same Button whatever the side: a client leaf in a static render is a button like any other", () => {
        const html = renderWithIntl(<Button loading>Save</Button>);

        expect(html).toMatch(/^<button /);
        expect(html).toContain('data-loading=""');
      });
    });

    describe("its client leaf", () => {
      const clickEvent = () =>
        ({
          preventDefault: vi.fn(),
        }) as unknown as MouseEvent<HTMLButtonElement>;

      /** The `<button>` the leaf returns: it has no hook, so it can be called as it is. */
      const drawn = (
        props: Partial<ComponentProps<typeof LoadingButton>> = {},
      ) =>
        LoadingButton({
          loading: true,
          children: "Save",
          ...props,
        }) as ReactElement<ComponentProps<"button">>;

      it("is a single button, the same whether it loads or not", () => {
        expect(drawn({ loading: true }).type).toBe("button");
        expect(drawn({ loading: false }).type).toBe("button");
      });

      it("holds the click while it loads: the handler of the caller does not run, and the click is cancelled", () => {
        const onClick = vi.fn();
        const event = clickEvent();

        drawn({ loading: true, onClick }).props.onClick?.(event);

        expect(onClick).not.toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
      });

      it("holds it as well when the caller has no handler, so that a submit button sends nothing", () => {
        const event = clickEvent();

        drawn({ loading: true, type: "submit" }).props.onClick?.(event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
      });

      it("hands the click to the caller once it is idle, and cancels nothing", () => {
        const onClick = vi.fn();
        const event = clickEvent();

        const { props } = drawn({ loading: false, onClick });
        props.onClick?.(event);

        expect(props.onClick).toBe(onClick);
        expect(onClick).toHaveBeenCalledWith(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
      });

      it("says it is unavailable and loading, whatever the caller says of aria-disabled", () => {
        const { props } = drawn({ loading: true, "aria-disabled": false });

        expect(props["aria-disabled"]).toBe(true);
        expect(props["data-loading" as keyof typeof props]).toBe("");
      });

      it("marks nothing while it is idle, and leaves the aria-disabled of the caller alone", () => {
        const idle = drawn({ loading: false }).props;
        const told = drawn({ loading: false, "aria-disabled": true }).props;

        expect(idle["aria-disabled"]).toBeFalsy();
        expect(idle["data-loading" as keyof typeof idle]).toBeUndefined();
        expect(told["aria-disabled"]).toBe(true);
      });

      it("is never disabled of its own, and carries no aria-busy", () => {
        const { props } = drawn({ loading: true });

        expect(props.disabled).toBeUndefined();
        expect(props["aria-busy"]).toBeUndefined();
      });

      it("keeps the other props it is given, and does not hand `loading` down to the DOM", () => {
        const { props } = drawn({
          type: "submit",
          name: "save",
          className: "mt-2",
          "data-slot": "button",
        } as Partial<ComponentProps<typeof LoadingButton>>);

        expect(props.type).toBe("submit");
        expect(props.name).toBe("save");
        expect(props.className).toBe("mt-2");
        expect(props.children).toBe("Save");
        expect("loading" in props).toBe(false);
      });
    });

    it("keeps its label and says it is loading to screen readers", () => {
      const html = renderWithIntl(<Button loading>Save</Button>);

      expect(html).toContain("Save");
      expect(html).toContain(en.common.loading);
    });

    it("says it in the language of the page", () => {
      const html = renderWithIntl(<Button loading>Enregistrer</Button>, "fr");

      expect(html).toContain(fr.common.loading);
    });

    it("swaps the label for the loading text", () => {
      const html = renderWithIntl(
        <Button loading loadingText="Saving">
          Save
        </Button>,
      );

      expect(html).toContain("Saving");
      expect(html).not.toContain("Save<");
    });

    it("does not announce itself twice when it has a loading text", () => {
      const html = renderWithIntl(
        <Button loading loadingText="Saving">
          Save
        </Button>,
      );

      expect(html).not.toContain(en.common.loading);
    });

    it("is neither loading nor disabled when idle", () => {
      const tag = buttonTag(<Button>Save</Button>);

      for (const name of [
        "aria-busy",
        "aria-disabled",
        "data-loading",
        "disabled",
      ]) {
        expect(attribute(tag, name)).toBeUndefined();
      }
    });

    it.each(["icon", "icon-sm"] as const)(
      "shows only the spinner on a %s button, and keeps its label",
      (size) => {
        const html = renderWithIntl(
          <Button size={size} loading aria-label="Refresh">
            <svg data-icon="refresh" />
            <span className="sr-only">Refresh</span>
          </Button>,
        );

        expect(html.match(/<svg/g)).toHaveLength(1);
        expect(html).not.toContain("data-icon");
        expect(html).not.toContain(">Refresh<");
        expect(html).toContain('aria-label="Refresh"');
        expect(html).toContain('data-loading=""');
        expect(html).toContain('aria-disabled="true"');
        expect(html).toContain(en.common.loading);
      },
    );

    it("speaks the loading text of an icon button, as it has no room to show it", () => {
      const html = renderWithIntl(
        <Button
          size="icon"
          loading
          loadingText="Refreshing"
          aria-label="Refresh"
        >
          <svg data-icon="refresh" />
        </Button>,
      );

      expect(html).toContain('<span class="sr-only">Refreshing</span>');
      expect(html).not.toContain(en.common.loading);
    });

    it("keeps the icon of a text button in the markup and lets data-loading hide it, so that the spinner stands in its place", () => {
      const html = renderWithIntl(
        <Button loading>
          <svg data-icon="plus" />
          Add
        </Button>,
      );

      // The spinner and the icon, which the class list hides.
      expect(html.match(/<svg/g)).toHaveLength(2);
      expect(html).toContain('data-icon="plus"');
      expect(html).toContain(">Add</button>");
      expect(tokens(buttonVariants())).toContain("data-loading:[&>svg]:hidden");
    });

    it("keeps an icon that follows the label", () => {
      const html = renderWithIntl(
        <Button loading>
          Next
          <svg data-icon="arrow" />
        </Button>,
      );

      expect(html.match(/<svg/g)).toHaveLength(2);
      expect(html).toContain('data-icon="arrow"');
    });

    it("drops the leading icon along with the label when it has a loading text", () => {
      const html = renderWithIntl(
        <Button loading loadingText="Adding">
          <svg data-icon="plus" />
          Add
        </Button>,
      );

      expect(html.match(/<svg/g)).toHaveLength(1);
      expect(html).not.toContain("data-icon");
      expect(html).toContain(">Adding</button>");
    });

    it("hides the icon an icon component draws while it is loading", () => {
      // An icon component (lucide...) is not an svg element yet: the class
      // list hides the svg it renders as a direct child.
      expect(tokens(buttonVariants())).toContain("data-loading:[&>svg]:hidden");
    });

    it("no longer keys any style off aria-busy, which a button never carries", () => {
      expect(
        tokens(buttonVariants()).filter((name) => name.includes("aria-busy")),
      ).toEqual([]);
    });

    it("never dims a loading button: it is not disabled, and nothing greys it out", () => {
      const classes = tokens(buttonVariants());

      expect(classes).toContain("disabled:opacity-50");
      expect(
        classes.filter((name) =>
          /^(?:aria-disabled|data-loading):opacity/.test(name),
        ),
      ).toEqual([]);
    });

    it("ignores loading when it renders someone else's element", () => {
      const html = renderWithIntl(
        <Button asChild loading loadingText="Saving">
          <a href="/docs">Docs</a>
        </Button>,
      );

      expect(html).toMatch(/^<a /);
      expect(html).toContain('href="/docs"');
      expect(html).toContain(">Docs</a>");
      expect(html).not.toContain('data-loading=""');
      expect(html).not.toContain("aria-disabled");
      expect(html).not.toContain("aria-busy");
      expect(html).not.toContain("Saving");
    });
  });

  describe("disabled reason", () => {
    const disabledWithReason = (
      <Button disabled disabledReason="Owners only">
        Delete
      </Button>
    );

    it("describes the button and its focusable wrapper with the reason", () => {
      const html = renderWithIntl(disabledWithReason);
      const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
      const wrapper = /<span[^>]* tabindex="0"[^>]*>/.exec(html)?.[0];
      const button = /<button[^>]*>/.exec(html)?.[0];

      expect(id).toBeTruthy();
      expect(html).toContain(
        `<span class="sr-only" id="${id}">Owners only</span>`,
      );
      expect(wrapper).toContain(`aria-describedby="${id}"`);
      expect(button).toContain(`aria-describedby="${id}"`);
    });

    it("wraps the button in a focusable span, as a disabled button takes no focus", () => {
      const html = renderWithIntl(disabledWithReason);

      expect(html).toMatch(
        /<span[^>]* tabindex="0"[^>]*><button[^>]* disabled/,
      );
    });

    it("shows nothing for a button that is enabled", () => {
      const html = renderWithIntl(
        <Button disabledReason="Owners only">Delete</Button>,
      );

      expect(html).not.toContain("aria-describedby");
      expect(html).not.toContain("tabindex");
      expect(html).not.toContain("Owners only");
    });

    it("shows nothing while the button is loading", () => {
      const html = renderWithIntl(
        <Button loading disabled disabledReason="Owners only">
          Delete
        </Button>,
      );

      expect(html).not.toContain("tabindex");
      expect(html).not.toContain("Owners only");
    });

    it("keeps the description a caller already set", () => {
      const html = renderWithIntl(
        <Button disabled disabledReason="Owners only" aria-describedby="note">
          Delete
        </Button>,
      );
      const ids = /aria-describedby="note ([^"]+)"/.exec(html)?.[1];

      expect(ids).toBeTruthy();
      expect(html).toContain(`id="${ids}"`);
    });

    it("leaves a disabled button alone when it has no reason", () => {
      const html = renderWithIntl(<Button disabled>Delete</Button>);

      expect(html).toContain('disabled=""');
      expect(html).not.toContain("tabindex");
      expect(html).not.toContain("aria-describedby");
    });
  });

  describe("rendering", () => {
    it("renders the child instead of a button with asChild", () => {
      const html = renderWithIntl(
        <Button asChild variant="outline">
          <a href="/docs">Docs</a>
        </Button>,
      );

      expect(html).toMatch(/^<a /);
      expect(renderedClasses(html)).toContain("border-input");
    });

    it.each([
      ["sm", "text-meta"],
      ["default", "text-body"],
      ["lg", "text-section"],
    ] as const)(
      "keeps the %s text size %s, whatever the color around it",
      (size, expected) => {
        const classes = renderedClasses(
          renderWithIntl(<Button size={size}>Save</Button>),
        );

        expect(classes).toContain(expected);
        expect(classes).toContain("text-primary-foreground");
      },
    );

    it("lets a caller's text size win over the one of the size", () => {
      const classes = renderedClasses(
        renderWithIntl(<Button className="text-xs">Save</Button>),
      );

      expect(classes).toContain("text-xs");
      expect(classes).not.toContain("text-body");
    });

    it("lets a caller's class win over the size", () => {
      const classes = renderedClasses(
        renderWithIntl(
          <Button size="icon" className="size-8">
            Save
          </Button>,
        ),
      );

      expect(classes).toContain("size-8");
      expect(classes).not.toContain("size-10");
    });
  });
});

describe("buttonVariants", () => {
  it("keeps the six shadcn variants, each with its own look", () => {
    const looks = VARIANTS.map((variant) => buttonVariants({ variant }));

    expect(new Set(looks).size).toBe(VARIANTS.length);
  });

  it("paints the default variant with the primary tokens", () => {
    const classes = tokens(buttonVariants({ variant: "default" }));

    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
    expect(classes).toContain("hover:bg-(--btn-primary-hover)");
    expect(classes).toContain("active:bg-(--btn-primary-active)");
    expect(classes).toContain(
      "shadow-[inset_0_-2px_0_var(--btn-primary-edge)]",
    );
    expect(classes).toContain("motion-safe:active:translate-y-(--btn-press)");
  });

  it("draws the outline variant as a bordered control on the surface", () => {
    const classes = tokens(buttonVariants({ variant: "outline" }));

    expect(classes).toContain("bg-surface");
    expect(classes).toContain("border");
    expect(classes).toContain("border-input");
  });

  it("draws the secondary variant on the secondary tokens", () => {
    const classes = tokens(buttonVariants({ variant: "secondary" }));

    expect(classes).toContain("bg-secondary");
    expect(classes).toContain("text-secondary-foreground");
  });

  it("writes the destructive label in the on-danger color, never white", () => {
    const classes = tokens(buttonVariants({ variant: "destructive" }));

    expect(classes).toContain("bg-destructive");
    expect(classes).toContain("text-destructive-foreground");
    expect(classes).not.toContain("text-white");
  });

  // theme-contrast.test.ts measures the label on these two tokens.
  it("takes the destructive hover and press colors from the --btn-danger-* tokens", () => {
    const classes = tokens(buttonVariants({ variant: "destructive" }));

    expect(classes).toContain("hover:bg-(--btn-danger-hover)");
    expect(classes).toContain("active:bg-(--btn-danger-active)");
    expect(classes.filter((name) => name.includes("color-mix"))).toEqual([]);
  });

  it.each([
    ["default", "h-10"],
    ["sm", "h-9"],
    ["lg", "h-12"],
    ["icon", "size-10"],
    ["icon-sm", "size-9"],
  ] as const)("sizes %s as %s", (size, expected) => {
    expect(tokens(buttonVariants({ size }))).toContain(expected);
  });

  it.each([
    ["default", "text-body"],
    ["sm", "text-meta"],
    ["lg", "text-section"],
    ["icon", "text-body"],
    ["icon-sm", "text-body"],
  ] as const)(
    "sets the text of size %s with the scale token %s",
    (size, expected) => {
      const classes = tokens(buttonVariants({ size }));

      expect(classes).toContain(expected);
      expect(
        classes.filter((name) => /^text-(?:xs|sm|base|lg|xl)$/.test(name)),
      ).toEqual([]);
    },
  );

  it("gives every variant and size a 44 px target and the focus ring", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        const classes = tokens(buttonVariants({ variant, size }));

        expect(classes).toContain("tap-target");
        expect(classes).toContain("focus-visible:focus-ring");
      }
    }
  });
});
