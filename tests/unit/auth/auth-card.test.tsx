import type { ComponentProps, ReactNode } from "react";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import AcceptInvitationPage from "@/app/[locale]/(auth)/(center)/accept-invitation/[invitationId]/page";
import ForgotPasswordPage from "@/app/[locale]/(auth)/(center)/forgot-password/page";
import ResetPasswordPage from "@/app/[locale]/(auth)/(center)/reset-password/page";
import * as signInModule from "@/app/[locale]/(auth)/(center)/sign-in/page";
import * as signUpModule from "@/app/[locale]/(auth)/(center)/sign-up/page";
import VerifyEmailPage from "@/app/[locale]/(auth)/(center)/verify-email/page";
import AuthLayout from "@/app/[locale]/(auth)/layout";
import { AuthCard } from "@/features/auth/components/auth-card";
import { APP_NAME } from "@/shared/config/app";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

const SignInPage = signInModule.default;
const SignUpPage = signUpModule.default;

// The sign-in pages are a card on a sunken page, with the logo above it. What
// they reach for outside themselves is replaced: the auth client (nothing here
// reaches the network), the navigation of next-intl, which is replaced (no Next
// router runs in a test; its Link marks what it draws, so that a plain `<a>` is told from a
// link that keeps the locale), the providers the server says are on (the pages
// ask `auth.ts`, which reads the environment), and the translator of the server,
// built from the message files so that the words are the real ones.
const providers = vi.hoisted(() => ({ on: ["google", "github"] as ("google" | "github")[] }));

vi.mock("@/features/auth/social-providers", () => ({ enabledSocialProviders: () => providers.on }));
vi.mock("@/features/auth/auth-client", () => ({ authClient: {} }));
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, "data-locale-link": "", ...props }),
    getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
    usePathname: () => "/sign-in",
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    redirect: () => undefined,
  };
});
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");

  return {
    getTranslations: async ({ locale, namespace }: { locale: "en" | "fr"; namespace: "auth" }) =>
      createTranslator({
        locale,
        messages: locale === "fr" ? fr : en,
        namespace,
        // A message that is missing fails the test
        onError: (error) => {
          throw error;
        },
      }),
  };
});

afterEach(() => {
  providers.on = ["google", "github"];
});

type Locale = "en" | "fr";

const ROOT = resolve(import.meta.dirname, "../../..");
const CENTER = "src/app/[locale]/(auth)/(center)";

// Whether the proxy has kept a token in the cookie (the page learns that one is waiting, not what it is)
const jar = vi.hoisted(() => ({ waiting: false }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ has: (name: string) => name === "reset_token" && jar.waiting }),
  headers: async () => new Headers(),
}));

/** The page that takes the new password, as the reset link of the email lands on it: a token is waiting unless it says not. */
function resetPage(locale: Locale, query: Record<string, string | string[] | undefined>, waiting = true) {
  jar.waiting = waiting;

  return ResetPasswordPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(query),
  });
}

type Query = Record<string, string | string[] | undefined>;

/** The sign-in page, as the proxy (`callbackUrl`) or a provider that was cancelled (`error`) sends the person to it. */
function signInPage(locale: Locale, query: Query = {}) {
  return SignInPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
}

/** The sign-up page, as a page that needs an account (an invitation) sends the person to it (`callbackUrl`). */
function signUpPage(locale: Locale, query: Query = {}) {
  return SignUpPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
}

/** The page the link of the verification e-mail lands on: `verified=1` on a good link, `error=` on a dead one. */
function verifyPage(locale: Locale, query: Query = {}) {
  return VerifyEmailPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
}

/** The pages of the sign-in family, each as the markup of a whole page (the layout around it): by the name of the folder that holds it. */
const PAGES: Record<string, (locale: Locale) => Promise<ReactNode> | ReactNode> = {
  "sign-in": (locale) => signInPage(locale),
  "sign-up": (locale) => signUpPage(locale),
  "forgot-password": () => <ForgotPasswordPage />,
  "verify-email": (locale) => verifyPage(locale),
  "reset-password": (locale) => resetPage(locale, {}),
  // An id that leads to no invitation: the card that says the link no longer works
  "accept-invitation": (locale) =>
    AcceptInvitationPage({ params: Promise.resolve({ locale, invitationId: "no-such-invitation" }) }),
};

/** The same page when the link of the email is dead: no token, or the error Better Auth redirects with. */
const DEAD_LINKS: Record<string, (locale: Locale) => Promise<ReactNode>> = {
  "reset-password, no token": (locale) => resetPage(locale, {}, false),
  "reset-password, error": (locale) => resetPage(locale, { error: "INVALID_TOKEN" }, false),
};

async function pageHtml(page: (locale: Locale) => Promise<ReactNode> | ReactNode, locale: Locale) {
  return renderWithIntl(<AuthLayout>{await page(locale)}</AuthLayout>, locale);
}

/** The text of the description of the card: its muted line under the title. */
function descriptionOf(html: string): string {
  const description = /<div[^>]*data-slot="card-description"[^>]*>([\s\S]*?)<\/div>/.exec(html);

  return description ? textOf(description[1] ?? "") : "";
}

describe("the card of a sign-in page", () => {
  const render = (props: Partial<ComponentProps<typeof AuthCard>> = {}) =>
    renderWithIntl(
      <AuthCard
        title="Sign In"
        description="Welcome back."
        footer={
          <>
            No account?
            {" "}
            <a href="/sign-up">Sign up</a>
          </>
        }
        {...props}
      >
        <p>The form</p>
      </AuthCard>,
    );

  it("gives an auth page exactly one h1", () => {
    const html = render();

    expect(elements(html, "h1")).toHaveLength(1);
    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Sign In");
    // Nothing else of the card is a heading: the title is the one
    expect(startTags(html, "h2")).toEqual([]);
    expect(startTags(html, "h3")).toEqual([]);
  });

  it("sets the title in the panel size, semibold", () => {
    const [h1 = ""] = startTags(render(), "h1");

    expect(decodedClassesOf(h1)).toEqual(expect.arrayContaining(["text-panel", "font-semibold"]));
  });

  it("mutes the description, which sits under the title", () => {
    const html = render();

    expect(descriptionOf(html)).toBe("Welcome back.");
    expect(html.indexOf("Sign In")).toBeLessThan(html.indexOf("Welcome back."));
    // The classes of the muted line are the ones of the card's description, not of the title
    const [h1 = ""] = startTags(html, "h1");
    expect(decodedClassesOf(h1)).not.toContain("text-muted-foreground");
    expect(html).toMatch(/data-slot="card-description"[^>]*class="[^"]*text-muted-foreground/u);
  });

  it("puts the form under the description, and the footer under the form", () => {
    const html = render();

    expect(html.indexOf("Welcome back.")).toBeLessThan(html.indexOf("The form"));
    expect(html.indexOf("The form")).toBeLessThan(html.indexOf("No account?"));
  });

  it("says the footer as one line: a paragraph of text and links", () => {
    const html = render();
    const [line = ""] = elements(html, "p").filter((paragraph) => paragraph.includes("No account?"));

    expect(textOf(line)).toBe("No account? Sign up");
    expect(line).toContain('<a href="/sign-up">');
  });

  it("leaves out the description and the footer when it has none", () => {
    const html = render({ description: undefined, footer: undefined });

    expect(html).not.toContain('data-slot="card-description"');
    expect(html).not.toContain('data-slot="card-footer"');
    expect(elements(html, "h1")).toHaveLength(1);
  });

  it("holds whatever it is given in its body", () => {
    const html = render();

    expect(html).toContain("<p>The form</p>");
    expect(html).toContain('data-slot="card-content"');
  });

  it("draws no body when it has nothing to hold: a card of a title, a sentence and a footer", () => {
    const html = renderWithIntl(
      <AuthCard title="Verify Email" description="We sent you an email." footer={<a href="/sign-in">Back</a>} />,
    );

    expect(html).not.toContain('data-slot="card-content"');
    expect(html).toContain('data-slot="card-footer"');
    expect(elements(html, "h1")).toHaveLength(1);
  });

  describe("with an icon", () => {
    const withIcon = () => render({ icon: <span data-picture="">the picture</span> });

    it("draws it centered, inside the card, above the title", () => {
      const html = withIcon();
      const [wrapper = ""] = startTags(html, "div").filter((tag) => attribute(tag, "data-slot") === "auth-card-icon");

      expect(wrapper).not.toBe("");
      expect(decodedClassesOf(wrapper)).toEqual(expect.arrayContaining(["flex", "justify-center"]));
      // Inside the header of the card, before its title
      expect(html.indexOf('data-slot="card-header"')).toBeLessThan(html.indexOf('data-slot="auth-card-icon"'));
      expect(html.indexOf("the picture")).toBeLessThan(html.indexOf("<h1"));
      expect(html.indexOf("<h1")).toBeLessThan(html.indexOf('data-slot="card-content"'));
    });

    it("leaves the title the one heading of the card", () => {
      const html = withIcon();

      expect(elements(html, "h1")).toHaveLength(1);
      expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Sign In");
    });
  });

  it("draws nothing extra when it has no icon: the title opens the header", () => {
    const html = render();

    expect(html).not.toContain('data-slot="auth-card-icon"');
    expect(html).toMatch(/data-slot="card-header"[^>]*><h1/u);
  });
});

describe("the pages around the card", () => {
  it("has a page for every folder of the sign-in family, and no other", () => {
    const folders = readdirSync(resolve(ROOT, CENTER), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(folders).toEqual(Object.keys(PAGES).sort());
  });

  describe.each(["en", "fr"] as const)("in %s", (locale) => {
    it.each(Object.keys(PAGES))("gives the %s page exactly one h1", async (name) => {
      const html = await pageHtml(PAGES[name], locale);

      expect(elements(html, "h1")).toHaveLength(1);
      expect(textOf(elements(html, "h1")[0] ?? "").trim()).not.toBe("");
    });

    it.each(Object.keys(DEAD_LINKS))("gives the %s page exactly one h1", async (name) => {
      const html = await pageHtml(DEAD_LINKS[name], locale);

      expect(elements(html, "h1")).toHaveLength(1);
    });

    it.each(Object.keys(PAGES))("draws the logo of the product above the card on the %s page, as a link to the home", async (name) => {
      const html = await pageHtml(PAGES[name], locale);
      const home = startTags(html, "a").find((tag) => attribute(tag, "href") === "/") ?? "";

      expect(home).toContain("data-locale-link");
      expect(textOf(html)).toContain(APP_NAME);
      // The logo comes before the title
      expect(html.indexOf(home)).toBeLessThan(html.indexOf("<h1"));
    });

    it.each(Object.keys(PAGES))("keeps the locale in every link of the %s page", async (name) => {
      const html = await pageHtml(PAGES[name], locale);
      const anchors = startTags(html, "a");

      expect(anchors.length).toBeGreaterThan(1);
      for (const anchor of anchors) {
        expect(anchor, `a link that does not keep the locale: ${anchor}`).toContain("data-locale-link");
      }
    });
  });

  it("gives each card a description of its own, from the locales, and never the name of the product", async () => {
    const descriptions = new Map<string, string>();
    for (const locale of ["en", "fr"] as const) {
      for (const [name, page] of Object.entries(PAGES)) {
        const description = descriptionOf(await pageHtml(page, locale));

        expect(description, `${name} in ${locale}`).not.toBe("");
        expect(description, `${name} in ${locale}`).not.toBe(APP_NAME);
        descriptions.set(`${name} ${locale}`, description);
      }
    }

    // Five cards, five sentences, in each language
    for (const locale of ["en", "fr"]) {
      const ofLocale = [...descriptions].filter(([key]) => key.endsWith(` ${locale}`)).map(([, value]) => value);

      expect(new Set(ofLocale).size).toBe(Object.keys(PAGES).length);
    }
  });
});

describe("the layout of the sign-in pages", () => {
  const html = renderWithIntl(
    <AuthLayout>
      <p>A card</p>
    </AuthLayout>,
  );

  it("centers its column on a sunken page that is at least as high as the screen", () => {
    const [main = ""] = startTags(html, "main");

    expect(decodedClassesOf(main)).toEqual(
      expect.arrayContaining(["min-h-dvh", "grid", "place-items-center", "bg-surface-sunken", "px-4", "py-10"]),
    );
  });

  it("holds one column of at most 448 px, with the logo centered above what the page draws", () => {
    const [column = ""] = startTags(html, "div");

    expect(decodedClassesOf(column)).toEqual(expect.arrayContaining(["w-full", "max-w-md", "space-y-6"]));
    expect(html.indexOf(APP_NAME)).toBeLessThan(html.indexOf("A card"));
  });

  it("is the one main landmark of the page", () => {
    expect(startTags(html, "main")).toHaveLength(1);
  });

  it("takes no color from the palette of the framework", () => {
    expect(html).not.toMatch(/\b(?:bg|text|border)-(?:white|black|gray|slate|zinc)\b/);
  });
});

describe("the verify-email page", () => {
  it("shows a mail icon in a tile of the brand tone, then the card and a way back to the sign-in page", async () => {
    const html = await pageHtml(PAGES["verify-email"], "en");
    const [tile = ""] = startTags(html, "span").filter((tag) => attribute(tag, "data-slot") === "icon-tile");

    expect(tile).not.toBe("");
    expect(decodedClassesOf(tile)).toEqual(expect.arrayContaining(["bg-brand-tint", "size-14"]));
    expect(html).toContain("lucide-mail");

    const back = startTags(html, "a").find((tag) => attribute(tag, "href") === "/sign-in") ?? "";
    expect(back).toContain("data-locale-link");
    expect(textOf(html)).toContain("Back to sign in");
  });

  it("puts the tile above the title, in the card, and nothing between the sentence and the footer link", async () => {
    const html = await pageHtml(PAGES["verify-email"], "en");

    expect(html.indexOf('data-slot="icon-tile"')).toBeGreaterThan(html.indexOf('data-slot="card-header"'));
    expect(html.indexOf('data-slot="icon-tile"')).toBeLessThan(html.indexOf("<h1"));
    // The sentence is followed by the footer: there is no body left between them
    expect(html).not.toContain('data-slot="card-content"');
    expect(html.indexOf('data-slot="card-description"')).toBeLessThan(html.indexOf('data-slot="card-footer"'));
  });

  it("says the way back in French", async () => {
    const html = await pageHtml(PAGES["verify-email"], "fr");

    expect(textOf(html)).toContain("Retour à la connexion");
  });
});

describe("the verify-email page, once the link of the e-mail has been followed", () => {
  const drawn = async (query: Query, locale: Locale = "en") =>
    renderWithIntl(<AuthLayout>{await verifyPage(locale, query)}</AuthLayout>, locale);

  it("tells a good link that the address is verified, with a green tile and the way to sign in", async () => {
    const html = await drawn({ verified: "1" });

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Email verified");
    expect(descriptionOf(html)).toBe("Your email address is confirmed. You can now sign in.");
    expect(html).toContain("lucide-circle-check");
    expect(decodedClassesOf(startTags(html, "span").find((tag) => attribute(tag, "data-slot") === "icon-tile") ?? "")).toContain("bg-success-bg");

    const signIn = startTags(html, "a").find((tag) => attribute(tag, "href") === "/sign-in") ?? "";
    expect(signIn).toContain("data-locale-link");
    expect(textOf(elements(html, "a").find((anchor) => anchor.includes('href="/sign-in"')) ?? "")).toBe("Sign In");
  });

  it.each([
    ["an expired link", { error: "TOKEN_EXPIRED" }],
    ["a link already used", { error: "INVALID_TOKEN" }],
    ["a dead link that still carries the mark of a good one", { verified: "1", error: "INVALID_TOKEN" }],
    ["an error the address repeats", { error: ["TOKEN_EXPIRED", "other"] }],
  ] as [string, Query][])("tells %s, and that signing in sends a new link", async (_, query) => {
    const html = await drawn(query);

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("This link no longer works");
    expect(descriptionOf(html)).toContain("Sign in and we'll send you a new one.");
    expect(textOf(html)).not.toContain("Email verified");
    expect(startTags(html, "a").some((tag) => attribute(tag, "href") === "/sign-in")).toBe(true);
  });

  it("says both in French", async () => {
    expect(textOf(elements(await drawn({ verified: "1" }, "fr"), "h1")[0] ?? "")).toBe("Email vérifié");
    expect(textOf(elements(await drawn({ error: "INVALID_TOKEN" }, "fr"), "h1")[0] ?? "")).toBe("Ce lien ne fonctionne plus");
    expect(descriptionOf(await drawn({ error: "INVALID_TOKEN" }, "fr"))).toContain("Connectez-vous et nous vous en enverrons un nouveau");
  });

  it("gives each card exactly one h1", async () => {
    for (const query of [{}, { verified: "1" }, { error: "INVALID_TOKEN" }]) {
      expect(elements(await drawn(query), "h1")).toHaveLength(1);
    }
  });

  // Someone who signed up from a page that asked for it (an invitation) goes back to it once signed in
  it("passes the page to come back to on to the sign-in page, when it is a page of the app", async () => {
    const back = "/fr/accept-invitation/inv_1";
    const linksOf = (html: string) => startTags(html, "a").map((tag) => attribute(tag, "href"));

    expect(linksOf(await drawn({ verified: "1", callbackUrl: back }))).toContain(`/sign-in?callbackUrl=${encodeURIComponent(back)}`);
    expect(linksOf(await drawn({ error: "TOKEN_EXPIRED", callbackUrl: back }))).toContain(`/sign-in?callbackUrl=${encodeURIComponent(back)}`);
    const elsewhere = linksOf(await drawn({ verified: "1", callbackUrl: "https://evil.example/phish" }));
    expect(elsewhere).toContain("/sign-in");
    expect(elsewhere.join(" ")).not.toContain("evil");
  });

  it("leaves an address that was typed by hand with the card that says an e-mail is on its way", async () => {
    const html = await drawn({});

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Verify Email");
    expect(textOf(html)).not.toContain("Email verified");
  });
});

describe("what the sign-in page does with its address", () => {
  const drawn = async (query: Query, locale: Locale = "en") =>
    renderWithIntl(<AuthLayout>{await signInPage(locale, query)}</AuthLayout>, locale);

  it("tells a provider that was cancelled, in the words of the language of the page, never the code", async () => {
    const html = await drawn({ error: "access_denied" });

    expect(html).toContain('role="alert"');
    expect(textOf(html)).toContain("Sign-in was cancelled. You can try again.");
    expect(textOf(html)).not.toContain("access_denied");
    expect(textOf(await drawn({ error: "access_denied" }, "fr"))).toContain("La connexion a été annulée.");
  });

  it("tells any other error with the generic message, and never shows what the address says", async () => {
    const html = await drawn({ error: "<b>boom</b>" });

    expect(textOf(html)).toContain("An error occurred");
    expect(html).not.toContain("boom");
  });

  it("is quiet when the address says nothing, or says only the page that was asked for", async () => {
    expect(await drawn({})).not.toContain('role="alert"');
    expect(await drawn({ callbackUrl: "/en/projects/abc" })).not.toContain('role="alert"');
  });
});

// The providers that are on are asked of `auth.ts` when the page is drawn, from the
// environment: a page that is built once would keep the list of the day of the build.
describe("the pages that ask which providers are on", () => {
  it.each([
    ["sign-in", signInModule],
    ["sign-up", signUpModule],
  ])("are drawn for each request, on the %s page", (_, page) => {
    expect(page.dynamic).toBe("force-dynamic");
  });
});

describe("the other ways in, on the sign-in and sign-up pages", () => {
  const PAGES_WITH_BUTTONS = ["sign-in", "sign-up"];

  it.each(PAGES_WITH_BUTTONS)("draw a button for each provider the server says is on, on the %s page", async (name) => {
    providers.on = ["google", "github"];
    const html = await pageHtml(PAGES[name], "en");

    expect(textOf(html)).toContain("Or continue with");
    expect(textOf(html)).toContain("Google");
    expect(textOf(html)).toContain("GitHub");
  });

  it.each(PAGES_WITH_BUTTONS)("draw only the button of the one that is on, on the %s page", async (name) => {
    providers.on = ["github"];
    const html = await pageHtml(PAGES[name], "en");

    expect(elements(html, "button").map(textOf)).toContain("GitHub");
    expect(elements(html, "button").map(textOf)).not.toContain("Google");
    expect(textOf(html)).toContain("Or continue with");
  });

  it.each(PAGES_WITH_BUTTONS)("draw neither the buttons nor their separator when no provider is on, on the %s page", async (name) => {
    providers.on = [];
    const html = await pageHtml(PAGES[name], "en");

    expect(textOf(html)).not.toContain("Or continue with");
    expect(elements(html, "button").map(textOf)).not.toContain("Google");
    expect(elements(html, "button").map(textOf)).not.toContain("GitHub");
  });
});

describe("the forgot-password page", () => {
  it.each(["en", "fr"] as const)("offers the way back to the sign-in page once, in the footer of its card, in %s", async (locale) => {
    const html = await pageHtml(PAGES["forgot-password"], locale);
    const back = startTags(html, "a").filter((tag) => attribute(tag, "href") === "/sign-in");

    expect(back).toHaveLength(1);
    expect(back[0]).toContain("data-locale-link");
    // In the footer: the card has one, and the link comes after it opens
    expect(html).toContain('data-slot="card-footer"');
    expect(html.indexOf('data-slot="card-footer"')).toBeLessThan(html.indexOf(back[0] ?? "-"));
    expect(textOf(html)).toContain(locale === "en" ? "Back to sign in" : "Retour à la connexion");
  });
});

describe("the sign-in and sign-up pages", () => {
  it("offer each other in the footer of the card, on a link that keeps the locale", async () => {
    const signIn = await pageHtml(PAGES["sign-in"], "en");
    const signUp = await pageHtml(PAGES["sign-up"], "en");

    const toSignUp = startTags(signIn, "a").find((tag) => attribute(tag, "href") === "/sign-up") ?? "";
    expect(toSignUp).toContain("data-locale-link");
    expect(textOf(signIn)).toContain("Don't have an account? Sign Up");

    const toSignIn = startTags(signUp, "a").find((tag) => attribute(tag, "href") === "/sign-in") ?? "";
    expect(toSignIn).toContain("data-locale-link");
    expect(textOf(signUp)).toContain("Already have an account? Sign In");
  });

  // A page that needs an account (an invitation) sends the person to either: the other one keeps where they come back to
  it("keep the page to come back to when they offer each other, and only a page of the app", async () => {
    const back = encodeURIComponent("/en/accept-invitation/inv_1");
    const linksOf = (html: string) => startTags(html, "a").map((tag) => attribute(tag, "href"));
    const draw = async (page: Promise<ReactNode>) => renderWithIntl(<AuthLayout>{await page}</AuthLayout>, "en");

    expect(linksOf(await draw(signInPage("en", { callbackUrl: "/en/accept-invitation/inv_1" })))).toContain(`/sign-up?callbackUrl=${back}`);
    expect(linksOf(await draw(signUpPage("en", { callbackUrl: "/en/accept-invitation/inv_1" })))).toContain(`/sign-in?callbackUrl=${back}`);
    expect(linksOf(await draw(signUpPage("en", { callbackUrl: "//evil.example" })))).toContain("/sign-in");
  });
});
