/**
 * Readers for the static markup a test renders: the start tags of an element,
 * one attribute, the classes of a tag.
 */

/** The class names of a `class` attribute value. */
export function tokens(classes: string): string[] {
  return classes.split(" ").filter(Boolean);
}

/** The start tags of an element, in document order. */
export function startTags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];
}

/** The value of an attribute of a start tag, or undefined when it has none. */
export function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** The classes of a start tag. */
export function classesOf(tag: string): string[] {
  return tokens(attribute(tag, "class") ?? "");
}
