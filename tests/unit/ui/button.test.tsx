import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { Button, buttonVariants } from "@/shared/components/ui/button";
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

describe("button", () => {
  describe("loading", () => {
    it("is busy and disabled", () => {
      const html = renderWithIntl(<Button loading>Save</Button>);

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('disabled=""');
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

    it("is neither busy nor disabled when idle", () => {
      const html = renderWithIntl(<Button>Save</Button>);

      expect(html).not.toContain('aria-busy="');
      expect(html).not.toContain('disabled=""');
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
        expect(html).toContain('aria-busy="true"');
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

    it("replaces a leading icon with the spinner on a text button", () => {
      const html = renderWithIntl(
        <Button loading>
          <svg data-icon="plus" />
          Add
        </Button>,
      );

      expect(html.match(/<svg/g)).toHaveLength(1);
      expect(html).not.toContain("data-icon");
      expect(html).toContain(">Add</button>");
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

    it("hides the icon an icon component draws while it is busy", () => {
      // An icon component (lucide...) is not an svg element yet: the class
      // list hides the svg it renders as a direct child.
      expect(tokens(buttonVariants())).toContain("aria-busy:[&>svg]:hidden");
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
      expect(html).not.toContain('aria-busy="');
      expect(html).not.toContain("loading");
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

  // state-contrast.test.ts measures these two mixes.
  it("darkens the destructive variant on hover and press by mixing in --ink", () => {
    const classes = tokens(buttonVariants({ variant: "destructive" }));

    expect(classes).toContain(
      "hover:bg-[color-mix(in_oklab,var(--danger)_90%,var(--ink))]",
    );
    expect(classes).toContain(
      "active:bg-[color-mix(in_oklab,var(--danger)_82%,var(--ink))]",
    );
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
