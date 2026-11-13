import type { Metadata } from "next";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import type { appPageMetadata as AppPageMetadata } from "@/features/app-shell";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { organization } from "@/models/organization";
import { user } from "@/models/user";
import { testDb } from "../setup";
import { elements, startTags, textOf } from "./html";
import { renderWithIntl } from "./intl";
import { localizedRedirect } from "./navigation";
import { fakeSession } from "./session";

/**
 * What the tests of the admin pages share. A page of the admin belongs to the
 * feature that gives it (the users, the audit log, the waiting list...), and a
 * feature can be removed: each page has its own test file under
 * tests/integration, which imports what its feature owns, and this file holds
 * only what none of them owns (the session, the translator, the people).
 *
 * Each test file gives the stand-ins to `vi.mock` itself, as the factories
 * below, because `vi.mock` is hoisted in the file that writes it: the pages
 * reach the guards, the shell, the translator of the server and the navigation
 * of next-intl, whose redirect and links a stand-in takes the place of (the redirect throws as the real one does).
 * Only the session lookup (Better Auth) is replaced among the guards: they are real,
 * and the pages read the in-memory database. This file imports none of the modules
 * the factories replace: a factory loads it, and a cycle would wait on itself.
 */

export type Locale = "en" | "fr";

/** What the session lookup answers, and the language the translator of the server speaks. */
export const session = { getSession: vi.fn() };
export const intl = { locale: "en" as Locale };

export async function authMock() {
  return { auth: { api: { getSession: session.getSession } } };
}

export async function appShellMock() {
  // The title the shell gives a tab, by its own rule: the page, then the context
  // (the one the page gives), then the product.
  const { APP_NAME } = await import("@/shared/config/app");
  const { formatPageTitle } = await import("@/shared/shell/resolve");

  return {
    appPageMetadata: vi.fn(async (page: string, options?: { context?: string }) => ({
      title: {
        absolute: formatPageTitle({ page, context: options?.context, product: APP_NAME }),
      },
    })),
  };
}

/** The translator of the server, built from the message files: the words are the real ones, and a message that is missing throws. */
export async function intlServerMock() {
  const { createFormatter, createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };
  // A namespace alone (`getTranslations("admin")`) or with the locale of the page (`getTranslations({ locale, namespace })`)
  interface Options { locale?: string; namespace?: string }
  const optionsOf = (options?: Options | string): Options | undefined =>
    typeof options === "string" ? { namespace: options } : options;
  const localeOf = (options?: Options | string): Locale => {
    const asked = optionsOf(options)?.locale;
    return asked === "fr" ? "fr" : asked === "en" ? "en" : intl.locale;
  };

  return {
    getTranslations: async (options?: Options | string) =>
      createTranslator({
        locale: localeOf(options),
        messages: messages[localeOf(options)],
        namespace: optionsOf(options)?.namespace as "admin",
        // A message that is missing, or that cannot be formatted, fails the test
        onError: (error) => {
          throw error;
        },
      }),
    getFormatter: async (options?: Options) => createFormatter({ locale: localeOf(options), timeZone: "UTC" }),
    // The language of the request, which a guard puts in front of the address it sends to
    getLocale: async () => intl.locale,
  };
}

export async function navigationMock() {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    redirect: localizedRedirect,
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    usePathname: () => "/admin/users",
  };
}

const ADMIN = "admin-1";

export function signInAs(person: "admin" | "member" | "nobody") {
  session.getSession.mockResolvedValue(
    person === "nobody" ? null : fakeSession(ADMIN, { isAdmin: person === "admin" }),
  );
}

/** The state every test starts from: English, and a platform admin signed in. */
export function resetAdminPage() {
  intl.locale = "en";
  signInAs("admin");
}

export const params = (locale: Locale = "en") => ({ params: Promise.resolve({ locale }) });

export async function draw(page: Promise<ReactNode>, locale: Locale = "en") {
  return renderWithIntl(await page, locale);
}

/** Where the guard sent the caller; fails if the page did not redirect. */
export async function redirectOf(call: Promise<unknown>): Promise<string> {
  const error = await call.then(() => undefined, (rejection: unknown) => rejection);
  if (!isRedirectError(error)) {
    throw new Error(`Expected the page to redirect, got: ${String(error)}`);
  }

  return getURLFromRedirectError(error);
}

/** The one h1 of a page, and the h2 of its sections. */
export function headings(html: string) {
  return { h1: elements(html, "h1").map(textOf), h2: elements(html, "h2").map(textOf) };
}

/** The line under the title of the page, or null when the header has none. */
export function contextOf(html: string): string | null {
  const [, context] = /<div data-slot="page-header-context"[^>]*>([\s\S]*?)<\/div>/.exec(html) ?? [];
  return context === undefined ? null : textOf(context);
}

/** The rows of the table of data: its header row is not one. */
export function rowsOf(html: string): string[] {
  return elements(html, "tr").slice(1);
}

/** The figure of the footer of a data table: "100 results". */
export function resultsOf(html: string): string | undefined {
  return /(\d+ results?)</.exec(html)?.[1];
}

/** The note a data table holds in its card, above the table: what its rows are not. */
export function noteOf(html: string): string | null {
  const [, note] = /<p[^>]*data-slot="data-table-note"[^>]*>([\s\S]*?)<\/p>/.exec(html) ?? [];
  return note === undefined ? null : textOf(note);
}

/** Every element of a type in a tree of React elements, as a Server Component returns it. */
export function findAll(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findAll(child, type));
  }
  if (!isValidElement<{ children?: ReactNode } & Record<string, unknown>>(node)) {
    return [];
  }

  return [
    ...(node.type === type ? [node] : []),
    ...Object.values(node.props).flatMap((value) =>
      isValidElement(value) || Array.isArray(value) ? findAll(value as ReactNode, type) : [],
    ),
  ];
}

export const MINUTE = 60 * 1000;

/** `count` rows, each made by `make(index)`, inserted in one go. */
export function rows<T>(count: number, make: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => make(index));
}

/**
 * `count` people, inserted in one go: person 0 is an admin, the even ones have a
 * verified address. They are all made at the same moment, or, with a `step` (in
 * milliseconds), one after the other, person 0 the oldest and the last the newest.
 */
export async function seedUsers(count: number, step = 0) {
  const start = Date.now() - count * step;
  await testDb.insert(user).values(
    rows(count, (index) => {
      const at = new Date(start + index * step);

      return {
        id: `person-${index}`,
        name: `Person ${index}`,
        email: `person-${index}@example.com`,
        emailVerified: index % 2 === 0,
        isAdmin: index === 0,
        createdAt: at,
        updatedAt: at,
      };
    }),
  );
}

/** `count` organizations, inserted in one go, all made at the same moment or, with a `step` (in milliseconds), one after the other, the first the oldest. */
export async function seedOrganizations(count: number, step = 0) {
  const start = Date.now() - count * step;
  await testDb.insert(organization).values(
    rows(count, (index) => {
      const at = new Date(start + index * step);

      return {
        id: `company-${index}`,
        name: `Company ${index}`,
        slug: `company-${index}`,
        createdAt: at,
        updatedAt: at,
      };
    }),
  );
}

/** The people and the organizations of the last test gone: what a feature's own tables hold is that feature's test to clear, before this. */
export async function clearPeople() {
  await testDb.delete(organization);
  await testDb.delete(user);
}

/** How to draw an admin page, how it titles its tab, and what its tab says. */
export interface AdminPage {
  name: string;
  draw: (locale: Locale) => Promise<ReactNode>;
  metadata: (locale: Locale) => Promise<Metadata>;
  title: Record<Locale, string>;
  /** The stand-in of the shell's `appPageMetadata`, to read what the page asked for. */
  appPageMetadata: typeof AppPageMetadata;
}

/**
 * What every admin page does the same way: the guard, the header, the language,
 * a failed query and the title of the tab. Each page's test file calls it once.
 */
export function describeAdminPage(page: AdminPage) {
  describe(`the ${page.name} admin page`, () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("sends someone who is not a platform admin to the home, before it reads anything", async () => {
      signInAs("member");
      const query = vi.spyOn(testDb.$client, "query");

      expect(await redirectOf(page.draw("en"))).toBe("/en/dashboard");
      expect(query).not.toHaveBeenCalled();
    });

    it("sends it in the language of the page: the address leaves complete, with no second hop through the proxy", async () => {
      signInAs("member");
      intl.locale = "fr";
      expect(await redirectOf(page.draw("fr"))).toBe("/fr/dashboard");

      signInAs("nobody");
      expect(await redirectOf(page.draw("fr"))).toBe("/fr/sign-in");
    });

    it("sends a visitor with no session to sign in", async () => {
      signInAs("nobody");

      expect(await redirectOf(page.draw("en"))).toBe("/en/sign-in");
    });

    it("is headed by one h1, with the tile of its icon before it", async () => {
      const html = await draw(page.draw("en"));

      expect(headings(html).h1).toEqual([page.title.en]);
      expect(startTags(html, "h1")).toHaveLength(1);
      // The first tile of the page is the header's: it comes before the title
      expect(html.indexOf('data-slot="icon-tile"')).toBeGreaterThan(-1);
      expect(html.indexOf('data-slot="icon-tile"')).toBeLessThan(html.indexOf("<h1"));
    });

    it("speaks French", async () => {
      intl.locale = "fr";
      const html = await draw(page.draw("fr"), "fr");

      expect(headings(html).h1).toEqual([page.title.fr]);
    });

    // Each page used to catch what its query threw, and draw an empty table that
    // said there was nothing: the failure now reaches the error boundary of the route.
    it("lets a failed query fail the page, rather than draw an empty table", async () => {
      // Every read of the database goes through the client: it is the database that fails.
      // The ORM wraps the error of the driver in its own, and keeps it as the cause.
      vi.spyOn(testDb.$client, "query").mockRejectedValue(new Error("the database is down"));

      await expect(page.draw("en")).rejects.toMatchObject({
        message: expect.stringContaining("Failed query"),
        cause: { message: "the database is down" },
      });
    });

    it("titles the tab \"<page> · Admin\" through the shell, in the language of the page", async () => {
      const english = await page.metadata("en");
      const french = await page.metadata("fr");

      expect(vi.mocked(page.appPageMetadata).mock.calls).toEqual([
        [page.title.en, { context: "Admin" }],
        [page.title.fr, { context: "Administration" }],
      ]);
      expect(english.title).toEqual({ absolute: `${page.title.en} · Admin — SaaS Boilerplate` });
      expect(french.title).toEqual({ absolute: `${page.title.fr} · Administration — SaaS Boilerplate` });
    });
  });
}
