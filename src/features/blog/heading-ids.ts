// The anchors of a post: each heading from h2 to h4 gets an id slugged from its
// text, so that `/blog/a-post#supported-providers` goes to it. react-markdown gives
// headings no id of its own, and a slug plugin is a dependency this does not need.
//
// It is a rehype plugin, a function of the tree and nothing else, so that the ids of
// a post are the same on the server, in the browser and when React draws a component
// twice: a counter kept while the headings are drawn would hand out `setup-2` to a
// heading that is drawn a second time.

/** The part of a node of the tree (hast) that this reads and writes. */
interface Node {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

const ANCHORED = new Set(["h2", "h3", "h4"]);

/**
 * A text as an anchor: lowercase, accents taken off, every run of other
 * characters one hyphen, no hyphen at either end. A text with nothing in it that a
 * slug can keep (a heading of symbols) is `section`.
 */
export function slugOf(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug === "" ? "section" : slug;
}

/** The first of `base`, `base-2`, `base-3`... that no element of the post has. */
function freeId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) {
    id = `${base}-${n}`;
  }

  return id;
}

function textOf(node: Node): string {
  return node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textOf).join("");
}

function walk(node: Node, visit: (node: Node) => void) {
  visit(node);
  node.children?.forEach((child) => walk(child, visit));
}

/**
 * A rehype plugin: gives each h2, h3 and h4 an id slugged from its text, unique
 * in the post (`setup`, `setup-2`, `setup-3` for a heading that comes back). A
 * heading that has an id already keeps it (the label of the footnotes has one
 * that its section points to), and no id is handed out twice, ones that were
 * there included.
 */
export function headingIds() {
  return (tree: Node) => {
    const taken = new Set<string>();
    walk(tree, ({ properties }) => {
      if (typeof properties?.id === "string") {
        taken.add(properties.id);
      }
    });

    walk(tree, (node) => {
      if (node.type !== "element" || !node.tagName || !ANCHORED.has(node.tagName) || node.properties?.id !== undefined) {
        return;
      }

      const id = freeId(slugOf(textOf(node)), taken);
      taken.add(id);
      node.properties = { ...node.properties, id };
    });
  };
}
