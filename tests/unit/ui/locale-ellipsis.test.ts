import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";

// An ellipsis is the character (U+2026), not three full stops: it is one glyph,
// which a line break cannot split and a screen reader reads as one pause.
const THREE_FULL_STOPS = /(?<!\.)\.{3}(?!\.)/;

/** `path: text` for every string of a locale file, the nested keys joined by dots. */
function strings(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") {
    return [[path, node]];
  }
  if (node !== null && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(
      ([key, value]) => strings(value, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe("the ellipsis of the locales", () => {
  it.each(["Search...", "Joining... ", "Wait ... what", "Dites-nous..."])(
    "flags %s",
    (text) => {
      expect(THREE_FULL_STOPS.test(text)).toBe(true);
    },
  );

  it.each(["Search…", "Chargement…", "Wait. Then go.", "v1.2.3"])(
    "lets %s through",
    (text) => {
      expect(THREE_FULL_STOPS.test(text)).toBe(false);
    },
  );

  it.each([
    ["en", en],
    ["fr", fr],
  ])("writes every ellipsis of %s as the character", (_locale, messages) => {
    const found = strings(messages)
      .filter(([, text]) => THREE_FULL_STOPS.test(text))
      .map(([path, text]) => `${path}: ${text}`);

    expect(found, `Use … (U+2026) instead of three full stops:\n${found.join("\n")}`).toEqual([]);
  });
});
