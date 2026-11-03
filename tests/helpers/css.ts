/**
 * A reader for the plain declarations of a stylesheet (`box-shadow`,
 * `animation-duration`...), which color.ts leaves aside: the blocks as a tree,
 * so that a rule inside `@layer` or `@media`, or a pseudo-element nested in a
 * utility, can be found by its path.
 */

export interface Block {
  /** What precedes the braces, with the white space collapsed: `@utility tap-target`, `*, ::before`. */
  header: string;
  /** The `property: value` declarations of the block itself, nested blocks left out. */
  properties: Record<string, string>;
  /** The blocks nested in it, in source order. */
  children: Block[];
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function addDeclaration(block: Block, statement: string): void {
  const colon = statement.indexOf(":");
  const name = statement.slice(0, colon).trim();
  // `@apply focus-ring` and the like are statements, not declarations.
  if (colon > 0 && /^[\w-]+$/.test(name)) {
    block.properties[name] = collapse(statement.slice(colon + 1));
  }
}

/** The top-level blocks of a stylesheet, comments removed. */
export function parseBlocks(css: string): Block[] {
  const root: Block = { header: "", properties: {}, children: [] };
  const stack = [root];
  let text = "";

  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    const current = stack.at(-1) ?? root;
    if (char === "{") {
      const block: Block = {
        header: collapse(text),
        properties: {},
        children: [],
      };
      current.children.push(block);
      stack.push(block);
      text = "";
    } else if (char === "}") {
      // The last declaration of a block may omit its semicolon.
      addDeclaration(current, text);
      stack.pop();
      text = "";
    } else if (char === ";") {
      addDeclaration(current, text);
      text = "";
    } else {
      text += char;
    }
  }
  return root.children;
}

/** The block at a path of headers from the top of the sheet, or undefined. */
export function findBlock(css: string, ...path: string[]): Block | undefined {
  let level = parseBlocks(css);
  let found: Block | undefined;
  for (const header of path) {
    found = level.find((block) => block.header === collapse(header));
    level = found?.children ?? [];
  }
  return found;
}
