import type { Messages } from "../../helpers/copy";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { NOISY_ACTIONS } from "@/features/audit/queries";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { hardCodedCopy, keysAsked, messageAt } from "../../helpers/copy";

/**
 * The words of the home: every one comes from the message files, which hold it
 * in both languages (tests/unit/i18n/messages-parity.test.ts keeps the two files
 * in step, and the labels the shells name).
 */

const ROOT = resolve(import.meta.dirname, "../../..");

/** The sources that draw words: the quota card, the components of the dashboard feature and the page. */
const FILES = [
  "src/shared/components/data/quota-card.tsx",
  "src/features/dashboard/components/home-activity.tsx",
  "src/features/dashboard/components/home-tasks.tsx",
  "src/app/[locale]/(app)/(shell)/dashboard/page.tsx",
];

const LOCALES = [
  ["en", en],
  ["fr", fr],
] as const;

/** The names of the events, as the type that lists them writes them. */
function eventNames(): string[] {
  const source = readFileSync(join(ROOT, "src/features/events/types.ts"), "utf-8");
  const union = /export type EventName =([^;]+);/.exec(source)?.[1] ?? "";

  return [...union.matchAll(/"([^"]+)"/g)].map(([, name = ""]) => name);
}

/** The `{names}` a message takes, in the order it writes them. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map(([, name = ""]) => name);
}

/**
 * The translator of the activity, which takes the name of a sentence as it comes
 * from a row of the audit log: a string, which the keys of the messages know
 * nothing of.
 */
function sayer(locale: "en" | "fr", messages: Messages, onError?: (error: Error) => void) {
  const t = createTranslator({ locale, messages, namespace: "activity", onError });

  return (key: string, values: Record<string, string> = {}): string => t(key as never, values as never);
}

describe("the words of the home", () => {
  it("looks at the sources that draw them", () => {
    for (const file of FILES) {
      expect(readdirSync(join(ROOT, file, "..")), file).toContain(file.split("/").at(-1));
    }
  });

  it.each(FILES)("are written in no component: %s", (file) => {
    expect(hardCodedCopy(readFileSync(join(ROOT, file), "utf-8"))).toEqual([]);
  });

  it("exist in English and in French, every one a component or the page asks for", () => {
    const keys = [...new Set(FILES.flatMap((file) => keysAsked(readFileSync(join(ROOT, file), "utf-8"))))];

    // The scan has to find the words, or it checks nothing
    expect(keys.length).toBeGreaterThan(15);
    for (const [locale, messages] of LOCALES) {
      const missing = keys.filter((key) => messageAt(messages, key) === undefined);

      expect(missing, `${locale}.json lacks messages the home asks for`).toEqual([]);
    }
  });

  it("takes the same values in both languages: a translation never drops one", () => {
    const namespaces = ["home", "activity", "quotas", "apiKeys"];
    const flat = (messages: Messages, prefix: string): [string, string][] =>
      Object.entries(messages).flatMap(([key, value]) =>
        typeof value === "string" ? [[`${prefix}.${key}`, value]] : flat(value, `${prefix}.${key}`),
      );

    for (const namespace of namespaces) {
      for (const [key, english] of flat(en[namespace as keyof typeof en] as Messages, namespace)) {
        const french = messageAt(fr, key) ?? "";

        expect(placeholders(french).sort(), key).toEqual(placeholders(english).sort());
      }
    }
    for (const key of ["organization.task", "organization.taskAction"]) {
      expect(placeholders(messageAt(fr, key) ?? "").sort(), key).toEqual(placeholders(messageAt(en, key) ?? "").sort());
    }
  });

  it("has a word for what the shells name: the quotas, and the first steps that the features add", () => {
    for (const [, messages] of LOCALES) {
      for (const key of [
        "quotas.members",
        "quotas.storage",
        "quotas.aiCredits",
        "organization.task",
        "organization.taskAction",
        "apiKeys.task",
        "apiKeys.taskAction",
      ]) {
        expect(messageAt(messages, key), key).toBeTruthy();
      }
    }
  });
});

describe("the sentences of the activity", () => {
  // The events the home does not tell need no sentence: the loader names them, once
  const noisy: readonly string[] = NOISY_ACTIONS;
  const shown = eventNames().filter((name) => !noisy.includes(name));

  it("know every event the type lists, but the ones the home leaves out", () => {
    // The scan has to find the events, or it checks nothing
    expect(eventNames().length).toBeGreaterThan(20);
    expect(shown.length).toBeGreaterThan(15);
    expect(noisy.length).toBeGreaterThan(0);
    for (const name of noisy) {
      expect(eventNames()).toContain(name);
    }
  });

  it.each(LOCALES)("%s: has a sentence for each event that is told", (_locale, messages) => {
    const lacking = shown.filter((name) => messageAt(messages, `activity.${name}`) === undefined);

    expect(lacking).toEqual([]);
  });

  it.each(LOCALES)("%s: writes the person in every sentence of a person, and the name of a project only for a project", (_locale, messages) => {
    const person = shown.filter((name) => !name.startsWith("subscription.") && !name.startsWith("payment."));

    for (const name of shown) {
      const used = placeholders(messageAt(messages, `activity.${name}`) ?? "");
      const allowed = name.startsWith("project.") ? ["actor", "name"] : ["actor"];

      expect(allowed, `${name} takes ${used.join(", ")}`).toEqual(expect.arrayContaining(used));
    }
    for (const name of person) {
      expect(placeholders(messageAt(messages, `activity.${name}`) ?? ""), name).toContain("actor");
    }
    for (const name of ["project.created", "project.updated", "project.deleted"]) {
      expect(placeholders(messageAt(messages, `activity.${name}`) ?? ""), name).toEqual(["actor", "name"]);
    }
  });

  it.each(LOCALES)("%s: reads, whatever the values, as the sentence of the language", (locale, messages) => {
    // A message that cannot be formatted (a stray brace, a plural with no other) throws here
    const say = sayer(locale, messages, (error) => {
      throw error;
    });

    for (const name of shown) {
      const sentence = say(name, { actor: "Léa Martin", name: "Atlas" });

      expect(sentence.trim().length, name).toBeGreaterThan(0);
      expect(sentence, name).not.toContain("{");
    }
    expect(say("other", { actor: "Léa Martin" })).toContain("Léa Martin");
    expect(say("someone").length).toBeGreaterThan(0);
  });

  it("says the activity as the home writes it, in both languages", () => {
    expect(sayer("en", en)("project.created", { actor: "Léa Martin", name: "Atlas" })).toBe("Léa Martin created Atlas");
    expect(sayer("fr", fr)("project.created", { actor: "Léa Martin", name: "Atlas" })).toBe("Léa Martin a créé Atlas");
    expect(sayer("en", en)("other", { actor: "Léa Martin" })).toBe("Léa Martin did something");
    expect(sayer("en", en)("someone")).toBe("Someone");
    expect(sayer("fr", fr)("someone")).toBe("Quelqu'un");
  });
});
