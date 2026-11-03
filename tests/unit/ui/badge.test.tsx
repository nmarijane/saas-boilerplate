import { describe, expect, it } from "vitest";
import { Badge, badgeVariants } from "@/shared/components/ui/badge";
import { renderWithIntl } from "../../helpers/intl";

function tokens(classes: string): string[] {
  return classes.split(" ");
}

/** The classes of the first element that has any, as the browser sees them. */
function renderedClasses(html: string): string[] {
  return tokens(/class="([^"]*)"/.exec(html)?.[1] ?? "");
}

describe("badgeVariants", () => {
  it("tints warning with its tone tokens", () => {
    const classes = tokens(badgeVariants({ variant: "warning" }));

    expect(classes).toContain("bg-warning-bg");
    expect(classes).toContain("text-warning-text");
  });

  it("tints success with its tone tokens", () => {
    const classes = tokens(badgeVariants({ variant: "success" }));

    expect(classes).toContain("bg-success-bg");
    expect(classes).toContain("text-success-text");
  });

  it("fills brand with the brand and writes on it in the on-brand color", () => {
    const classes = tokens(badgeVariants({ variant: "brand" }));

    expect(classes).toContain("bg-brand");
    expect(classes).toContain("text-brand-on");
  });

  it("fills danger and writes on it in the on-danger color, never white", () => {
    const classes = tokens(badgeVariants({ variant: "danger" }));

    expect(classes).toContain("bg-danger");
    expect(classes).toContain("text-destructive-foreground");
    expect(classes).not.toContain("text-white");
  });

  // state-contrast.test.ts measures this mix.
  it("darkens a danger badge that is a link on hover by mixing in --ink", () => {
    expect(tokens(badgeVariants({ variant: "danger" }))).toContain(
      "[a&]:hover:bg-[color-mix(in_oklab,var(--danger)_90%,var(--ink))]",
    );
  });

  it("draws neutral on the secondary tokens", () => {
    const classes = tokens(badgeVariants({ variant: "neutral" }));

    expect(classes).toContain("bg-secondary");
    expect(classes).toContain("text-secondary-foreground");
  });

  it("draws outline with a visible border and no fill", () => {
    const classes = tokens(badgeVariants({ variant: "outline" }));

    expect(classes).toContain("border-border");
    expect(classes).not.toContain("border-transparent");
    expect(classes.some((name) => name.startsWith("bg-"))).toBe(false);
  });

  it("keeps every shadcn variant name as an alias", () => {
    expect(badgeVariants({ variant: "destructive" })).toBe(
      badgeVariants({ variant: "danger" }),
    );
    expect(badgeVariants({ variant: "default" })).toBe(
      badgeVariants({ variant: "brand" }),
    );
    expect(badgeVariants({ variant: "secondary" })).toBe(
      badgeVariants({ variant: "neutral" }),
    );
  });

  it("stays the filled brand badge when no variant is given, as it was", () => {
    expect(badgeVariants()).toBe(badgeVariants({ variant: "brand" }));
  });

  it("keeps the text small at both sizes", () => {
    expect(tokens(badgeVariants({ size: "sm" }))).toContain("text-caption");
    expect(tokens(badgeVariants({ size: "md" }))).toContain("text-caption");
  });

  it("gives each size its own height", () => {
    expect(badgeVariants({ size: "sm" })).not.toBe(
      badgeVariants({ size: "md" }),
    );
  });
});

describe("badge", () => {
  it("draws a decorative dot", () => {
    const html = renderWithIntl(
      <Badge dot variant="success">
        Live
      </Badge>,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">Live</span>");
  });

  it("draws no dot unless asked", () => {
    const html = renderWithIntl(<Badge variant="success">Live</Badge>);

    expect(html).not.toContain("aria-hidden");
  });

  it("keeps its text size and its tone color together", () => {
    const classes = renderedClasses(
      renderWithIntl(<Badge variant="warning">Almost out</Badge>),
    );

    expect(classes).toContain("text-caption");
    expect(classes).toContain("text-warning-text");
  });

  it("lets a caller's class win over its own", () => {
    const classes = renderedClasses(
      renderWithIntl(<Badge className="text-meta">Almost out</Badge>),
    );

    expect(classes).toContain("text-meta");
    expect(classes).not.toContain("text-caption");
  });

  it("renders the child with asChild, dot included", () => {
    const html = renderWithIntl(
      <Badge asChild dot variant="outline">
        <a href="/changelog">v2.0</a>
      </Badge>,
    );

    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/changelog"');
    expect(html).toMatch(
      /<span[^>]* aria-hidden="true"[^>]*><\/span>v2\.0<\/a>/,
    );
  });
});
