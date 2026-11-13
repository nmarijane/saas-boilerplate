import type { Components } from "react-markdown";

// The two blocks of a markdown text that can be wider than the text: a block of
// code and a table (the `markdown` style of global.css draws the rest). Each
// scrolls in a box of its own, and a keyboard reaches that box: it takes the
// focus, and the arrows scroll it (a box that scrolls and holds nothing to focus
// is out of the keyboard's reach). `node` is the syntax tree that react-markdown
// hands each component: it is not an attribute.
export const scrollableBlocks: Pick<Components, "pre" | "table"> = {
  pre: ({ node, ...props }) => <pre tabIndex={0} {...props} />,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto" tabIndex={0}>
      <table {...props} />
    </div>
  ),
};
