"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { scrollableBlocks } from "@/shared/components/data/markdown-blocks";
import { cn } from "@/shared/utils/cn";
import { headingIds } from "../heading-ids";

interface MdxContentProps {
  content: string;
}

// A post is markdown, drawn by the `markdown` style of the app (global.css), which
// the chat draws its answers with: from the tokens of the theme, in light and in
// dark. The typography plugin that `prose` stands for is not installed (and no
// plugin is wanted): the style draws the lists, the headings, the code, the quotes
// and the tables. What only an article needs is on top of it: a measure of about 65
// characters (a text that is read, not scanned), at the size of a text that is read,
// headings that stand above that text (the style's own are sized for an answer of
// the assistant, which is smaller than a panel title), more room before a heading
// (the variable of the style), and headings that an anchor reaches (`headingIds`
// gives each h2 to h4 an id slugged from its text) and leaves clear of the sticky
// header, as it does the footnotes. A table or a block of code wider than the
// column scrolls in a box of its own that a keyboard reaches (`scrollableBlocks`),
// as it does in the chat.
export function MdxContent({ content }: MdxContentProps) {
  return (
    <article
      className={cn(
        "markdown max-w-prose text-base leading-7",
        "[--markdown-heading-gap:2.5rem]",
        "[&_h1]:text-page [&_h2]:text-entity [&_h3]:text-panel [&_:is(h4,h5,h6)]:text-section",
        "[&_:is(h1,h2,h3,h4,h5,h6)]:scroll-mt-20",
        // The targets of the footnotes (the note, and the mention it goes back to) are reached by an anchor too
        "[&_[id^=user-content-fn]]:scroll-mt-20",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[headingIds]} components={scrollableBlocks}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
