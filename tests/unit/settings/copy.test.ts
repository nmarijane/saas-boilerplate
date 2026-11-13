import type { Messages } from "../../helpers/copy";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { hardCodedCopy, keysAsked, messageAt } from "../../helpers/copy";

/**
 * The words of the settings pages (account, team, notifications, developers,
 * billing): every one comes from the message files, which hold it in both
 * languages (tests/unit/i18n/messages-parity.test.ts keeps the two files in step).
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const SHELL = "src/app/[locale]/(app)/(shell)/settings";

/** The sources that draw words: the pages, and the components they are made of. */
const FILES = [
  `${SHELL}/account/page.tsx`,
  `${SHELL}/team/page.tsx`,
  `${SHELL}/notifications/page.tsx`,
  `${SHELL}/developers/page.tsx`,
  `${SHELL}/billing/page.tsx`,
  "src/features/settings/components/active-sessions.tsx",
  "src/features/settings/components/change-password-form.tsx",
  "src/features/settings/components/connected-accounts.tsx",
  "src/features/settings/components/delete-account-zone.tsx",
  "src/features/settings/components/profile-form.tsx",
  "src/features/auth/organization/components/delete-workspace-zone.tsx",
  "src/features/auth/organization/components/invite-button.tsx",
  "src/features/auth/organization/components/invite-modal.tsx",
  "src/features/auth/organization/components/members-list.tsx",
  "src/features/auth/organization/components/role-badge.tsx",
  "src/features/notifications/components/mark-all-read-button.tsx",
  "src/features/notifications/components/notification-list.tsx",
  "src/features/api-keys/components/api-key-list.tsx",
  "src/features/api-keys/components/create-key-button.tsx",
  "src/features/api-keys/components/create-key-modal.tsx",
  "src/features/api-keys/components/key-status-badge.tsx",
  "src/features/webhooks/components/create-webhook-modal.tsx",
  "src/features/webhooks/components/webhook-list.tsx",
  "src/features/billing/components/billing-settings.tsx",
  "src/shared/components/ui/copy-code.tsx",
];

const LOCALES = [
  ["en", en],
  ["fr", fr],
] as const;

function sourceOf(file: string): string {
  return readFileSync(join(ROOT, file), "utf-8");
}

/** The `{names}` a message takes, in the order it writes them (the `plural` and `select` arguments are the ICU's, not values to give). */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)(?:,|\})/g)].map(([, name = ""]) => name);
}

/** Every message of a group, with its full key. */
function flat(messages: Messages, prefix: string): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}.${key}`, value]] : flat(value, `${prefix}.${key}`),
  );
}

describe("the words of the settings pages", () => {
  it("are written in no component and no page", () => {
    for (const file of FILES) {
      expect(hardCodedCopy(sourceOf(file)), file).toEqual([]);
    }
  });

  it("exist in English and in French, every one a component or a page asks for", () => {
    const keys = [...new Set(FILES.flatMap((file) => keysAsked(sourceOf(file))))];

    // The scan has to find the words, or it checks nothing
    expect(keys.length).toBeGreaterThan(60);
    for (const [locale, messages] of LOCALES) {
      const missing = keys.filter((key) => messageAt(messages, key) === undefined);

      expect(missing, `${locale}.json lacks messages the settings ask for`).toEqual([]);
    }
  });

  it("take the same values in both languages: a translation never drops one", () => {
    for (const namespace of ["settings", "organization", "notifications", "apiKeys", "webhooks", "billing", "common"] as const) {
      for (const [key, english] of flat(en[namespace] as Messages, namespace)) {
        expect(placeholders(messageAt(fr, key) ?? "").sort(), key).toEqual(placeholders(english).sort());
      }
    }
  });

  it("have a word for each role a badge or a menu can say, the one that is looked up by the role itself", () => {
    for (const [, messages] of LOCALES) {
      for (const role of ["owner", "admin", "member"]) {
        expect(messageAt(messages, `organization.${role}`), role).toBeTruthy();
      }
    }
  });

  it("leave nothing of the pages that are gone: the danger zone, the old titles, the team title that was one word and the old API page", () => {
    for (const [locale, messages] of LOCALES) {
      for (const key of [
        "settings.dangerZone",
        "settings.deleteAccount",
        "settings.deleteAccountWarning",
        "settings.updateProfile",
        "settings.api",
        "settings.apiDescription",
        "settings.apiKeys",
        "settings.createApiKey",
        "settings.revokeApiKey",
        "settings.webhookEndpoints",
        "settings.createWebhook",
        "settings.webhookUrl",
        "settings.webhookEvents",
        "settings.webhookSecret",
      ]) {
        expect(messageAt(messages, key), `${locale}: ${key}`).toBeUndefined();
      }
      // Each is a group now, with a title (and, for the team, a count)
      expect(messageAt(messages, "settings.team.title"), locale).toBeTruthy();
      expect(messageAt(messages, "settings.account.title"), locale).toBeTruthy();
      expect(messageAt(messages, "settings.developers.title"), locale).toBeTruthy();
      expect(messageAt(messages, "settings.billing.title"), locale).toBeTruthy();
    }
  });

  it("tell what to type through the confirmation dialog: the word itself is a value it is given, never a message", () => {
    for (const [locale, messages] of LOCALES) {
      expect(messageAt(messages, "common.typeToConfirm"), locale).toContain("{text}");
    }
  });
});

describe("the French name of an API key", () => {
  it("is « clé d'API » everywhere, plurals included: never « clé API »", () => {
    const sayings = flat(fr as Messages, "").filter(([, message]) => /\bcl[ée]s? API\b/i.test(message));

    expect(sayings, "French messages that say « clé API »").toEqual([]);
    // And it is the word that is said, where a key is named
    expect(messageAt(fr, "apiKeys.task")).toBe("Créez votre première clé d'API");
    expect(messageAt(fr, "apiKeys.taskAction")).toBe("Créer une clé d'API");
    expect(messageAt(fr, "activity.api_key.created")).toBe("{actor} a créé une clé d'API");
    expect(messageAt(fr, "activity.api_key.revoked")).toBe("{actor} a révoqué une clé d'API");
  });
});

describe("the number of members", () => {
  const count = (locale: "en" | "fr", members: number) =>
    createTranslator({ locale, messages: locale === "en" ? en : fr, namespace: "settings.team" })("count", { count: members });

  it("is plural the English way: one member, otherwise members, none included", () => {
    expect([0, 1, 2, 5, 21].map((members) => count("en", members))).toEqual([
      "0 members",
      "1 member",
      "2 members",
      "5 members",
      "21 members",
    ]);
  });

  it("is plural the French way: zero and one are singular, from two on membres", () => {
    expect([0, 1, 2, 5, 21].map((members) => count("fr", members))).toEqual([
      "0 membre",
      "1 membre",
      "2 membres",
      "5 membres",
      "21 membres",
    ]);
  });
});

describe("the number of unread notifications", () => {
  const count = (locale: "en" | "fr", unread: number) =>
    createTranslator({ locale, messages: locale === "en" ? en : fr, namespace: "notifications" })("unreadCount", { count: unread });

  it("is said in words when there is none, and plural the English way after", () => {
    expect([0, 1, 2, 5, 21].map((unread) => count("en", unread))).toEqual([
      "No unread notifications",
      "1 unread notification",
      "2 unread notifications",
      "5 unread notifications",
      "21 unread notifications",
    ]);
  });

  it("is said in words when there is none, and plural the French way after: one is singular, from two on non lues", () => {
    expect([0, 1, 2, 5, 21].map((unread) => count("fr", unread))).toEqual([
      "Aucune notification non lue",
      "1 notification non lue",
      "2 notifications non lues",
      "5 notifications non lues",
      "21 notifications non lues",
    ]);
  });
});
