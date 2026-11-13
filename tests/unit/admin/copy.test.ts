import type { Messages } from "../../helpers/copy";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { hardCodedCopy, keysAsked, messageAt } from "../../helpers/copy";

/**
 * The words of the admin pages and of their six tables, which were written in
 * English whatever the language of the page: every one comes from the message
 * files, which hold it in both languages (tests/unit/i18n/messages-parity.test.ts
 * keeps the two files in step).
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const ADMIN = "src/app/[locale]/(app)/(shell)/admin";

/** The pages, read from the disk: the folders of the admin that hold a `page.tsx`. */
const PAGES = readdirSync(join(ROOT, ADMIN), { recursive: true, encoding: "utf8" })
  .map((file) => file.split("\\").join("/"))
  .filter((file) => file.endsWith("/page.tsx"))
  .map((file) => `${ADMIN}/${dirname(file)}/page.tsx`)
  .sort();

/** The sources that draw words: the pages, and the six tables they are made of. */
const FILES = [
  ...PAGES,
  "src/features/admin/components/admin-users-table.tsx",
  "src/features/admin/components/admin-orgs-table.tsx",
  "src/features/audit/components/audit-log-table.tsx",
  "src/features/changelog/components/changelog-admin-table.tsx",
  "src/features/feature-flags/components/flag-admin-table.tsx",
  "src/features/waitlist/components/waitlist-admin-table.tsx",
];

const LOCALES = [
  ["en", en],
  ["fr", fr],
] as const;

function sourceOf(file: string): string {
  return readFileSync(join(ROOT, file), "utf-8");
}

/** The `{names}` a message takes, in the order it writes them (the `plural` argument is the ICU's, not a value to give). */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)(?:,|\})/g)].map(([, name = ""]) => name);
}

/** Every message of a group, with its full key. */
function flat(messages: Messages, prefix: string): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}.${key}`, value]] : flat(value, `${prefix}.${key}`),
  );
}

describe("the words of the admin pages", () => {
  it("are written in no page and no table", () => {
    // The scan has to find the pages, or it checks nothing
    expect(PAGES.length).toBeGreaterThan(0);
    for (const file of FILES) {
      expect(hardCodedCopy(sourceOf(file)), file).toEqual([]);
    }
  });

  it("exist in English and in French, every one a page or a table asks for", () => {
    const keys = [...new Set(FILES.flatMap((file) => keysAsked(sourceOf(file))))];

    // The scan has to find the words, or it checks nothing
    expect(keys.length).toBeGreaterThan(30);
    for (const [locale, messages] of LOCALES) {
      const missing = keys.filter((key) => messageAt(messages, key) === undefined);

      expect(missing, `${locale}.json lacks messages the admin asks for`).toEqual([]);
    }
  });

  it("take the same values in both languages: a translation never drops one", () => {
    for (const [key, english] of flat(en.admin as Messages, "admin")) {
      expect(placeholders(messageAt(fr, key) ?? "").sort(), key).toEqual(placeholders(english).sort());
    }
  });

  it("have a word for each status of a waitlist entry, the one that is looked up by the status itself", () => {
    for (const [locale, messages] of LOCALES) {
      for (const status of ["waiting", "invited", "joined"]) {
        expect(messageAt(messages, `admin.waitlistTable.statuses.${status}`), `${locale}: ${status}`).toBeTruthy();
      }
    }
  });

  // The line under a title is a count where the total is true, and nothing where it is not: the audit log
  // does not "view all system activity" when its list stops at 50.
  it("leave no sentence of the old headers of the feature flags and of the audit log", () => {
    for (const [locale, messages] of LOCALES) {
      expect(messageAt(messages, "admin.featureFlagsDescription"), locale).toBeUndefined();
      expect(messageAt(messages, "admin.auditLogDescription"), locale).toBeUndefined();
    }
  });

  // The words that are the same in both languages: they are not a message left in English
  const SAME_IN_BOTH = new Set(["Action", "Actions", "Date", "Description", "Email", "Slug", "Version"]);

  it("keep French words in the French file, the tables' included: nothing is copied from English", () => {
    for (const group of [
      "usersTable",
      "organizationsTable",
      "auditTable",
      "changelogTable",
      "flagsTable",
      "waitlistTable",
    ] as const) {
      const english = flat(en.admin[group] as Messages, `admin.${group}`);
      const copied = english
        .filter(([key, message]) => messageAt(fr, key) === message && !SAME_IN_BOTH.has(message))
        .map(([key]) => key);

      expect(copied, `${group} messages left in English in fr.json`).toEqual([]);
    }
  });
});

// A list that stops short says so, in its card: how many it shows and, where there is a total, out of how many
describe("the note of a list that stops short", () => {
  const say = (locale: "en" | "fr", key: string, values: Record<string, number>) =>
    createTranslator({ locale, messages: locale === "en" ? en : fr, namespace: "admin" })(key as "usersCapped", values);

  it("tells the newest users and organizations out of the total, and that search and sorting cover these only", () => {
    expect(say("en", "usersCapped", { shown: 100, total: 101 })).toBe(
      "This list shows the 100 newest users out of 101. Search and sorting cover these only.",
    );
    expect(say("en", "organizationsCapped", { shown: 100, total: 101 })).toBe(
      "This list shows the 100 newest organizations out of 101. Search and sorting cover these only.",
    );
    expect(say("fr", "usersCapped", { shown: 100, total: 101 })).toBe(
      "Cette liste montre les 100 utilisateurs les plus récents sur 101. La recherche et le tri ne portent que sur eux.",
    );
    expect(say("fr", "organizationsCapped", { shown: 100, total: 101 })).toBe(
      "Cette liste montre les 100 organisations les plus récentes sur 101. La recherche et le tri ne portent que sur elles.",
    );
  });

  it("tells the latest events and entries, which have no total, and that search and sorting cover these only", () => {
    expect(say("en", "auditCapped", { shown: 50 })).toBe(
      "This list shows the 50 latest events. Search and sorting cover these only.",
    );
    expect(say("en", "changelogCapped", { shown: 50 })).toBe(
      "This list shows the 50 latest entries. Search and sorting cover these only.",
    );
    expect(say("fr", "auditCapped", { shown: 50 })).toBe(
      "Cette liste montre les 50 événements les plus récents. La recherche et le tri ne portent que sur eux.",
    );
    expect(say("fr", "changelogCapped", { shown: 50 })).toBe(
      "Cette liste montre les 50 entrées les plus récentes. La recherche et le tri ne portent que sur elles.",
    );
  });

  // `{shown, number}` writes a figure the way the language does: a thousand in English, with a comma
  it("writes its figures the way the language does", () => {
    expect(say("en", "usersCapped", { shown: 1000, total: 12_345 })).toContain("1,000 newest users out of 12,345.");
    expect(say("fr", "usersCapped", { shown: 1000, total: 12_345 }).replaceAll(/\s/g, " ")).toContain(
      "1 000 utilisateurs les plus récents sur 12 345.",
    );
  });
});

describe("the count in the header of an admin page", () => {
  const count = (locale: "en" | "fr", key: string, value: number) =>
    createTranslator({ locale, messages: locale === "en" ? en : fr, namespace: "admin" })(key as "usersCount", { count: value });
  const NUMBERS = [0, 1, 2, 5, 21];

  it.each([
    ["usersCount", ["0 users", "1 user", "2 users", "5 users", "21 users"]],
    ["organizationsCount", ["0 organizations", "1 organization", "2 organizations", "5 organizations", "21 organizations"]],
    ["featureFlagsCount", ["0 feature flags", "1 feature flag", "2 feature flags", "5 feature flags", "21 feature flags"]],
    ["waitlistCount", ["0 signups", "1 signup", "2 signups", "5 signups", "21 signups"]],
  ])("is plural the English way, none included: %s", (key, expected) => {
    expect(NUMBERS.map((number) => count("en", key, number))).toEqual(expected);
  });

  it.each([
    ["usersCount", ["0 utilisateur", "1 utilisateur", "2 utilisateurs", "5 utilisateurs", "21 utilisateurs"]],
    ["organizationsCount", ["0 organisation", "1 organisation", "2 organisations", "5 organisations", "21 organisations"]],
    [
      "featureFlagsCount",
      [
        "0 indicateur de fonctionnalité",
        "1 indicateur de fonctionnalité",
        "2 indicateurs de fonctionnalité",
        "5 indicateurs de fonctionnalité",
        "21 indicateurs de fonctionnalité",
      ],
    ],
    ["waitlistCount", ["0 inscrit", "1 inscrit", "2 inscrits", "5 inscrits", "21 inscrits"]],
  ])("is plural the French way, zero and one being singular: %s", (key, expected) => {
    expect(NUMBERS.map((number) => count("fr", key, number))).toEqual(expected);
  });
});
