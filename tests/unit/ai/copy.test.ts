import type { Messages } from "../../helpers/copy";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { keysAsked, messageAt } from "../../helpers/copy";

/**
 * The words of the assistant: every one the page and the chat ask the translator
 * for exists in English and in French, and a translation never drops a value the
 * English message takes (a count, the limit, the variables to set).
 */

const ROOT = resolve(import.meta.dirname, "../../..");

const FILES = [
  "src/app/[locale]/(app)/(shell)/ai/page.tsx",
  "src/features/ai/components/chat.tsx",
  "src/features/ai/components/chat-error.tsx",
  "src/features/ai/components/chat-input.tsx",
  "src/features/ai/components/chat-message.tsx",
  "src/features/ai/components/credit-balance.tsx",
  "src/features/ai/components/model-selector.tsx",
];

const LOCALES = [
  ["en", en],
  ["fr", fr],
] as const;

/** The `{names}` a message takes, in the order it writes them, whatever it does with them (`{count, plural, ...}` is `count`). */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)[,}]/g)].map(([, name = ""]) => name);
}

/** Every message of a group, by its full key. */
function flat(messages: Messages, prefix: string): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}.${key}`, value]] : flat(value, `${prefix}.${key}`),
  );
}

describe("the words of the assistant", () => {
  const keys = [...new Set(FILES.flatMap((file) => keysAsked(readFileSync(join(ROOT, file), "utf-8"))))];

  it("asks for messages: the scan finds them, or it checks nothing", () => {
    expect(keys.length).toBeGreaterThan(15);
  });

  it.each(LOCALES)("%s: has every message the page and the chat ask for", (locale, messages) => {
    const missing = keys.filter((key) => typeof messageAt(messages, key) !== "string");

    expect(missing, `${locale}.json lacks messages the assistant asks for`).toEqual([]);
  });

  it("takes the same values in both languages: a translation never drops one", () => {
    for (const [key, english] of flat(en.ai as Messages, "ai")) {
      const french = messageAt(fr, key) ?? "";

      expect(placeholders(french).sort(), key).toEqual(placeholders(english).sort());
    }
  });

  it("has no message of the assistant that nothing asks for: a word nobody draws is a word to forget", () => {
    // The title and the nav entry are read by the page's metadata and by the shell's own file
    const asked = new Set([...keys, "ai.nav", "ai.title"]);
    const unused = flat(en.ai as Messages, "ai")
      .map(([key]) => key)
      .filter((key) => !asked.has(key));

    expect(unused).toEqual([]);
  });
});
