/**
 * Readers for the static markup a test renders: the start tags of an element,
 * one attribute, the classes of a tag, whole elements and what they say.
 */

/** The class names of a `class` attribute value. */
export function tokens(classes: string): string[] {
  return classes.split(" ").filter(Boolean);
}

/** The start tags of an element, in document order. */
export function startTags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];
}

/** Every element of this name, from its start tag to its end tag (for an element that does not nest in itself: a button, a link, a span of text). */
export function elements(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?</${name}>`, "g")) ?? [];
}

/** The start tag of the element of this name that says exactly this text, and nothing else; "" when there is none. */
export function tagSaying(html: string, name: string, text: string): string {
  const escaped = text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`<${name}\\b[^>]*>${escaped}</${name}>`).exec(html)?.[0] ?? "";
}

/** What a piece of markup says, its tags left out and its entities put back. */
export function textOf(markup: string): string {
  return decodeEntities(markup.replaceAll(/<[^>]*>/g, ""));
}

/** The value of an attribute of a start tag, or undefined when it has none. */
export function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** The classes of a start tag. */
export function classesOf(tag: string): string[] {
  return tokens(attribute(tag, "class") ?? "");
}

/** Text as it was written in the source: the entities the renderer escapes (`&amp;`, `&gt;`, `&#x27;`...) put back. */
export function decodeEntities(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

/** The classes of a start tag as the source wrote them: `[&_svg]:size-4`, not `[&amp;_svg]:size-4`. */
export function decodedClassesOf(tag: string): string[] {
  return classesOf(tag).map(decodeEntities);
}
