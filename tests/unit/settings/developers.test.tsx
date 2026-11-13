import type { FeatureShell, ShellRole } from "@/shared/shell/contract";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { apiKeysShell } from "@/features/api-keys/shell";
import { webhooksShell } from "@/features/webhooks/shell";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { assembleShellView } from "@/shared/shell/assemble";
import { USER } from "../../helpers/shell";

const ORG = "org_1";

type Locale = "en" | "fr";

describe("the counts of the developers page", () => {
  const context = (locale: Locale, keys: number, endpoints: number) =>
    createTranslator({
      locale,
      messages: locale === "en" ? en : fr,
      namespace: "settings.developers",
    })("context", { keys, endpoints });

  it("names the counts of the developers page", () => {
    expect(context("fr", 2, 1)).toBe("2 clés d'API · 1 webhook");
    expect(context("fr", 1, 0)).toBe("1 clé d'API · 0 webhook");
    expect(context("en", 2, 1)).toBe("2 API keys · 1 webhook");
    expect(context("en", 1, 0)).toBe("1 API key · 0 webhooks");
  });

  it("is plural the English way, each count on its own: one is singular, zero and the rest are not", () => {
    expect([0, 1, 2, 5, 21].map((count) => context("en", count, count))).toEqual([
      "0 API keys · 0 webhooks",
      "1 API key · 1 webhook",
      "2 API keys · 2 webhooks",
      "5 API keys · 5 webhooks",
      "21 API keys · 21 webhooks",
    ]);
  });

  it("is plural the French way: zero and one are singular, from two on plural", () => {
    expect([0, 1, 2, 5, 21].map((count) => context("fr", count, count))).toEqual([
      "0 clé d'API · 0 webhook",
      "1 clé d'API · 1 webhook",
      "2 clés d'API · 2 webhooks",
      "5 clés d'API · 5 webhooks",
      "21 clés d'API · 21 webhooks",
    ]);
  });
});

describe("the Developers tab of the settings", () => {
  // The two features declare the same tab, which is one: whichever is installed draws it, and
  // the shell keeps the first. It is for the admins: a member, who is sent home from the page, is not shown it.
  const tabsOf = (features: FeatureShell[], role: ShellRole) =>
    assembleShellView({
      snapshot: { user: USER, workspace: { id: ORG, name: "Acme", role }, workspaces: [] },
      features,
      t: (labelKey) => labelKey,
      plans: new Map(),
      usage: new Map(),
      productName: "Example",
      helpUrl: null,
      renderIcon: () => null,
    }).settings.map(({ id, href, label }) => ({ id, href, label }));

  const DEVELOPERS = { id: "developers", href: "/settings/developers", label: "settings.nav.developers" };

  it("is drawn once for an admin and for the owner, though two features declare it", () => {
    for (const role of ["admin", "owner"] as const) {
      expect(tabsOf([apiKeysShell, webhooksShell], role), role).toEqual([DEVELOPERS]);
    }
  });

  it("is drawn once when only one of the two features is installed", () => {
    expect(tabsOf([apiKeysShell], "admin")).toEqual([DEVELOPERS]);
    expect(tabsOf([webhooksShell], "admin")).toEqual([DEVELOPERS]);
  });

  it("is not drawn for a plain member, whichever features are installed", () => {
    expect(tabsOf([apiKeysShell, webhooksShell], "member")).toEqual([]);
    expect(tabsOf([apiKeysShell], "member")).toEqual([]);
    expect(tabsOf([webhooksShell], "member")).toEqual([]);
  });

  it("goes where the page is", () => {
    expect(apiKeysShell.settings?.[0]?.href).toBe("/settings/developers");
    expect(webhooksShell.settings?.[0]?.href).toBe("/settings/developers");
  });
});
