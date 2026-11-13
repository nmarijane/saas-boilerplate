import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MdxContent } from "@/features/blog/components/mdx-content";
import { classesOf, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/**
 * A post of the blog is markdown, drawn by the `markdown` style of the app
 * (global.css), which the chat draws its answers with: the base style of Tailwind
 * resets lists, headings and code, and the typography plugin that `prose` stands for
 * is not installed, so a post that carried only `prose` classes drew all of them as
 * plain text. An article takes the style, with what only an article needs on top: a
 * measure, more room before a heading, and a heading that an anchor leaves clear of
 * the sticky header.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

const POST = [
  "## A heading",
  "A paragraph with `code` in it and a [link](https://example.com).",
  "- first\n- second\n  - nested",
  "1. one\n2. two",
  "```bash\nnpm run dev\n```",
  "> a quote",
  "| a | b |\n| --- | --- |\n| 1 | 2 |",
].join("\n\n");

function article(content = POST) {
  return renderWithIntl(<MdxContent content={content} />);
}

describe("a post of the blog", () => {
  it("is an article that carries the markdown style of the app", () => {
    const [tag = ""] = startTags(article(), "article");

    expect(classesOf(tag)).toContain("markdown");
  });

  it("carries no class of the typography plugin, which is not installed and draws nothing", () => {
    const [tag = ""] = startTags(article(), "article");

    expect(classesOf(tag).filter((name) => /(?:^|:)prose(?:-|$)|prose-invert/.test(name))).toEqual([]);
  });

  it("draws what markdown writes as the elements the style reaches: headings, lists, code, quotes and tables", () => {
    const html = article();

    expect(html).toContain('<h2 id="a-heading">A heading</h2>');
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html).toContain("<ol>");
    expect(html).toContain("<code>code</code>");
    expect(html).toMatch(/<pre[^>]*><code class="language-bash">/);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<table>");
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  // Reading a long text asks for a line that is not too long: about 65 characters, which is what `prose` gives
  it("keeps its lines to a readable measure", () => {
    const [tag = ""] = startTags(article(), "article");

    expect(classesOf(tag)).toContain("max-w-prose");
    expect(classesOf(tag)).not.toContain("max-w-3xl");
  });

  it("leaves more room before a heading than an answer of the assistant does, by the variable of the style", () => {
    const [tag = ""] = startTags(article(), "article");

    expect(classesOf(tag).map((name) => name.replaceAll("&amp;", "&"))).toContain("[--markdown-heading-gap:2.5rem]");
  });

  // The style sizes a heading for an answer of the assistant: an h3 there is 14 px, the size of the text of the
  // app, and under the 16 px of a post it would be smaller than the text it heads
  it("sizes its headings above the text they head, on the scale of the app: a page, an entity, a panel, a section", () => {
    const [tag = ""] = startTags(article(), "article");
    const classes = classesOf(tag).map((name) => name.replaceAll("&amp;", "&"));

    expect(classes).toEqual(
      expect.arrayContaining(["[&_h1]:text-page", "[&_h2]:text-entity", "[&_h3]:text-panel", "[&_:is(h4,h5,h6)]:text-section"]),
    );
  });

  it("keeps a heading clear of the sticky header when an anchor scrolls to it", () => {
    const [tag = ""] = startTags(article(), "article");

    expect(classesOf(tag).map((name) => name.replaceAll("&amp;", "&"))).toContain("[&_:is(h1,h2,h3,h4,h5,h6)]:scroll-mt-20");
  });

  // A margin on a heading that no anchor can reach does nothing: the headings of a post have the ids that the address of
  // a section names (`#supported-providers`)
  it("gives the headings from h2 to h4 an id that an anchor can name, slugged from their text", () => {
    const html = article(["## AI Module Overview", "### Supported Providers", "#### Credit System, in detail", "Text."].join("\n\n"));

    expect(html).toContain('<h2 id="ai-module-overview">AI Module Overview</h2>');
    expect(html).toContain('<h3 id="supported-providers">Supported Providers</h3>');
    expect(html).toContain('<h4 id="credit-system-in-detail">Credit System, in detail</h4>');
  });

  it("slugs a French heading without its accents, and the text a heading shows when it has marks in it", () => {
    const html = article(["## Résumé de l'été", "### Café & crème : à la carte", "#### The `code` and **bold** and a [link](https://example.com)"].join("\n\n"));

    expect(html).toContain('id="resume-de-l-ete"');
    expect(html).toContain('id="cafe-creme-a-la-carte"');
    expect(html).toContain('id="the-code-and-bold-and-a-link"');
  });

  it("gives a heading that comes back an id of its own: -2, -3, and never one that is taken", () => {
    const html = article(["## Setup", "text", "## Setup", "text", "## Setup", "text", "## A", "## A", "## A 2"].join("\n\n"));
    const ids = [...html.matchAll(/<h2 id="([^"]+)">/g)].map(([, id]) => id);

    expect(ids).toEqual(["setup", "setup-2", "setup-3", "a", "a-2", "a-2-2"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves the headings that are not from h2 to h4 as they are", () => {
    const html = article(["# A page", "##### Five", "###### Six"].join("\n\n"));

    expect(html).toContain("<h1>A page</h1>");
    expect(html).toContain("<h5>Five</h5>");
    expect(html).toContain("<h6>Six</h6>");
  });

  // The footnotes of a post have ids that their links name: they are kept clear of the sticky header as the headings
  // are, and the label of their section keeps its id, which the section points to
  it("keeps the targets of the footnotes clear of the sticky header, and the id of their label", () => {
    const html = article("A claim.[^1]\n\n[^1]: The source.\n\n## A heading");
    const [tag = ""] = startTags(html, "article");

    expect(classesOf(tag).map((name) => name.replaceAll("&amp;", "&"))).toContain("[&_[id^=user-content-fn]]:scroll-mt-20");
    expect(html).toContain('id="user-content-fn-1"');
    expect(html).toContain('id="user-content-fnref-1"');
    expect(html).toContain('id="footnote-label"');
    expect(html).toContain('<h2 id="a-heading">A heading</h2>');
  });

  it("reads at the size of a text that is read, not of the interface", () => {
    const [tag = ""] = startTags(article(), "article");

    expect(classesOf(tag)).toEqual(expect.arrayContaining(["text-base", "leading-7"]));
  });

  // A block of code and a table that are wider than the text scroll in a box of their own, and a keyboard reaches it:
  // on a phone a table of three columns is wider than the screen, and a box that scrolls is out of the reach of a
  // keyboard unless it takes the focus
  it("holds a code block a keyboard can scroll, and a table in a box that scrolls and that a keyboard reaches", () => {
    const html = article();

    expect(html).toMatch(/<pre[^>]*\stabindex="0"/);
    expect(html).toMatch(/<div class="overflow-x-auto" tabindex="0"><table>/);
  });

  it("does not draw the html a post holds: it is text", () => {
    const html = article('<img src=x onerror="alert(1)"> <script>alert(1)</script>');

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });
});

describe("the blog", () => {
  // The module of the AI chat is documented by README.md and docs/SETUP.md, and the post says what they say
  it("says what the README says of Ollama: wired as a provider, and no model of the list runs on it yet", () => {
    const post = readFileSync(join(ROOT, "content/blog/ai-module-guide.mdx"), "utf8");
    const row = post.split("\n").find((line) => line.startsWith("| Ollama"));

    expect(post).not.toMatch(/any local model/i);
    expect(row).toBeDefined();
    expect(row).toMatch(/wired as a provider/i);
    expect(row).toMatch(/no model of the list runs on it yet/i);
    expect(row).toContain("`OLLAMA_BASE_URL`");
    // The other rows keep their shape: a provider, its models, the variable that sets it up
    expect(row?.split("|").filter((cell) => cell.trim() !== "")).toHaveLength(3);
  });
});
