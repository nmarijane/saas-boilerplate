import type { ComponentProps, ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BillingSettingsPage, {
  generateMetadata as billingMetadata,
} from "@/app/[locale]/(app)/(shell)/settings/billing/page";
import { getShell } from "@/features/app-shell";
import { CheckoutReturnNotice } from "@/features/billing/components/checkout-return-notice";
import {
  aiCreditLedger,
  organization,
  organizationMember,
  plan,
  subscription,
  user,
} from "@/models";
import { ShellProvider } from "@/shared/components/shell/shell-context";
import {
  attribute,
  elements,
  startTags,
  textOf,
} from "../helpers/html";
import { renderWithIntl } from "../helpers/intl";
import {
  seedOrg,
  seedOrgMember,
  seedPlan,
  seedSubscription,
  seedUser,
} from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { shellLink, shellView } from "../helpers/shell";
import { testDb } from "../setup";

// The page with the real guards: only the session lookup (Better Auth) is
// replaced, so that a person is signed in as a role of a seeded workspace, and
// the page reads the in-memory database. The titles the shell gives a tab, the
// translator of the server (built from the message files, so the words are the
// real ones, and a message that is missing throws), the navigation of next-intl
// (no Next router runs in a test) are stand-ins. The page names the plan from the
// subscription it reads anyway. The plan the credits are sized by is read from the
// same rule as the shell's, the invoices are a fixed list (nothing here ran against
// Stripe), and the quotas are the ones the shell is told to hand over.

const session = vi.hoisted(() => ({ getSession: vi.fn() }));
const intl = vi.hoisted(() => ({ locale: "en" as "en" | "fr" }));

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/plan-limits", async () => ({
  getPlanSummary: async (orgId: string) => (await import("@/features/billing/queries")).getWorkspacePlan(orgId),
}));
vi.mock("@/features/billing/invoices", () => ({
  listInvoices: vi.fn(async () => [{ id: "in_1", number: "A1B2-0001", createdAt: new Date("2026-10-14T00:00:00Z"), amount: 2900, currency: "usd", status: "paid", url: "https://invoice.example/1" }]),
}));
vi.mock("@/features/auth/auth", () => ({ auth: { api: { getSession: session.getSession } } }));

vi.mock("@/features/app-shell", async () => {
  // The title the shell gives a tab, by its own rule: the page, then the context
  // (the workspace, Acme here), then the product.
  const { APP_NAME } = await import("@/shared/config/app");
  const { formatPageTitle } = await import("@/shared/shell/resolve");

  return {
    appPageMetadata: vi.fn(async (page: string) => ({
      title: { absolute: formatPageTitle({ page, context: "Acme", product: APP_NAME }) },
    })),
    getShell: vi.fn(),
  };
});

vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };
  interface Options { locale?: string; namespace?: string }

  return {
    getFormatter: async ({ locale }: { locale: "en" | "fr" }) => createFormatter({ locale, timeZone: "UTC" }),
    getTranslations: async (options?: Options) => {
      const locale = options?.locale === "fr" ? "fr" : options?.locale === "en" ? "en" : intl.locale;
      return createTranslator({
        locale,
        messages: messages[locale],
        namespace: options?.namespace as "settings",
        // A message that is missing, or that cannot be formatted, fails the test
        onError: (error) => {
          throw error;
        },
      });
    },
  };
});

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    redirect: () => undefined,
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    usePathname: () => "/settings/developers",
  };
});

const ORG = "pages-org";
const OTHER_ORG = "pages-other-org";
const OWNER = "pages-owner";
const ADMIN = "pages-admin";
const MEMBER = "pages-member";
const STRANGER = "pages-stranger";

function signIn(userId: string) {
  session.getSession.mockResolvedValue(fakeSession(userId, { activeOrganizationId: ORG }));
}

const params = (locale: "en" | "fr" = "en") => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) as Promise<Record<string, string>> });

/** A page of the settings, inside the shell that gives it its tabs. */
async function draw(page: Promise<ReactNode>, locale: "en" | "fr" = "en") {
  const view = shellView({
    settings: [
      shellLink("account", "/settings/account", "Account"),
      shellLink("billing", "/settings/billing", "Billing"),
      shellLink("developers", "/settings/developers", "Developers"),
    ],
  });

  return renderWithIntl(<ShellProvider view={view}>{await page}</ShellProvider>, locale);
}

/** Every element of a type in a tree of React elements, as a Server Component returns it. */
function findAll(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findAll(child, type));
  }
  if (!isValidElement<{ children?: ReactNode } & Record<string, unknown>>(node)) {
    return [];
  }

  return [
    ...(node.type === type ? [node] : []),
    ...Object.values(node.props).flatMap((value) => (isValidElement(value) || Array.isArray(value) ? findAll(value as ReactNode, type) : [])),
  ];
}

/** The heads of a page: its one h1 and the h2 of its sections, in order. */
function headings(html: string) {
  return { h1: elements(html, "h1").map(textOf), h2: elements(html, "h2").map(textOf) };
}

/** The line under the title of the page: what the header says of it. */
function contextOf(html: string): string {
  const [, context = ""] = /<div data-slot="page-header-context"[^>]*>([\s\S]*?)<\/div>/.exec(html) ?? [];
  return textOf(context);
}

const buttonsOf = (html: string) => elements(html, "button").map(textOf);
const DAY = 24 * 60 * 60 * 1000;

const QUOTAS = [
  { id: "projects", label: "Projects", used: 2, limit: 3, status: "ok", icon: null, tone: 1, upgradeHref: "/settings/billing" },
  { id: "ai-credits", label: "AI credits", used: 10, limit: 100, status: "ok", icon: null, tone: 2, upgradeHref: "/settings/billing" },
];

beforeEach(async () => {
  vi.clearAllMocks();
  intl.locale = "en";
  vi.mocked(getShell).mockResolvedValue({ view: { quotas: QUOTAS } } as never);
  await testDb.delete(aiCreditLedger);
  await testDb.delete(subscription);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await testDb.delete(plan);
  for (const id of [OWNER, ADMIN, MEMBER, STRANGER]) {
    await seedUser(id);
  }
  await seedOrg(ORG, { name: "Acme", slug: "acme" });
  await seedOrg(OTHER_ORG, { name: "Elsewhere", slug: "elsewhere" });
  await seedOrgMember(OWNER, ORG, "owner");
  await seedOrgMember(ADMIN, ORG, "admin");
  await seedOrgMember(MEMBER, ORG, "member");
  await seedOrgMember(STRANGER, OTHER_ORG, "owner");
  signIn(OWNER);
});

describe("the billing page", () => {
  const page = (locale: "en" | "fr" = "en", searchParams: Record<string, string> = {}) =>
    draw(BillingSettingsPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(searchParams) }), locale);

  it("heads the page with a card icon, the title and the plan the workspace is on, and puts the tabs under it", async () => {
    await seedPlan("pro");
    await seedSubscription(ORG, { planId: "pro", status: "active" });
    const html = await page();

    expect(headings(html).h1).toEqual(["Billing"]);
    expect(startTags(html, "h1")).toHaveLength(1);
    expect(contextOf(html)).toBe("Pro plan");
    expect(html).toContain('data-slot="icon-tile"');
    expect(html).toContain('data-slot="tab-links"');
    expect(attribute(startTags(html, "nav")[0] ?? "", "aria-label")).toBe("Settings");
  });

  it.each([
    ["active", "pro", "Pro"],
    ["trialing", "pro", "Pro"],
    ["past_due", "pro", "Pro"],
    ["canceled", "pro", "Free"],
    ["unpaid", "pro", "Free"],
    ["active", "legacy", "Free"],
  ])("names the plan of a %s subscription to %s: %s", async (status, planId, name) => {
    await seedPlan("pro");
    await seedPlan("legacy", { name: "Legacy" });
    await seedSubscription(ORG, { planId, status });

    expect(contextOf(await page("en"))).toBe(`${name} plan`);
    expect(contextOf(await page("fr"))).toBe(`Plan ${name}`);
  });

  it("names the free plan for a workspace that never subscribed", async () => {
    expect(contextOf(await page())).toBe("Free plan");
  });

  it("does not read the subscription of another workspace", async () => {
    await seedPlan("pro");
    await seedSubscription(OTHER_ORG, { planId: "pro" });

    expect(contextOf(await page())).toBe("Free plan");
  });

  describe("a workspace that pays", () => {
    beforeEach(async () => {
      await seedPlan("pro");
      await seedSubscription(ORG, { planId: "pro", status: "active", billingInterval: "month", currentPeriodEnd: new Date(Date.now() + 20 * DAY) });
    });

    // What a role may not do is not drawn, and every action asks the role again on the server
    it("gives the owner every button: change plan, the payment method, top up, and the cancellation", async () => {
      const html = await page();

      expect(buttonsOf(html)).toEqual(expect.arrayContaining(["Change plan", "Manage payment method", "Top up credits", "Cancel subscription"]));
      expect(headings(html).h2).toEqual(["Current Plan", "Usage this month", "Invoices", "Cancel subscription"]);
      expect(textOf(html)).toContain("A1B2-0001");
    });

    it("gives an admin everything but the cancellation, which is the owner's", async () => {
      signIn(ADMIN);
      const html = await page();

      expect(buttonsOf(html)).toEqual(expect.arrayContaining(["Change plan", "Manage payment method", "Top up credits"]));
      expect(buttonsOf(html)).not.toContain("Cancel subscription");
      expect(headings(html).h2).toEqual(["Current Plan", "Usage this month", "Invoices"]);
    });

    it("shows a member the plan, its dates, the quotas and the credits: no button, no invoice", async () => {
      signIn(MEMBER);
      const html = await page();

      expect(buttonsOf(html)).toEqual([]);
      expect(headings(html).h2).toEqual(["Current Plan", "Usage this month"]);
      expect(textOf(html)).toContain("Its owner and admins manage the billing");
      expect(textOf(html)).not.toContain("A1B2-0001");
      expect(textOf(html)).toContain("left of 5,000 this month");
    });

    it("leaves the plan's credits out of the quota cards: the credits card says them, in what is left", async () => {
      const html = await page();

      expect(textOf(html)).toContain("Projects");
      expect(elements(html, "h3").map(textOf).filter((title) => title === "AI credits")).toHaveLength(1);
    });

    it("tells a payment that failed, above everything: the plan is kept while it is retried", async () => {
      await testDb.update(subscription).set({ status: "past_due" });
      const html = await page();

      expect(textOf(html)).toContain("Your last payment failed");
      expect(contextOf(html)).toBe("Pro plan");
      signIn(MEMBER);
      expect(textOf(await page())).toContain("An owner or an admin needs to update the payment method");
    });

    it("tells that the plan ends, and lets the owner alone take the cancellation back", async () => {
      await testDb.update(subscription).set({ cancelAtPeriodEnd: true });

      expect(textOf(await page())).toContain("Your Pro subscription is cancelled");
      expect(buttonsOf(await page())).toContain("Keep my subscription");
      expect(buttonsOf(await page())).not.toContain("Cancel subscription");
      signIn(ADMIN);
      expect(buttonsOf(await page())).not.toContain("Keep my subscription");
    });

    it("keeps the way to take a cancellation back for the owner, in the plan card, when a failed payment takes the alert", async () => {
      await testDb.update(subscription).set({ status: "past_due", cancelAtPeriodEnd: true });

      expect(textOf(await page())).toContain("Your last payment failed");
      expect(buttonsOf(await page())).toContain("Keep my subscription");
      signIn(ADMIN);
      expect(buttonsOf(await page())).not.toContain("Keep my subscription");
    });

    it("tells when a free trial ends", async () => {
      await testDb.update(subscription).set({ status: "trialing", trialEnd: new Date(Date.UTC(2026, 11, 2)) });
      const html = await page();

      expect(textOf(html)).toContain("Free trial of the Pro plan");
      expect(textOf(html)).toContain("Your trial ends on December 2, 2026");
      expect(textOf(html)).toContain("unless you cancel before");
    });

    // Only the owner can cancel: the others are not promised a way out
    it("promises a way out of it to the owner only", async () => {
      await testDb.update(subscription).set({ status: "trialing", trialEnd: new Date(Date.UTC(2026, 11, 2)) });
      signIn(ADMIN);
      const html = await page();

      expect(textOf(html)).toContain("Your trial ends on December 2, 2026");
      expect(textOf(html)).not.toContain("unless you cancel");
      expect(textOf(html)).toContain("The subscription starts then.");
    });
  });

  describe("a workspace on the free plan", () => {
    it("leads the admin to the choice of a plan, and has no invoice, no cancellation and no payment method", async () => {
      const html = await page();

      expect(textOf(html)).toContain("Choose a plan");
      expect(attribute(startTags(html, "a").find((tag) => tag.includes("/choose-plan")) ?? "", "href")).toBe("/choose-plan");
      expect(buttonsOf(html)).not.toEqual(expect.arrayContaining(["Change plan"]));
      expect(buttonsOf(html)).not.toContain("Manage payment method");
      expect(buttonsOf(html)).not.toContain("Cancel subscription");
      expect(headings(html).h2).toEqual(["Current Plan", "Usage this month"]);
    });

    it("grants its monthly credits at the first use, and shows what is left of them", async () => {
      const html = await page();

      expect(textOf(html)).toContain("left of 100 this month");
      expect(await testDb.select().from(aiCreditLedger)).toMatchObject([{ amount: 100, reason: "plan_allocation", bucket: "allocation" }]);
    });
  });

  it("tells a payment that was made, once: the page that waited sends the buyer here with the news", async () => {
    const [notice] = findAll(await BillingSettingsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ checkout: "success" }) }), CheckoutReturnNotice);
    expect(notice?.props).toEqual({ checkout: "success" });

    const [credits] = findAll(await BillingSettingsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ checkout: "credits" }) }), CheckoutReturnNotice);
    expect(credits?.props).toEqual({ checkout: "credits" });

    expect(findAll(await BillingSettingsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ checkout: "<script>" }) }), CheckoutReturnNotice)).toEqual([]);
  });

  it("titles the tab through the shell, in the language of the page", async () => {
    expect((await billingMetadata(params("en"))).title).toEqual({ absolute: "Billing · Acme — SaaS Boilerplate" });
    expect((await billingMetadata(params("fr"))).title).toEqual({ absolute: "Abonnement · Acme — SaaS Boilerplate" });
  });

  it("speaks French", async () => {
    intl.locale = "fr";
    const html = await page("fr");

    expect(headings(html).h1).toEqual(["Abonnement"]);
    expect(headings(html).h2).toEqual(["Offre actuelle", "Utilisation ce mois-ci"]);
    expect(contextOf(html)).toBe("Plan Free");
    expect(textOf(html)).toContain("restants sur 100 ce mois-ci");
  });
});
