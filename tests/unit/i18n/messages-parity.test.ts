import { describe, expect, it, vi } from "vitest";
import { FEATURES } from "@/features/registry";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";

// Loading the registry loads each shell, and with it the components the shell
// mounts. The locale-aware navigation of next-intl is replaced (no Next router runs
// in a test): a stand-in gives those components the names they import (as in
// tab-links.test.tsx). Nothing is rendered here.
vi.mock("@/shared/lib/i18n-navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
}));

interface Messages {
  [key: string]: string | Messages;
}

/** Every message of a locale, by its full key ("settings.nav.team"). */
function flatten(messages: Messages, prefix = ""): Map<string, unknown> {
  const flat = new Map<string, unknown>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [nested, leaf] of flatten(value, path)) flat.set(nested, leaf);
    }
    else {
      flat.set(path, value);
    }
  }
  return flat;
}

const LOCALES = { en: flatten(en as Messages), fr: flatten(fr as Messages) };

/** The keys a feature shell asks the translator for, by feature. */
function labelKeysOf(): { feature: string; key: string }[] {
  return FEATURES.flatMap((shell) => {
    const keys = [
      ...(shell.nav ?? []).map(({ labelKey }) => labelKey),
      ...(shell.settings ?? []).map(({ labelKey }) => labelKey),
      ...(shell.account ?? []).map(({ labelKey }) => labelKey),
      ...(shell.quotas ?? []).map(({ labelKey }) => labelKey),
      ...(shell.tasks ?? []).flatMap(({ labelKey, action }) => [labelKey, action.labelKey]),
    ];
    return keys.map((key) => ({ feature: shell.id, key }));
  });
}

describe("messages", () => {
  it("gives French every English key, and the reverse", () => {
    const english = [...LOCALES.en.keys()];
    const french = [...LOCALES.fr.keys()];

    expect(english.filter((key) => !LOCALES.fr.has(key)), "keys missing from fr.json").toEqual([]);
    expect(french.filter((key) => !LOCALES.en.has(key)), "keys missing from en.json").toEqual([]);
  });

  it("leaves no message empty", () => {
    for (const [locale, flat] of Object.entries(LOCALES)) {
      const empty = [...flat].filter(([, value]) => typeof value !== "string" || value.trim() === "").map(([key]) => key);

      expect(empty, `${locale}.json holds empty messages`).toEqual([]);
    }
  });

  it("translates every label a feature shell names", () => {
    const labels = [
      ...labelKeysOf(),
      // Added by the assembly itself, whatever the features installed.
      { feature: "shell", key: "shell.nav.help" },
    ];

    expect(labels.length).toBeGreaterThan(1);
    for (const [locale, flat] of Object.entries(LOCALES)) {
      const missing = labels.filter(({ key }) => typeof flat.get(key) !== "string").map(({ feature, key }) => `${feature}: ${key}`);

      expect(missing, `${locale}.json lacks labels the shells name`).toEqual([]);
    }
  });
});
