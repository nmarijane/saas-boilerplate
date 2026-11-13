import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChatError } from "@/features/ai/components/chat-error";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The navigation of next-intl is replaced (no Next router runs in a test): its Link marks what it
// draws, so that a link that keeps the locale is told from a plain anchor.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, "data-locale-link": "", ...props }),
  };
});

/**
 * What the chat tells when its route refuses or fails, one state each: no credits
 * left (an admin is offered the way to a bigger plan, a member is told to ask an
 * admin), a workspace that is gone or out of reach (reload), and a message that
 * got no answer (try again). The words are the message files'; never the
 * sentence of the server. What the buttons do is the job of the plays of its
 * stories: Node has no DOM to click in.
 */

type Locale = "en" | "fr";

function draw(
  failure: ComponentProps<typeof ChatError>["failure"],
  { upgradeHref = null, locale = "en" }: { upgradeHref?: string | null; locale?: Locale } = {},
) {
  return renderWithIntl(<ChatError failure={failure} upgradeHref={upgradeHref} onReload={() => {}} onRetry={() => {}} />, locale);
}

/** The alert of the state: it interrupts assistive technology, as an error does. */
const alertOf = (html: string) => startTags(html, "div").find((tag) => attribute(tag, "data-slot") === "page-alert") ?? "";

describe("the chat's account of what went wrong", () => {
  describe("no credits left", () => {
    it("tells the admin that the workspace has none left, and offers the way to a bigger plan", () => {
      const html = draw("credits", { upgradeHref: "/settings/billing" });

      expect(textOf(html)).toContain("No credits left");
      expect(textOf(html)).toContain("This workspace has used all its credits. Upgrade the plan to keep using the assistant.");
      const [link] = startTags(html, "a");
      expect(attribute(link ?? "", "href")).toBe("/settings/billing");
      expect(link).toContain("data-locale-link");
      expect(textOf(elements(html, "a")[0] ?? "")).toBe("Upgrade");
    });

    it("tells a member to ask an admin, and offers no way they could not take", () => {
      const html = draw("credits");

      expect(textOf(html)).toContain("No credits left");
      expect(textOf(html)).toContain("This workspace has used all its credits. Ask an admin to upgrade the plan.");
      expect(startTags(html, "a")).toHaveLength(0);
      expect(startTags(html, "button")).toHaveLength(0);
    });

    it("is a warning, which interrupts a screen reader and is not drawn as a failure", () => {
      const html = draw("credits", { upgradeHref: "/settings/billing" });

      expect(attribute(alertOf(html), "role")).toBe("alert");
      expect(classesOf(alertOf(html))).toContain("bg-warning-bg");
    });

    it("says it in French, for the admin and for the member", () => {
      const admin = draw("credits", { upgradeHref: "/settings/billing", locale: "fr" });
      const member = draw("credits", { locale: "fr" });

      expect(textOf(admin)).toContain("Plus de crédits");
      expect(textOf(admin)).toContain("Cet espace a utilisé tous ses crédits. Passez à un plan supérieur pour continuer à utiliser l'assistant.");
      expect(textOf(elements(admin, "a")[0] ?? "")).toBe("Passer au plan supérieur");
      expect(textOf(member)).toContain("Cet espace a utilisé tous ses crédits. Demandez à un administrateur de passer à un plan supérieur.");
    });
  });

  describe("a workspace that is gone or out of reach", () => {
    it("says so, and offers to reload", () => {
      const html = draw("gone");

      expect(textOf(html)).toContain("You can't continue here");
      expect(textOf(html)).toContain("This workspace was deleted, you no longer have access to it, or your session has ended. Reload the page to continue.");
      const buttons = elements(html, "button");
      expect(buttons).toHaveLength(1);
      expect(textOf(buttons[0] ?? "")).toBe("Reload the page");
      expect(attribute(startTags(html, "button")[0] ?? "", "type")).toBe("button");
    });

    it("is drawn as a failure, and interrupts a screen reader", () => {
      const html = draw("gone");

      expect(attribute(alertOf(html), "role")).toBe("alert");
      expect(classesOf(alertOf(html))).toContain("text-danger-text");
    });

    it("offers no link to billing, whatever the person may do: it is not a matter of credits", () => {
      expect(startTags(draw("gone", { upgradeHref: "/settings/billing" }), "a")).toHaveLength(0);
    });

    it("says it in French", () => {
      const html = draw("gone", { locale: "fr" });

      expect(textOf(html)).toContain("Vous ne pouvez pas continuer ici");
      expect(textOf(html)).toContain("Cet espace a été supprimé, vous n'y avez plus accès ou votre session a pris fin. Rechargez la page pour continuer.");
      expect(textOf(elements(html, "button")[0] ?? "")).toBe("Recharger la page");
    });
  });

  describe("a message that got no answer", () => {
    it("says so, and offers to try again", () => {
      const html = draw("failed");

      expect(textOf(html)).toContain("Something went wrong");
      expect(textOf(html)).toContain("Your message didn't get an answer. Try again in a moment, or rephrase it.");
      const buttons = elements(html, "button");
      expect(buttons).toHaveLength(1);
      expect(textOf(buttons[0] ?? "")).toBe("Try again");
      expect(attribute(startTags(html, "button")[0] ?? "", "type")).toBe("button");
    });

    it("is drawn as a failure, and interrupts a screen reader", () => {
      const html = draw("failed");

      expect(attribute(alertOf(html), "role")).toBe("alert");
      expect(classesOf(alertOf(html))).toContain("text-danger-text");
    });

    it("says it in French", () => {
      const html = draw("failed", { locale: "fr" });

      expect(textOf(html)).toContain("Une erreur est survenue");
      expect(textOf(html)).toContain("Votre message n'a pas reçu de réponse. Réessayez dans un instant, ou reformulez-le.");
      expect(textOf(elements(html, "button")[0] ?? "")).toBe("Réessayer");
    });
  });

  it("offers one way out in each state, never two", () => {
    expect(startTags(draw("credits", { upgradeHref: "/settings/billing" }), "a")).toHaveLength(1);
    expect(startTags(draw("credits", { upgradeHref: "/settings/billing" }), "button")).toHaveLength(0);
    expect(elements(draw("gone"), "button")).toHaveLength(1);
    expect(elements(draw("failed"), "button")).toHaveLength(1);
  });
});
