import ts from "typescript";

/**
 * The words a component writes itself instead of taking them from the message
 * files: the text between its tags, and the attributes a person reads or hears.
 * A word there is English in every language the app speaks.
 */

/** The attributes whose value is read: by the eye or by a screen reader. */
const READ_ATTRIBUTES = new Set(["aria-label", "alt", "placeholder", "title", "label"]);

const HAS_LETTER = /\p{L}/u;

/**
 * The strings an expression can give, when it is made of literals: `"Save"`,
 * a template, either side of a condition (`busy ? "Saving…" : "Save"`), the
 * right side of `&&` and both sides of `||` and `??`. A call, a name or a
 * property gives none: its words are somewhere else.
 */
function literalsOf(expression: ts.Expression): string[] {
  if (ts.isStringLiteralLike(expression)) {
    return [expression.text];
  }
  if (ts.isTemplateExpression(expression)) {
    return [expression.head.text, ...expression.templateSpans.map(({ literal }) => literal.text)];
  }
  if (ts.isParenthesizedExpression(expression)) {
    return literalsOf(expression.expression);
  }
  if (ts.isConditionalExpression(expression)) {
    return [...literalsOf(expression.whenTrue), ...literalsOf(expression.whenFalse)];
  }
  if (ts.isBinaryExpression(expression)) {
    // `a && "Hi"` shows the right side only: the left one is a condition, and so is a comparison.
    const { kind } = expression.operatorToken;
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return literalsOf(expression.right);
    }
    if (kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken) {
      return [...literalsOf(expression.left), ...literalsOf(expression.right)];
    }
  }
  return [];
}

/**
 * What a TSX source says in its JSX without asking the translator: text
 * children (`<p>Save</p>`, `{"Save"}`, `{busy ? "Saving…" : "Save"}`) and string
 * values of the attributes in `READ_ATTRIBUTES` (`placeholder="Search"`). A
 * `className` or a `type` is code, not copy, and so is anything made of no
 * letter (`{" "}`, `…`).
 */
export function hardCodedCopy(source: string): string[] {
  const ast = ts.createSourceFile("component.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && HAS_LETTER.test(node.text)) {
      found.push(node.text.trim());
    } else if (ts.isJsxExpression(node) && node.expression) {
      const { parent } = node;
      const attribute = ts.isJsxAttribute(parent) ? parent.name.getText() : null;

      if (attribute === null || READ_ATTRIBUTES.has(attribute)) {
        for (const text of literalsOf(node.expression).filter((value) => HAS_LETTER.test(value))) {
          found.push(attribute === null ? text : `${attribute}="${text}"`);
        }
      }
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && READ_ATTRIBUTES.has(node.name.getText()) && HAS_LETTER.test(node.initializer.text)) {
      found.push(`${node.name.getText()}="${node.initializer.text}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);

  return found;
}

/** The messages of a locale, as the JSON files hold them: a text, or a group of messages. */
export interface Messages {
  [key: string]: string | Messages;
}

/** The text of a message by its full key ("projects.status.draft"), or undefined. */
export function messageAt(messages: Messages, key: string): string | undefined {
  let found: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    found = typeof found === "object" ? found[part] : undefined;
  }

  return typeof found === "string" ? found : undefined;
}

/**
 * The full keys a source asks the translator for with a literal: the variable
 * that holds a translator (`const t = useTranslations("projects")`,
 * `await getTranslations({ locale, namespace: "projects" })`) gives the
 * namespace, and each `t("key")` or `t.rich("key")` under it is one key. A key
 * that is computed (`t(entry.action)`) is not a literal, and is not found.
 */
export function keysAsked(source: string): string[] {
  const declarations = [
    ...source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(([^)]*)\)/g),
  ];

  return declarations.flatMap(([, name = "", args = ""]) => {
    const namespace = /namespace:\s*"([^"]+)"/.exec(args)?.[1] ?? /^\s*"([^"]+)"/.exec(args)?.[1];
    const calls = source.matchAll(new RegExp(String.raw`\b${name}(?:\.rich)?\(\s*"([^"]+)"`, "g"));

    return [...calls].map(([, key = ""]) => (namespace ? `${namespace}.${key}` : key));
  });
}
