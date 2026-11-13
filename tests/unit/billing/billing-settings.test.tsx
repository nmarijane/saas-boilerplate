import { describe, expect, it, vi } from "vitest";
import { BillingSettings } from "@/features/billing/components/billing-settings";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { messageAt } from "../../helpers/copy";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The cards call the checkout and the portal, which are replaced: nothing here reaches the payment provider.
vi.mock("@/features/billing/actions", () => ({
  createCheckoutSessionAction: vi.fn(),
  createPortalSessionAction: vi.fn(),
}));

type Locale = "en" | "fr";

describe("the cards of the subscription", () => {
  const render = (props: Partial<Parameters<typeof BillingSettings>[0]> = {}, locale: Locale = "en") =>
    renderWithIntl(<BillingSettings orgId="org_1" planId="free" status="active" canManage {...props} />, locale);

  it("gives each card a level-two title, under the one h1 of the page's header", () => {
    const html = render();

    expect(startTags(html, "h1")).toEqual([]);
    expect(elements(html, "h2").map(textOf)).toEqual(["Current Plan", "Plan Limits", "Upgrade your plan"]);
    for (const title of startTags(html, "h2")) {
      expect(attribute(title, "data-slot")).toBe("card-title");
    }
  });

  it("tells the plan, its status, its price and its limits, as it did", () => {
    const text = textOf(render());

    expect(text).toContain("Status");
    expect(text).toContain("Active");
    expect(text).toContain("Price");
    expect(text).toContain("Free");
    expect(text).toContain("Team Members");
    expect(text).toContain("Storage (MB)");
    expect(text).toContain("AI Credits / month");
    expect(text).toContain("Upgrade to Pro — $29/mo");
  });

  it("says the price of a paid plan with the unit, and an unlimited limit in words", () => {
    const html = render({ planId: "enterprise", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") });

    expect(textOf(html)).toContain("$99/mo");
    expect(textOf(html)).toContain("Unlimited");
    expect(textOf(html)).toContain("Current period ends");
    expect(elements(html, "h2").map(textOf)).toEqual(["Current Plan", "Plan Limits"]);
    expect(elements(html, "button").map(textOf)).toEqual(["Manage Billing"]);
  });

  // A member sees the plan, its status and its limits, and no button: changing the
  // plan and opening the billing portal are an admin's, and the server asks it again.
  it("draws no button for a person who cannot manage the subscription, and says who can", () => {
    for (const planId of ["free", "pro"]) {
      const html = render({ planId, canManage: false });

      expect(elements(html, "button"), planId).toEqual([]);
      expect(elements(html, "h2").map(textOf), planId).toEqual(["Current Plan", "Plan Limits"]);
      expect(textOf(html), planId).toContain(en.billing.memberDescription);
      expect(textOf(html), planId).not.toContain(en.billing.manageDescription);
    }
    expect(textOf(render({ canManage: false }, "fr"))).toContain(fr.billing.memberDescription);
  });

  it("says a status in words, and a status it does not know as it is written", () => {
    expect(textOf(render({ planId: "pro", status: "past_due" }))).toContain("Past due");
    expect(textOf(render({ planId: "pro", status: "paused_by_bank" }))).toContain("paused_by_bank");
  });

  it("speaks French: no English left in the cards", () => {
    const text = textOf(render({}, "fr"));

    expect(elements(render({}, "fr"), "h2").map(textOf)).toEqual(["Plan actuel", "Limites du plan", "Passez à un plan supérieur"]);
    expect(text).toContain("Gérez votre abonnement et votre facturation");
    expect(text).toContain("Statut");
    expect(text).toContain("Actif");
    expect(text).toContain("Prix");
    expect(text).toContain("Gratuit");
    expect(text).toContain("Membres de l'équipe");
    expect(text).toContain("Passer au plan Pro — 29 $ par mois");
    for (const english of ["Current Plan", "Plan Limits", "Status", "Price", "Unlimited", "Upgrade", "Manage Billing", "Redirecting"]) {
      expect(text, english).not.toContain(english);
    }
  });

  it("speaks French on a paid plan too", () => {
    const html = render({ planId: "enterprise", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") }, "fr");

    expect(textOf(html)).toContain("Illimité");
    expect(textOf(html)).toContain("99 $ par mois");
    expect(textOf(html)).toContain("Fin de la période en cours");
    expect(elements(html, "button").map(textOf)).toEqual(["Gérer la facturation"]);
  });

  // A date is told by the language of the page, not by the one of the browser or of the server: the
  // person who reads the French page in a browser that speaks English reads « 1 déc. 2026 », and not 12/1/2026.
  describe("the end of the period", () => {
    const END = new Date("2026-12-01T00:00:00.000Z");
    const endOf = (locale: Locale) => {
      const html = render({ planId: "pro", currentPeriodEnd: END }, locale);
      const [time = ""] = elements(html, "time");

      return { html, time };
    };

    it("is a day in a time element, as the dates of the keys and of the endpoints are, with the moment it stands for", () => {
      const { html, time } = endOf("en");

      expect(startTags(time, "time").map((tag) => attribute(tag, "dateTime"))).toEqual(["2026-12-01T00:00:00.000Z"]);
      expect(textOf(time)).toBe("Dec 1, 2026");
      expect(textOf(html)).toContain("Current period endsDec 1, 2026");
    });

    it("is told in French on the French page, whatever the browser speaks", () => {
      const { html, time } = endOf("fr");

      expect(textOf(time)).toBe("1 déc. 2026");
      expect(startTags(time, "time").map((tag) => attribute(tag, "dateTime"))).toEqual(["2026-12-01T00:00:00.000Z"]);
      expect(textOf(html)).toContain("Fin de la période en cours1 déc. 2026");
      expect(textOf(html)).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it("takes a date that crossed from the server as text, as it does when it is not a date object", () => {
      const html = render({ planId: "pro", currentPeriodEnd: "2026-12-01T00:00:00.000Z" as unknown as Date }, "fr");

      expect(textOf(elements(html, "time")[0] ?? "")).toBe("1 déc. 2026");
    });

    it("is not drawn when the subscription has none", () => {
      expect(render({ planId: "free" })).not.toContain("<time");
      expect(render({ planId: "pro", currentPeriodEnd: null })).not.toContain("<time");
    });
  });

  // `capitalize` was there for the raw word of the provider, which is in lower case ("past_due"). On a message it
  // turns each word into a capital: « Paiement En Retard », « Période D'essai ».
  describe("the status", () => {
    const statusOf = (html: string) => {
      const label = elements(html, "span").find((span) => textOf(span) === "Status" || textOf(span) === "Statut") ?? "";
      const [, value = ""] = html.slice(html.indexOf(label) + label.length).match(/^<span class="([^"]*)">/) ?? [];
      return value;
    };

    it("keeps its case when it is a message: no class capitalizes it", () => {
      for (const [locale, status, words] of [
        ["en", "past_due", "Past due"],
        ["fr", "past_due", "Paiement en retard"],
        ["fr", "trialing", "Période d'essai"],
      ] as const) {
        const html = render({ planId: "pro", status }, locale);

        expect(textOf(html), `${locale} ${status}`).toContain(words);
        expect(statusOf(html), `${locale} ${status}`).not.toContain("capitalize");
        expect(html).not.toContain(`class="capitalize">${words}`);
      }
    });

    it("is capitalized only when it is the raw word of the provider, a status the messages do not know", () => {
      const html = render({ planId: "pro", status: "paused_by_bank" });

      expect(html).toContain('<span class="capitalize">paused_by_bank</span>');
      expect(classesOf(startTags(html, "span").find((tag) => tag.includes("capitalize")) ?? "")).toEqual(["capitalize"]);
    });
  });

  it("has a message for each state the payment provider reports for a subscription, and for each limit a plan has, in both languages", () => {
    for (const [locale, messages] of [["en", en], ["fr", fr]] as const) {
      for (const status of ["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
        expect(messageAt(messages, `billing.statuses.${status}`), `${locale}: ${status}`).toBeTruthy();
      }
      for (const limit of ["members", "projects", "storage", "aiCredits"]) {
        expect(messageAt(messages, `billing.limits.${limit}`), `${locale}: ${limit}`).toBeTruthy();
      }
    }
  });
});
