import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The typography plugin of Tailwind (`prose`, `prose-lg`, `dark:prose-invert`,
 * `prose-headings:...`) is not installed, so its classes draw nothing: a text
 * that carries them is plain text. The `markdown` style of global.css is what
 * draws the markdown of the app (an answer of the assistant, a post of the blog).
 * This reads the string literals of the source, where a class name sits, and not
 * its comments, which may say why a class is not there.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const SRC = join(ROOT, "src");

/** The classes of the plugin, as a token of a class list: `prose`, `prose-lg`, `dark:prose-invert`, `max-w-none` is not one. */
const PLUGIN_CLASS = /(?:^|[\s:])prose(?:-[\w:-]+)?(?=\s|$)/;

function stringsOf(file: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      found.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return found;
}

describe("the classes of the typography plugin", () => {
  it("is found in no string of the source, which would draw nothing", () => {
    const hits = readdirSync(SRC, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) => {
        const path = relative(ROOT, join(SRC, file)).split(sep).join("/");
        const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        const source = ts.createSourceFile(path, readFileSync(join(SRC, file), "utf8"), ts.ScriptTarget.Latest, true, kind);

        return stringsOf(source)
          .filter((text) => PLUGIN_CLASS.test(text))
          .map((text) => `${path}: ${text.slice(0, 60)}`);
      });

    expect(hits).toEqual([]);
  });

  it("sees a class of the plugin where it is written, and leaves a word that only contains it", () => {
    for (const written of ["prose", "prose prose-lg", "mx-auto prose-headings:font-bold", "dark:prose-invert", "a prose-a:text-primary b"]) {
      expect(PLUGIN_CLASS.test(written), written).toBe(true);
    }
    for (const written of ["proseless", "purpose", "text-prosecco", "no-prose-here-x"]) {
      expect(PLUGIN_CLASS.test(written), written).toBe(false);
    }
  });
});
