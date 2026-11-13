import type { ComponentProps, ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BillingSettingsPage, {
  generateMetadata as billingMetadata,
} from "@/app/[locale]/(app)/(shell)/settings/billing/page";
import { getShell } from "@/features/app-shell";
import { BillingSettings } from "@/features/billing/components/billing-settings";
import {
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
// subscription it reads anyway: it never asks the shell, which would read every
// plan and every figure again.

const session = vi.hoisted(() => ({ getSession: vi.fn() }));
const intl = vi.hoisted(() => ({ locale: "en" as "en" | "fr" }));

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
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
  const { createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };
  interface Options { locale?: string; namespace?: string }

  return {
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

const params = (locale: "en" | "fr" = "en") => ({ params: Promise.resolve({ locale }) });

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

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  vi.clearAllMocks();
  intl.locale = "en";
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
  const page = (locale: "en" | "fr" = "en") => draw(BillingSettingsPage(params(locale)), locale);

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

  it("says the plan the subscription gives, as the account menu does: from the same rule", async () => {
    await seedPlan("enterprise", { name: "Enterprise" });
    await seedSubscription(ORG, { planId: "enterprise", status: "active" });

    expect(contextOf(await page())).toBe("Enterprise plan");
  });

  it.each([
    ["active", "pro", "Pro"],
    ["trialing", "pro", "Pro"],
    ["canceled", "pro", "Free"],
    ["past_due", "pro", "Free"],
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

  it("does not ask the shell: it would read every plan and every figure of the workspace again", async () => {
    await page();

    expect(vi.mocked(getShell)).not.toHaveBeenCalled();
  });

  it("has no action in its header: the cards have their own buttons", async () => {
    expect(await page()).not.toContain('data-slot="page-header-actions"');
  });

  it("gives its cards a level-two title each, and no second h1: the old heading of the page is gone", async () => {
    const html = await page();

    expect(headings(html).h2).toEqual(["Current Plan", "Plan Limits", "Upgrade your plan"]);
    expect(startTags(html, "h1")).toHaveLength(1);
    expect(textOf(html)).not.toContain("Manage your subscription and billing details");
  });

  it("gives the cards the subscription of the workspace of the session", async () => {
    await seedPlan("pro");
    const end = new Date(Date.now() + 20 * DAY);
    await seedSubscription(ORG, { planId: "pro", status: "trialing", currentPeriodEnd: end });
    const [cards] = findAll(await BillingSettingsPage(params()), BillingSettings);

    expect(cards?.props).toEqual({ orgId: ORG, planId: "pro", status: "trialing", currentPeriodEnd: end, canManage: true });
  });

  it("gives a workspace that never subscribed the free plan, with no end of period", async () => {
    const [cards] = findAll(await BillingSettingsPage(params()), BillingSettings);

    expect(cards?.props).toEqual({ orgId: ORG, planId: "free", status: "active", currentPeriodEnd: undefined, canManage: true });
  });

  it("does not read the subscription of another workspace", async () => {
    await seedPlan("pro");
    await seedSubscription(OTHER_ORG, { planId: "pro" });
    const [cards] = findAll(await BillingSettingsPage(params()), BillingSettings);

    expect(cards?.props.planId).toBe("free");
  });

  // What a role may not do is not drawn: the billing actions ask an admin, and a
  // member who pressed their buttons would be sent home without a word.
  it("lets the owner and the admins manage the subscription, and shows a member the plan alone", async () => {
    const canManageOf = async (userId: string) => {
      signIn(userId);
      const [cards] = findAll(await BillingSettingsPage(params()), BillingSettings);
      return cards?.props.canManage;
    };

    expect(await canManageOf(OWNER)).toBe(true);
    expect(await canManageOf(ADMIN)).toBe(true);
    expect(await canManageOf(MEMBER)).toBe(false);

    signIn(MEMBER);
    const html = await page();
    expect(headings(html).h2).toEqual(["Current Plan", "Plan Limits"]);
    expect(elements(html, "button")).toEqual([]);
    expect(textOf(html)).toContain("Free");
  });

  it("titles the tab through the shell, in the language of the page", async () => {
    expect((await billingMetadata(params("en"))).title).toEqual({ absolute: "Billing · Acme — SaaS Boilerplate" });
    expect((await billingMetadata(params("fr"))).title).toEqual({ absolute: "Abonnement · Acme — SaaS Boilerplate" });
  });

  it("speaks French", async () => {
    intl.locale = "fr";
    const html = await page("fr");

    expect(headings(html)).toEqual({ h1: ["Abonnement"], h2: ["Plan actuel", "Limites du plan", "Passez à un plan supérieur"] });
    expect(contextOf(html)).toBe("Plan Free");
    expect(textOf(html)).toContain("Gratuit");
  });
});
