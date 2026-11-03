import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { Spinner } from "@/shared/components/ui/spinner";
import { renderWithIntl } from "../../helpers/intl";

describe("spinner", () => {
  it("hides the drawing from assistive technology", () => {
    const html = renderWithIntl(<Spinner />);

    expect(html).toMatch(/<svg[^>]* aria-hidden="true"/);
  });

  it("tells screen readers it is loading, in the language of the page", () => {
    expect(renderWithIntl(<Spinner />)).toContain(
      `<span class="sr-only">${en.common.loading}</span>`,
    );
    expect(renderWithIntl(<Spinner />, "fr")).toContain(
      `<span class="sr-only">${fr.common.loading}</span>`,
    );
  });

  it("is a status, so the message is announced", () => {
    expect(renderWithIntl(<Spinner />)).toContain('role="status"');
  });

  it("says what it is given instead", () => {
    const html = renderWithIntl(<Spinner label="Syncing" />);

    expect(html).toContain('<span class="sr-only">Syncing</span>');
    expect(html).not.toContain(en.common.loading);
  });

  it("stays silent when the label is empty, as the text around it says it all", () => {
    const html = renderWithIntl(<Spinner label="" />);

    expect(html).not.toContain("sr-only");
    expect(html).not.toContain("role=");
    expect(html).toContain("<svg");
  });

  it.each([
    ["xs", "size-3"],
    ["sm", "size-4"],
    ["md", "size-5"],
  ] as const)("draws size %s at %s", (size, expected) => {
    const classes = /<svg[^>]* class="([^"]*)"/.exec(
      renderWithIntl(<Spinner size={size} />),
    )?.[1];

    expect(classes?.split(" ")).toContain(expected);
  });

  it("is 16 px by default", () => {
    expect(renderWithIntl(<Spinner />)).toContain("size-4");
  });

  it("turns, and stops turning under reduced motion", () => {
    const classes = /<svg[^>]* class="([^"]*)"/
      .exec(renderWithIntl(<Spinner />))?.[1]
      ?.split(" ");

    expect(classes).toContain("animate-spin");
    expect(classes).toContain("motion-reduce:animate-none");
  });

  it("takes the color of the text around it", () => {
    expect(renderWithIntl(<Spinner />)).toContain('stroke="currentColor"');
  });
});

describe("spinner story", () => {
  const story = () =>
    readFileSync(
      resolve(
        import.meta.dirname,
        "../../../src/shared/components/ui/spinner.stories.tsx",
      ),
      "utf-8",
    );

  it("is titled UI/Spinner and tagged for the docs page, like the other component stories", () => {
    expect(story()).toContain('title: "UI/Spinner"');
    expect(story()).toContain('tags: ["autodocs"]');
  });

  it("lists the three sizes the component has, and draws each of them", () => {
    expect(story()).toContain('const sizes = ["xs", "sm", "md"] as const;');
    expect(story()).toMatch(
      /sizes\.map\(\(size\) =>[\s\S]*<Spinner size=\{size\} \/>/,
    );
  });

  it("shows a label for screen readers, and an empty one beside text that says it all", () => {
    expect(story()).toMatch(/label: "[^"]+"/);
    expect(story()).toContain('<Spinner label="" />');
  });
});
