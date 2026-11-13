import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import ShellNotFound from "@/app/[locale]/(app)/(shell)/not-found";
import LocaleNotFound from "@/app/[locale]/not-found";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { APP_NAME } from "@/shared/config/app";
import { attribute, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl is replaced: a plain anchor stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
  };
});

const MESSAGES = { en, fr } as const;

describe.each(["en", "fr"] as const)("the not-found pages in %s", (locale) => {
  const words = MESSAGES[locale].states.notFound;

  describe("of the shell", () => {
    const html = renderWithIntl(<ShellNotFound />, locale);

    it("says what happened under the one h1 of the page, in the words of the language", () => {
      expect(startTags(html, "h1")).toHaveLength(1);
      expect(textOf(elements(html, "h1")[0])).toBe(words.title);
      expect(textOf(html)).toContain(words.description);
    });

    it("leads back to the home of the workspace, with one link", () => {
      const links = elements(html, "a");

      expect(links).toHaveLength(1);
      expect(attribute(links[0], "href")).toBe("/dashboard");
      expect(textOf(links[0])).toBe(words.home);
    });

    // The shell is already drawn around it: a second landmark or logo would double it
    it("draws no page of its own: no landmark, no logo", () => {
      expect(startTags(html, "main")).toHaveLength(0);
      expect(textOf(html)).not.toContain(APP_NAME);
    });
  });

  describe("of the language", () => {
    const html = renderWithIntl(<LocaleNotFound />, locale);

    it("says what happened under the one h1 of the page, in the words of the language", () => {
      expect(startTags(html, "h1")).toHaveLength(1);
      expect(textOf(elements(html, "h1")[0])).toBe(words.title);
      expect(textOf(html)).toContain(words.description);
    });

    it("is a page of its own, with the logo that leads home and a way out that leads home too", () => {
      expect(startTags(html, "main")).toHaveLength(1);

      const links = elements(html, "a");
      expect(links).toHaveLength(2);
      expect(links.map((link) => attribute(link, "href"))).toEqual(["/", "/"]);
      expect(textOf(links[0])).toBe(APP_NAME);
      expect(textOf(links[1])).toBe(words.home);
    });
  });
});
