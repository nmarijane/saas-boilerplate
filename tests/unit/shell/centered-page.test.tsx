import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { CenteredPage } from "@/shared/components/shell/centered-page";
import { APP_NAME } from "@/shared/config/app";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl is replaced: a plain anchor stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
  };
});

const html = renderWithIntl(
  <CenteredPage>
    <p>What the page says</p>
  </CenteredPage>,
);

describe("the centered page", () => {
  it("is the one main landmark of the page", () => {
    expect(startTags(html, "main")).toHaveLength(1);
  });

  it("is a sunken page, as high as the screen, with its content in the middle of it", () => {
    expect(classesOf(startTags(html, "main")[0])).toEqual(
      expect.arrayContaining(["grid", "min-h-dvh", "place-items-center", "bg-surface-sunken"]),
    );
  });

  it("holds its content in a column as wide as a card of a form can be, and never wider than the screen", () => {
    const column = startTags(html, "div")[0];

    expect(classesOf(column)).toEqual(expect.arrayContaining(["w-full", "max-w-md"]));
  });

  it("puts the logo of the product over the content, and the logo leads home", () => {
    const [logo] = elements(html, "a");

    expect(attribute(logo, "href")).toBe("/");
    expect(textOf(logo)).toBe(APP_NAME);
    expect(html.indexOf(logo)).toBeLessThan(html.indexOf("What the page says"));
  });

  it("draws what it is given once, and no heading of its own", () => {
    expect(textOf(html).split("What the page says")).toHaveLength(2);
    for (const level of [1, 2, 3]) {
      expect(startTags(html, `h${level}`)).toHaveLength(0);
    }
  });
});
