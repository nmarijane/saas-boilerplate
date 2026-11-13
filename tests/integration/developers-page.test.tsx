import type { ComponentProps, ReactElement, ReactNode } from "react";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DevelopersSettingsPage, {
  generateMetadata as developersMetadata,
} from "@/app/[locale]/(app)/(shell)/settings/developers/page";
import { ApiKeyList } from "@/features/api-keys/components/api-key-list";
import { WebhookList } from "@/features/webhooks/components/webhook-list";
import {
  apiKey,
  organization,
  organizationMember,
  user,
  webhookEndpoint,
} from "@/models";
import { ShellProvider } from "@/shared/components/shell/shell-context";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../helpers/html";
import { renderWithIntl } from "../helpers/intl";
import {
  seedApiKey,
  seedOrg,
  seedOrgMember,
  seedUser,
  seedWebhookEndpoint,
} from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { shellLink, shellView } from "../helpers/shell";
import { testDb } from "../setup";

// The page with the real guards: only the session lookup (Better Auth) is
// replaced, so that a person is signed in as a role of a seeded workspace, and
// the page reads the in-memory database. The titles the shell gives a tab, the
// translator of the server (built from the message files, so the words are the
// real ones, and a message that is missing throws) and the links and the router
// of next-intl are stand-ins; its redirect is one that throws as the real one does.

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
  };
});

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };
  interface Options { locale?: string; namespace?: string }

  return {
    getLocale: async () => intl.locale,
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
  const { localizedRedirect } = await import("../helpers/navigation");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    redirect: localizedRedirect,
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

/** Where the guard sent the caller; fails if the page did not redirect. */
async function redirectOf(call: Promise<unknown>): Promise<string> {
  const error = await call.then(() => undefined, (rejection: unknown) => rejection);
  if (!isRedirectError(error)) {
    throw new Error(`Expected the page to redirect, got: ${String(error)}`);
  }

  return getURLFromRedirectError(error);
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

/** The header of the page: from its start to the tabs that close it. */
function headerOf(html: string): string {
  return html.slice(html.indexOf('data-slot="page-header"'), html.indexOf('data-slot="tab-links"'));
}

/** The rows of the page, in its sections: the tabs of the settings are a list of links too, and are not rows. */
function rowsOf(html: string): string[] {
  return elements(html.replace(/<nav [^>]*data-slot="tab-links"[\s\S]*?<\/nav>/, ""), "li");
}

/** The words of the badges of a page, in order. */
function badgesOf(html: string): string[] {
  return elements(html, "span")
    .filter((span) => span.includes('data-slot="badge"'))
    .map(textOf);
}

const DAY = 24 * 60 * 60 * 1000;

/** A key of a workspace, made by one of its people (a key belongs to the person who made it). */
const seedKey = (orgId: string, overrides: Record<string, unknown> = {}) =>
  seedApiKey(orgId, { createdBy: orgId === OTHER_ORG ? STRANGER : OWNER, ...overrides });

beforeEach(async () => {
  vi.clearAllMocks();
  intl.locale = "en";
  await testDb.delete(apiKey);
  await testDb.delete(webhookEndpoint);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
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

describe("the developers page", () => {
  const page = (locale: "en" | "fr" = "en") => draw(DevelopersSettingsPage(params(locale)), locale);

  /** A workspace with a key of each kind and two endpoints, one of them turned off. */
  async function seedDeveloperData() {
    const now = Date.now();
    await seedKey(ORG, { id: "k-live", name: "Production server", prefix: "sk_live_AbCd", createdAt: new Date(now - 4 * DAY), lastUsed: new Date(now - DAY) });
    await seedKey(ORG, { id: "k-ended", name: "Staging", prefix: "sk_live_Qw3e", createdAt: new Date(now - 3 * DAY), expiresAt: new Date(now - DAY) });
    await seedKey(ORG, { id: "k-revoked", name: "Laptop", prefix: "sk_live_Zz9y", createdAt: new Date(now - 2 * DAY), revokedAt: new Date(now - DAY) });
    await seedKey(ORG, { id: "k-later", name: "Next quarter", prefix: "sk_live_Mm1n", createdAt: new Date(now - DAY), expiresAt: new Date(now + 30 * DAY) });
    await seedWebhookEndpoint(ORG, { id: "e-live", url: "https://example.com/hooks/billing", events: ["payment.failed", "payment.succeeded", "project.created"], createdAt: new Date(now - 2 * DAY) });
    await seedWebhookEndpoint(ORG, { id: "e-off", url: "https://example.org/events", events: ["member.invited"], active: false, createdAt: new Date(now - DAY) });
  }

  it("sends a plain member to the home, as the tab is not drawn for them either", async () => {
    signIn(MEMBER);

    expect(await redirectOf(DevelopersSettingsPage(params()))).toBe("/en/dashboard");
  });

  it("sends in the language of the request", async () => {
    intl.locale = "fr";
    signIn(MEMBER);

    expect(await redirectOf(DevelopersSettingsPage(params("fr")))).toBe("/fr/dashboard");
  });

  it("sends someone who belongs to no workspace to onboarding, before it asks for any role", async () => {
    await seedUser("pages-nobody");
    signIn("pages-nobody");

    expect(await redirectOf(DevelopersSettingsPage(params()))).toBe("/en/onboarding");

    intl.locale = "fr";
    expect(await redirectOf(DevelopersSettingsPage(params("fr")))).toBe("/fr/onboarding");
  });

  it("serves an admin, and the owner", async () => {
    for (const person of [ADMIN, OWNER]) {
      signIn(person);

      expect(headings(await page()).h1, person).toEqual(["Developers"]);
    }
  });

  it("heads the page with a code icon, the title and the counts, and puts the tabs of the settings under it", async () => {
    await seedDeveloperData();
    const html = await page();

    expect(headings(html).h1).toEqual(["Developers"]);
    expect(startTags(html, "h1")).toHaveLength(1);
    expect(html).toContain('data-slot="icon-tile"');
    expect(html).toContain('data-slot="tab-links"');
    expect(attribute(startTags(html, "nav")[0] ?? "", "aria-label")).toBe("Settings");
    expect(contextOf(html)).toBe("2 API keys · 2 webhooks");
  });

  it("counts the keys that can still be used, and every endpoint: a key that ran out or was revoked is a record, a disabled endpoint still exists", async () => {
    await seedDeveloperData();

    // Two live keys of four, and two endpoints of two, the disabled one included
    expect(contextOf(await page())).toBe("2 API keys · 2 webhooks");

    await testDb.delete(webhookEndpoint);
    await seedWebhookEndpoint(ORG, { id: "e-only", active: false });
    expect(contextOf(await page())).toBe("2 API keys · 1 webhook");
  });

  it("counts the keys it calls active as the rows say it: as many as there are Active badges", async () => {
    await seedDeveloperData();
    const html = await page();
    const header = Number(/^(\d+)/.exec(contextOf(html))?.[1]);

    expect(header).toBe(2);
    expect(badgesOf(html).filter((word) => word === "Active")).toHaveLength(header);
    expect(badgesOf(html)).toEqual(["Active", "Expired", "Revoked", "Active"]);
  });

  it("says one in the singular, none in the plural, in English and in French", async () => {
    await seedKey(ORG, { id: "k-one", name: "Only" });
    expect(contextOf(await page())).toBe("1 API key · 0 webhooks");

    await testDb.delete(apiKey);
    await seedWebhookEndpoint(ORG, { id: "e-one" });
    expect(contextOf(await page())).toBe("0 API keys · 1 webhook");

    intl.locale = "fr";
    await seedKey(ORG, { id: "k-two", name: "Second" });
    await seedKey(ORG, { id: "k-three", name: "Third", createdAt: new Date(Date.now() + 1000) });
    expect(contextOf(await page("fr"))).toBe("2 clés d'API · 1 webhook");
  });

  it("offers one main action in the header, Create API key, and no second one on the page", async () => {
    await seedDeveloperData();
    const html = await page();

    expect(textOf(headerOf(html))).toContain("Create API key");
    expect(elements(html, "button").filter((button) => textOf(button) === "Create API key")).toHaveLength(1);
    // The one filled button of the page: the endpoints' button is a secondary one
    const filled = startTags(html, "button").filter((tag) => decodedClassesOf(tag).includes("bg-primary"));
    expect(filled).toHaveLength(1);
    expect(elements(html, "button").filter((button) => textOf(button) === "Add endpoint")).toHaveLength(1);
  });

  it("is two sections with a level-two title each, API keys and Webhooks, and no count of their own", async () => {
    await seedDeveloperData();
    const html = await page();

    expect(headings(html).h2).toEqual(["API keys", "Webhooks"]);
    expect(textOf(html)).not.toMatch(/\bAPI keys\s*\(|\bWebhooks\s*\(/);
  });

  it("lists the keys and the endpoints of the workspace of the session, in the order they were made, and none of another", async () => {
    await seedDeveloperData();
    await seedKey(OTHER_ORG, { id: "k-foreign", name: "Foreign key" });
    await seedWebhookEndpoint(OTHER_ORG, { id: "e-foreign", url: "https://elsewhere.test/hook" });
    const html = await page();

    expect(rowsOf(html).map((row) => textOf(row))).toEqual([
      expect.stringContaining("Production server"),
      expect.stringContaining("Staging"),
      expect.stringContaining("Laptop"),
      expect.stringContaining("Next quarter"),
      expect.stringContaining("https://example.com/hooks/billing"),
      expect.stringContaining("https://example.org/events"),
    ]);
    expect(textOf(html)).not.toContain("Foreign key");
    expect(textOf(html)).not.toContain("elsewhere.test");
  });

  it("tells each key by the start of it, in mono, and by when it was last used, or that it never was", async () => {
    await seedDeveloperData();
    const html = await page();
    const [first = "", second = ""] = rowsOf(html);

    expect(textOf(elements(first, "code")[0] ?? "")).toBe("sk_live_AbCd…");
    expect(textOf(first)).toContain("Last used");
    expect(textOf(second)).toContain("Never used");
  });

  it("names each list by the title of its card", async () => {
    await seedDeveloperData();
    const html = await page();
    const titles = startTags(html, "h2");
    const lists = startTags(html, "ul").filter((tag) => attribute(tag, "data-slot") === "list");

    expect(lists.map((list) => attribute(list, "aria-labelledby"))).toEqual(titles.map((title) => attribute(title, "id")));
    expect(new Set(titles.map((title) => attribute(title, "id"))).size).toBe(2);
  });

  it("gives the key list what it shows and nothing else: no hash, no scopes, no workspace, no author", async () => {
    await seedDeveloperData();
    const tree = await DevelopersSettingsPage(params());
    const [list] = findAll(tree, ApiKeyList);
    const keys = list?.props.keys as Record<string, unknown>[];

    expect(list?.props.orgId).toBe(ORG);
    expect(keys.map((key) => Object.keys(key).sort())).toEqual(
      Array.from({ length: 4 }, () => ["createdAt", "id", "lastUsed", "name", "prefix", "status"]),
    );
    expect(keys.map((key) => key.status)).toEqual(["active", "expired", "revoked", "active"]);
    expect(typeof keys[0]?.createdAt).toBe("string");
    expect(keys[1]?.lastUsed).toBeNull();
    expect(JSON.stringify(keys)).not.toMatch(/hash-|k-live.*hash/);
  });

  it("gives the endpoint list what it shows and nothing else: never the signing secret", async () => {
    await seedDeveloperData();
    const tree = await DevelopersSettingsPage(params());
    const [list] = findAll(tree, WebhookList);
    const endpoints = list?.props.endpoints as Record<string, unknown>[];

    expect(list?.props.orgId).toBe(ORG);
    expect(endpoints.map((endpoint) => Object.keys(endpoint).sort())).toEqual(
      Array.from({ length: 2 }, () => ["active", "createdAt", "eventCount", "id", "url"]),
    );
    expect(endpoints.map((endpoint) => endpoint.eventCount)).toEqual([3, 1]);
    expect(endpoints.map((endpoint) => endpoint.active)).toEqual([true, false]);
    expect(JSON.stringify(endpoints)).not.toContain("whsec_");
  });

  it("says that there is nothing, in each section, with an empty state and no button of its own", async () => {
    const html = await page();

    expect(contextOf(html)).toBe("0 API keys · 0 webhooks");
    expect(headings(html).h2).toEqual(["API keys", "Webhooks"]);
    expect(html.match(/data-slot="empty-state"/g)).toHaveLength(2);
    expect(elements(html, "h3").map(textOf)).toEqual(["No API keys yet", "No webhooks yet"]);
    // The header's button, and the section's: an empty state repeats neither
    expect(elements(html, "button").map(textOf)).toEqual(["Create API key", "Add endpoint"]);
  });

  it("shows the empty state of the section that is empty, and the rows of the other", async () => {
    await seedKey(ORG, { id: "k-alone", name: "Only key" });
    const html = await page();

    expect(rowsOf(html)).toHaveLength(1);
    expect(html.match(/data-slot="empty-state"/g)).toHaveLength(1);
    expect(elements(html, "h3").map(textOf)).toEqual(["No webhooks yet"]);
  });

  it("titles the tab through the shell, in the language of the page", async () => {
    expect((await developersMetadata(params("en"))).title).toEqual({ absolute: "Developers · Acme — SaaS Boilerplate" });
    expect((await developersMetadata(params("fr"))).title).toEqual({ absolute: "Développeurs · Acme — SaaS Boilerplate" });
  });

  it("speaks French, with the plural of French", async () => {
    await seedDeveloperData();
    intl.locale = "fr";
    const html = await page("fr");

    expect(headings(html)).toEqual({ h1: ["Développeurs"], h2: ["Clés d'API", "Webhooks"] });
    expect(contextOf(html)).toBe("2 clés d'API · 2 webhooks");
    expect(textOf(html)).toContain("Créer une clé d'API");
    expect(textOf(html)).toContain("Ajouter un endpoint");
    expect(badgesOf(html)).toEqual(["Active", "Expirée", "Révoquée", "Active"]);
  });
});
