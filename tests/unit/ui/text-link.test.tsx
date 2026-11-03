import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TextLink, textLinkVariants } from "@/shared/components/ui/text-link";
import { renderWithIntl } from "../../helpers/intl";

function tokens(classes: string): string[] {
  return classes.split(" ");
}

function renderedClasses(html: string): string[] {
  return tokens(/class="([^"]*)"/.exec(html)?.[1] ?? "");
}

describe("textLink", () => {
  it("renders a plain anchor", () => {
    const html = renderWithIntl(<TextLink href="/docs">Docs</TextLink>);

    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/docs"');
    expect(html).toContain(">Docs</a>");
  });

  it("renders the child instead of an anchor with asChild", () => {
    const html = renderWithIntl(
      <TextLink asChild>
        <a href="/docs">Docs</a>
      </TextLink>,
    );

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="/docs"');
    expect(renderedClasses(html)).toContain("focus-visible:focus-ring");
  });

  it("passes the usual anchor props through", () => {
    const html = renderWithIntl(
      <TextLink href="https://example.com" target="_blank" rel="noreferrer">
        Example
      </TextLink>,
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("lets a caller's class win over its own", () => {
    const classes = renderedClasses(
      renderWithIntl(
        <TextLink href="/docs" className="text-ink">
          Docs
        </TextLink>,
      ),
    );

    expect(classes).toContain("text-ink");
    expect(classes).not.toContain("text-brand");
  });
});

describe("textLinkVariants", () => {
  it("colors the default intent with the brand", () => {
    expect(tokens(textLinkVariants())).toContain("text-brand");
  });

  it("softens the muted intent", () => {
    const classes = tokens(textLinkVariants({ intent: "muted" }));

    expect(classes).toContain("text-ink-muted");
    expect(classes).toContain("hover:text-ink");
  });

  it("writes the danger intent in the danger text color", () => {
    expect(tokens(textLinkVariants({ intent: "danger" }))).toContain(
      "text-danger-text",
    );
  });

  it("underlines a link with a solid line at rest unless asked to wait for the hover", () => {
    const always = tokens(textLinkVariants({ underline: "always" }));

    expect(tokens(textLinkVariants())).toEqual(always);
    expect(always).toContain("underline");
    expect(always).toContain("decoration-current");
    expect(always.some((name) => name.startsWith("decoration-current/"))).toBe(
      false,
    );

    const hover = tokens(textLinkVariants({ underline: "hover" }));

    expect(hover).not.toContain("underline");
    expect(hover).toContain("hover:underline");
  });

  it("flows with the words around it: inline, no 44 px target, no flex box", () => {
    for (const intent of ["default", "muted", "danger"] as const) {
      const classes = tokens(textLinkVariants({ intent }));

      expect(classes).toContain("inline");
      expect(classes).not.toContain("tap-target");
      expect(classes).not.toContain("inline-flex");
      expect(classes).toContain("focus-visible:focus-ring");
    }
  });

  it("rings every line of a link that wraps, not one slice of the whole", () => {
    expect(tokens(textLinkVariants())).toContain("box-decoration-clone");
  });

  it("becomes a flex box only to line an icon up with its text", () => {
    const classes = tokens(textLinkVariants());

    expect(classes).toContain("has-[>svg]:inline-flex");
    expect(classes).toContain("has-[>svg]:items-center");
    expect(classes).toContain("has-[>svg]:gap-1");
  });

  it("lets a standalone link ask for the 44 px target", () => {
    const classes = renderedClasses(
      renderWithIntl(
        <TextLink href="/plans" className="tap-target">
          Plans
        </TextLink>,
      ),
    );

    expect(classes).toContain("tap-target");
    expect(classes).toContain("inline");
  });

  it("shows that opt-in in a Standalone story, and none in a sentence", () => {
    const stories = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../src/shared/components/ui/text-link.stories.tsx",
      ),
      "utf-8",
    );
    /** The code of one story: from its export to the next doc comment or export. */
    const story = (name: string) =>
      new RegExp(`export const ${name}[\\s\\S]*?(?=\\n/\\*\\*|\\nexport const |$)`).exec(
        stories,
      )?.[0] ?? "";

    expect(story("Standalone")).toContain('className: "tap-target"');
    expect(story("InSentence")).toContain("<TextLink");
    expect(story("InSentence")).not.toContain("tap-target");
  });
});
