import { describe, expect, it } from "vitest";
import { headingIds, slugOf } from "@/features/blog/heading-ids";

/**
 * The anchors of a post: the slug of a heading, and the plugin that gives each
 * h2 to h4 one that no other element has. The plugin is read here on a tree, as
 * react-markdown hands it over, without drawing anything.
 */

interface Node { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Node[] }

const text = (value: string): Node => ({ type: "text", value });
const heading = (tagName: string, ...children: Node[]): Node => ({ type: "element", tagName, properties: {}, children });
const root = (...children: Node[]): Node => ({ type: "root", children });

function idsAfter(tree: Node): (unknown)[] {
  headingIds()(tree);

  return (tree.children ?? []).map((node) => node.properties?.id);
}

describe("the slug of a heading", () => {
  it.each([
    ["Supported Providers", "supported-providers"],
    ["  Spaces   everywhere  ", "spaces-everywhere"],
    ["Résumé de l'été", "resume-de-l-ete"],
    ["À la carte : crème brûlée", "a-la-carte-creme-brulee"],
    ["Credit System, in detail", "credit-system-in-detail"],
    ["a --- b", "a-b"],
    ["---edges---", "edges"],
    ["Version 2.0 (beta)", "version-2-0-beta"],
    ["ÉCOLE", "ecole"],
  ])("makes %j into %j", (heading, slug) => {
    expect(slugOf(heading)).toBe(slug);
  });

  it("is `section` for a text that has nothing a slug can keep", () => {
    expect(slugOf("")).toBe("section");
    expect(slugOf("---")).toBe("section");
    expect(slugOf("★ ★ ★")).toBe("section");
  });
});

describe("the ids of the headings of a tree", () => {
  it("reads the text under the marks of a heading", () => {
    const tree = root(heading("h3", text("The "), { type: "element", tagName: "code", properties: {}, children: [text("code")] }, text(" and "), { type: "element", tagName: "strong", properties: {}, children: [text("bold")] }));

    expect(idsAfter(tree)).toEqual(["the-code-and-bold"]);
  });

  it("gives h2, h3 and h4 an id, and no other element", () => {
    const tree = root(heading("h1", text("One")), heading("h2", text("Two")), heading("h3", text("Three")), heading("h4", text("Four")), heading("h5", text("Five")), heading("h6", text("Six")), { type: "element", tagName: "p", properties: {}, children: [text("Text")] });

    expect(idsAfter(tree)).toEqual([undefined, "two", "three", "four", undefined, undefined, undefined]);
  });

  it("numbers a heading that comes back, whatever its level, and never hands out an id that is taken", () => {
    const tree = root(heading("h2", text("Setup")), heading("h3", text("Setup")), heading("h2", text("Setup")), heading("h2", text("A")), heading("h2", text("A")), heading("h2", text("A 2")));

    expect(idsAfter(tree)).toEqual(["setup", "setup-2", "setup-3", "a", "a-2", "a-2-2"]);
  });

  it("keeps an id a heading has, and gives none of the others one that is the same", () => {
    const label: Node = { type: "element", tagName: "h2", properties: { id: "footnote-label" }, children: [text("Footnotes")] };
    const tree = root(heading("h2", text("Footnote label")), label, heading("h2", text("Footnote label")));

    expect(idsAfter(tree)).toEqual(["footnote-label-2", "footnote-label", "footnote-label-3"]);
  });

  it("finds the headings wherever they are in the tree", () => {
    const section: Node = { type: "element", tagName: "section", properties: {}, children: [heading("h2", text("Inside"))] };
    const tree = root(section);

    headingIds()(tree);

    expect(section.children?.[0]?.properties?.id).toBe("inside");
  });

  it("gives the same ids when it is run again on a fresh tree: it holds nothing between two runs", () => {
    const make = () => root(heading("h2", text("Setup")), heading("h2", text("Setup")));

    expect(idsAfter(make())).toEqual(["setup", "setup-2"]);
    expect(idsAfter(make())).toEqual(["setup", "setup-2"]);
  });
});
