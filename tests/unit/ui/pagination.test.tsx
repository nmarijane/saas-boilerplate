import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "@/shared/components/data/pagination";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl is replaced: no Next router runs in a test. A plain anchor stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
  };
});

const hrefOf = (page: number) => (page === 1 ? "/things" : `/things?page=${page}`);

function draw(page: number, totalPages: number, extra: Partial<ComponentProps<typeof Pagination>> = {}) {
  return renderWithIntl(
    <Pagination
      page={page}
      totalPages={totalPages}
      hrefOf={hrefOf}
      label={`Page ${page} of ${totalPages}`}
      previousLabel="Previous page"
      nextLabel="Next page"
      {...extra}
    />,
  );
}

/** The links of the foot of a list: what they say, and where they go. */
const linksOf = (html: string) => elements(html, "a").map((link) => [textOf(link), attribute(startTags(link, "a")[0] ?? "", "href")]);

describe("the foot of a list that is read a page at a time", () => {
  it("draws nothing for a list that fits one page, or that has no row at all", () => {
    expect(draw(1, 1)).toBe("");
    expect(draw(1, 0)).toBe("");
  });

  it("says where the person is, in the words it is given, in tabular figures", () => {
    const html = draw(2, 5);
    const [label = ""] = startTags(html, "p");

    expect(textOf(html)).toContain("Page 2 of 5");
    expect(classesOf(label)).toEqual(expect.arrayContaining(["text-meta", "text-ink-muted", "tabular-nums"]));
  });

  it("links to the next page only on the first, and the first page has no page in its address", () => {
    expect(linksOf(draw(1, 3))).toEqual([["Next page", "/things?page=2"]]);
  });

  it("links to the page before and to the one after on a page in the middle", () => {
    expect(linksOf(draw(2, 3))).toEqual([
      ["Previous page", "/things"],
      ["Next page", "/things?page=3"],
    ]);
    expect(linksOf(draw(3, 5))).toEqual([
      ["Previous page", "/things?page=2"],
      ["Next page", "/things?page=4"],
    ]);
  });

  it("links to the page before only on the last", () => {
    expect(linksOf(draw(3, 3))).toEqual([["Previous page", "/things?page=2"]]);
  });

  // They are links: a page of the list can be shared, reached by the back button, followed by a script
  it("draws links with an address, and no button that does something by a script", () => {
    const html = draw(2, 3);

    expect(startTags(html, "a")).toHaveLength(2);
    expect(startTags(html, "button")).toEqual([]);
  });

  it("draws the links as the small outline buttons of the family, 8 px apart", () => {
    const html = draw(2, 3);

    for (const link of startTags(html, "a")) {
      expect(classesOf(link)).toEqual(expect.arrayContaining(["tap-target", "border", "h-9"]));
    }
    expect(classesOf(startTags(html, "div")[1] ?? "")).toEqual(expect.arrayContaining(["flex", "items-center", "gap-2"]));
  });

  it("takes the classes of the page that places it", () => {
    expect(classesOf(startTags(draw(1, 2, { className: "mt-4 px-5" }), "div")[0] ?? "")).toEqual(
      expect.arrayContaining(["mt-4", "px-5", "flex-wrap", "justify-between"]),
    );
  });
});
