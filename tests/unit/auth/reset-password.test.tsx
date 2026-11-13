import type { ComponentProps, ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "@/app/[locale]/(auth)/(center)/reset-password/page";
import { resetPasswordFlow } from "@/features/auth/auth-flows";
import {
  ResetPasswordForm,
  ResetPasswordFormView,
} from "@/features/auth/components/reset-password-form";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The page the link of the reset email lands on. Better Auth checks the token
// of the link and redirects here with `?token=` when it holds, and with
// `?error=INVALID_TOKEN` when it does not (missing, unknown, expired). The proxy
// keeps a token in an HttpOnly cookie and redirects to the page without it: the page
// only learns that one is waiting. It takes the new password on a good link, and tells
// a dead one in a card that leads to a new request. What it reaches for outside itself is replaced, as in
// auth-card.test.tsx.
vi.mock("@/features/auth/auth-client", () => ({ authClient: {} }));
// The cookie of the token: the page asks whether it is there, and is never told what it holds
const jar = vi.hoisted(() => ({ waiting: false, asked: [] as string[] }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    has: (name: string) => {
      jar.asked.push(name);
      return name === "reset_token" && jar.waiting;
    },
    get: () => {
      throw new Error("The page must not read the token itself");
    },
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, "data-locale-link": "", ...props }),
    getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
    usePathname: () => "/reset-password",
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
        onError: (error) => {
          throw error;
        },
      }),
  };
});

type Locale = "en" | "fr";
type Query = Record<string, string | string[] | undefined>;

const STRONG = "Secret-123!";

function page(query: Query, locale: Locale = "en", waiting = true) {
  jar.waiting = waiting;
  jar.asked = [];

  return ResetPasswordPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(query),
  });
}

async function drawPage(query: Query, locale: Locale = "en", waiting = true) {
  return renderWithIntl(await page(query, locale, waiting), locale);
}

/** The first element of a type in a tree of elements that is not drawn yet, or undefined. */
function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | undefined {
  if (!isValidElement<Record<string, unknown>>(node)) {
    return undefined;
  }
  if (node.type === type) {
    return node;
  }

  const { children } = node.props as { children?: ReactNode };
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child, type);
    if (found) {
      return found;
    }
  }

  return undefined;
}

// [what it is, the address, whether a token is waiting in the cookie]
const DEAD_LINKS: [string, Query, boolean][] = [
  ["no token waiting: an address typed by hand, or a token that was used or expired", {}, false],
  ["the error Better Auth redirects with when the token is unknown or expired", { error: "INVALID_TOKEN" }, false],
  ["an error, whatever is waiting", { error: "INVALID_TOKEN" }, true],
  ["any error", { error: "SOMETHING_ELSE" }, true],
  ["a list of errors", { error: ["INVALID_TOKEN"] }, true],
];

describe("the reset page, on a link that does not work", () => {
  it.each(DEAD_LINKS)("tells a dead link, with no form, for %s", async (_, query, waiting) => {
    const html = await drawPage(query, "en", waiting);

    expect(startTags(html, "form")).toEqual([]);
    expect(startTags(html, "input")).toEqual([]);
    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("This link no longer works");
    expect(textOf(html)).toContain("The link to reset your password has expired or was already used.");
  });

  it.each(DEAD_LINKS)("leads to a new request, on a link that keeps the locale, for %s", async (_, query, waiting) => {
    const html = await drawPage(query, "en", waiting);
    const ask = startTags(html, "a").find((tag) => attribute(tag, "href") === "/forgot-password") ?? "";

    expect(ask).toContain("data-locale-link");
    expect(textOf(html)).toContain("Ask for a new link");
    // A link on a line of its own is a 44 px target
    expect(decodedClassesOf(ask)).toContain("tap-target");
  });

  it("says so in French", async () => {
    const html = await drawPage({ error: "INVALID_TOKEN" }, "fr", false);

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Ce lien ne fonctionne plus");
    expect(textOf(html)).toContain("Demander un nouveau lien");
  });

  it("gives the card exactly one h1", async () => {
    for (const [, query, waiting] of DEAD_LINKS) {
      expect(elements(await drawPage(query, "en", waiting), "h1")).toHaveLength(1);
    }
  });
});

describe("the reset page, on a good link", () => {
  // The token is not in what the server sends the browser: not as a prop of the form, which the payload of the page would carry
  it("shows the form, and hands it no token: the page only knows that one is waiting", async () => {
    const element = await page({});
    const form = find(element, ResetPasswordForm);

    expect(form?.props).toEqual({});
    expect(JSON.stringify(element)).not.toContain("tok_");
    expect(jar.asked).toEqual(["reset_token"]);

    const html = renderWithIntl(element);
    expect(startTags(html, "form")).toHaveLength(1);
    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Reset Password");
  });

  it("leaves the card to the form, which is what follows its state: the page draws no card round it", async () => {
    const element = await page({});

    // The page hands over the form itself, not a card that holds it
    expect(isValidElement(element) && element.type).toBe(ResetPasswordForm);
  });

  it("keeps the form of a good link away from the card of a dead one", async () => {
    const html = await drawPage({});

    expect(textOf(html)).not.toContain("This link no longer works");
  });
});

// What the form asks of the server when the button is pressed: the flow it is
// given the auth client for (auth-flows.test.ts holds the rest of its cases).
describe("the call the reset makes", () => {
  const fakeClient = () => ({ resetPassword: vi.fn().mockResolvedValue({ data: { status: true }, error: null }) });

  it("asks for the new password, and for nothing else (the server holds the token): the person is not signed in", async () => {
    const client = fakeClient();

    await expect(resetPasswordFlow(client, { newPassword: STRONG })).resolves.toEqual({ ok: true });

    expect(client.resetPassword).toHaveBeenCalledExactlyOnceWith({ newPassword: STRONG });
  });

  it("does not ask while a rule of the strength meter fails", async () => {
    const client = fakeClient();

    for (const newPassword of ["", "abc", "Abcdefg1"]) {
      await expect(resetPasswordFlow(client, { newPassword })).resolves.toEqual({
        ok: false,
        messageKey: "auth.passwordTooWeak",
      });
    }

    expect(client.resetPassword).not.toHaveBeenCalled();
  });
});

describe("the card of the reset, which follows its state", () => {
  const view = (props: Partial<ComponentProps<typeof ResetPasswordFormView>> = {}, locale: Locale = "en") =>
    renderWithIntl(
      <ResetPasswordFormView
        password=""
        pending={false}
        failure={null}
        done={false}
        onPasswordChange={() => {}}
        onSubmit={() => {}}
        {...props}
      />,
      locale,
    );

  const STATES: [string, Partial<ComponentProps<typeof ResetPasswordFormView>>][] = [
    ["at rest", {}],
    ["with a password typed", { password: "abc" }],
    ["while it works", { password: STRONG, pending: true }],
    ["when the password was refused before it was sent", { password: "abc", failure: "auth.passwordTooWeak" }],
    ["when the server refused", { password: STRONG, failure: "auth.errors.invalidToken" }],
    ["when it failed outright", { password: STRONG, failure: "common.error" }],
    ["once the password has changed", { done: true }],
  ];

  it.each(STATES)("has exactly one h1, %s", (_, props) => {
    expect(elements(view(props), "h1")).toHaveLength(1);
    expect(elements(view(props, "fr"), "h1")).toHaveLength(1);
  });

  it("is titled Reset Password while the password is being chosen, with its sentence and a way back in its footer", () => {
    const html = view();
    const footer = /<div[^>]*data-slot="card-footer"[\s\S]*$/.exec(html)?.[0] ?? "";
    const back = startTags(footer, "a").filter((tag) => attribute(tag, "href") === "/sign-in");

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Reset Password");
    expect(textOf(/<div[^>]*data-slot="card-description"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "")).toBe(
      "Choose a new password for your account.",
    );
    // One link to sign in, on the locale-aware Link, in the footer: the form has none of its own
    expect(startTags(html, "a").filter((tag) => attribute(tag, "href") === "/sign-in")).toHaveLength(1);
    expect(back).toHaveLength(1);
    expect(back[0]).toContain("data-locale-link");
    expect(decodedClassesOf(back[0] ?? "")).toContain("tap-target");
    expect(textOf(footer)).toContain("Back to sign in");
  });

  it("is titled Password updated once the password has changed, with no sentence and no footer", () => {
    const html = view({ done: true });

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Password updated");
    expect(html).not.toContain('data-slot="card-description"');
    expect(html).not.toContain('data-slot="card-footer"');
    // What the card says is the confirmation, and the way on
    expect(html).toContain('role="status"');
    expect(textOf(html)).not.toContain("Choose a new password");
  });

  it("follows its state in French too", () => {
    expect(textOf(elements(view({}, "fr"), "h1")[0] ?? "")).toBe("Réinitialiser le mot de passe");
    expect(textOf(elements(view({ done: true }, "fr"), "h1")[0] ?? "")).toBe("Mot de passe mis à jour");
    expect(view({ done: true }, "fr")).not.toContain('data-slot="card-footer"');
  });

  it("changes its title and nothing else of its heading: still the one h1, in the panel size", () => {
    for (const props of [{}, { done: true }]) {
      const [h1 = ""] = startTags(view(props), "h1");

      expect(decodedClassesOf(h1)).toEqual(expect.arrayContaining(["text-panel", "font-semibold"]));
    }
  });
});

describe("the form that takes the new password", () => {
  const view = (props: Partial<ComponentProps<typeof ResetPasswordFormView>> = {}, locale: Locale = "en") =>
    renderWithIntl(
      <ResetPasswordFormView
        password=""
        pending={false}
        failure={null}
        done={false}
        onPasswordChange={() => {}}
        onSubmit={() => {}}
        {...props}
      />,
      locale,
    );

  /** The submit button of a form. */
  const submitOf = (html: string) => startTags(html, "button").find((tag) => attribute(tag, "type") === "submit") ?? "";

  it("asks for one password, a new one, which the browser may fill in and the manager may save", () => {
    const html = view();
    const [field = ""] = startTags(html, "input");

    expect(startTags(html, "input")).toHaveLength(1);
    expect(attribute(field, "type")).toBe("password");
    expect(attribute(field, "autoComplete")).toBe("new-password");
    expect(elements(html, "label").map(textOf)).toEqual(["New password"]);
    expect(html).toContain(`for="${attribute(field, "id")}"`);
  });

  it("is a form that checks the password itself, not the browser", () => {
    expect(attribute(startTags(view(), "form")[0] ?? "", "noValidate")).toBe("");
  });

  // Sent before the scripts of the page have run, a form with no method is a GET:
  // the new password would be written into the address, the history and the access logs
  it("posts the form, so that the new password never goes into the address", () => {
    expect(attribute(startTags(view(), "form")[0] ?? "", "method")).toBe("post");
  });

  it("tells the strength of the password under its field, as it is typed", () => {
    expect(elements(view({ password: "" }), "li")).toHaveLength(0);
    expect(elements(view({ password: "abc" }), "li")).toHaveLength(5);
    expect(view({ password: "abc" }).indexOf("<li")).toBeGreaterThan(view({ password: "abc" }).indexOf("<input"));
  });

  it("ties the list of rules to the field it is about, so that the rules are read with it", () => {
    const html = view({ password: "abc" });
    const [list = ""] = startTags(html, "ul");
    const [field = ""] = startTags(html, "input");

    expect(attribute(list, "id")).toBeTruthy();
    expect(attribute(field, "aria-describedby")).toBe(attribute(list, "id"));
  });

  it("names no list while there is none: an empty field has no rules to describe it", () => {
    const [field = ""] = startTags(view({ password: "" }), "input");

    expect(attribute(field, "aria-describedby")).toBeUndefined();
  });

  it("has one button, full width and primary, which sends the form", () => {
    const html = view({ password: STRONG });
    const submit = submitOf(html);

    expect(submit).not.toBe("");
    expect(decodedClassesOf(submit)).toEqual(expect.arrayContaining(["w-full", "bg-primary"]));
    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toBe("Reset Password");
  });

  // A weak password is refused when the form is sent, as sign-up does, and told
  // under its field: a button that is off gives a keyboard, and a screen reader,
  // no word of why.
  it.each([
    ["", "nothing at all"],
    ["abc", "a short password with one rule met"],
    ["abcdefgh", "eight lowercase letters"],
    ["Abcdefg1", "four rules of five"],
    ["abcdefg1!", "everything but a capital"],
    ["Abcdefgh!", "everything but a number"],
    ["Abc1!", "everything but the length"],
    [STRONG, "every rule"],
  ])("never leaves the button off, whatever the password: %j (%s)", (password) => {
    const submit = submitOf(view({ password }));

    expect(attribute(submit, "disabled")).toBeUndefined();
    // Nor held as if it worked
    expect(attribute(submit, "aria-disabled")).toBeUndefined();
    expect(attribute(submit, "data-loading")).toBeUndefined();
  });

  it("tells a password that was refused before it was sent as the error of its own field, in the words of the locale", () => {
    const html = view({ password: "abc", failure: "auth.passwordTooWeak" });
    const [field = ""] = startTags(html, "input");
    const [error = ""] = elements(html, "p").filter((paragraph) => paragraph.includes('role="alert"'));

    expect(textOf(error)).toContain("Password does not meet all requirements");
    expect(attribute(startTags(error, "p")[0] ?? "", "id")).toBe(`${attribute(field, "id")}-error`);
    expect(attribute(field, "aria-invalid")).toBe("true");
    // The field names its rules and its error together
    expect(attribute(field, "aria-describedby")).toContain(`${attribute(field, "id")}-error`);
    expect(attribute(field, "aria-describedby")).toContain(attribute(startTags(html, "ul")[0] ?? "", "id") ?? "-");
    // It is the field's to say: no alert of the form, and what was typed is kept
    expect(html).not.toContain('data-slot="page-alert"');
    expect(attribute(field, "value")).toBe("abc");
  });

  it("tells it in French", () => {
    const html = view({ password: "abc", failure: "auth.passwordTooWeak" }, "fr");

    expect(textOf(html)).toContain("Le mot de passe ne remplit pas tous les critères");
  });

  it("tells any other refusal in an alert above the button, and leaves the field alone", () => {
    const html = view({ password: STRONG, failure: "auth.errors.invalidToken" });
    const [field = ""] = startTags(html, "input");

    expect(html).toContain('data-slot="page-alert"');
    expect(attribute(field, "aria-invalid")).toBeUndefined();
    expect(elements(html, "p").filter((paragraph) => paragraph.includes('role="alert"'))).toEqual([]);
  });

  it("is quiet at rest: no alert, no status", () => {
    const html = view({ password: STRONG });

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("works on the button, not by disabling it: the fields wait, read-only, and the button keeps its focus", () => {
    const html = view({ password: STRONG, pending: true });
    const [field = ""] = startTags(html, "input");
    const submit = submitOf(html);

    expect(attribute(field, "readOnly")).toBe("");
    expect(attribute(submit, "aria-disabled")).toBe("true");
    expect(attribute(submit, "disabled")).toBeUndefined();
    expect(attribute(submit, "data-loading")).toBe("");
    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toContain("Loading…");
  });

  it("says a refusal in the words of the locale, in an alert, and leads to a new link", () => {
    const html = view({ password: STRONG, failure: "auth.errors.invalidToken" });
    const [alert = ""] = html.match(/<div[^>]*role="alert"[\s\S]*?<\/a>/) ?? [];
    const ask = startTags(alert, "a").find((tag) => attribute(tag, "href") === "/forgot-password") ?? "";

    expect(alert).toContain('data-slot="page-alert"');
    expect(textOf(alert)).toContain("This link has expired or was already used.");
    expect(ask).toContain("data-locale-link");
    expect(textOf(alert)).toContain("Ask for a new link");
    // The alert comes before the button it explains
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('type="submit"'));
    // What was typed is kept
    expect(attribute(startTags(html, "input")[0] ?? "", "value")).toBe(STRONG);
  });

  it("says an error it has no words for with the generic message, in French too", () => {
    const html = view({ failure: "common.error" }, "fr");

    expect(textOf(html)).toContain("Une erreur est survenue");
    expect(textOf(html)).toContain("Demander un nouveau lien");
  });

  it("says a refusal in French", () => {
    const html = view({ failure: "auth.errors.invalidToken" }, "fr");

    expect(textOf(html)).toContain("Ce lien a expiré ou a déjà été utilisé.");
  });

  it("replaces the form with a confirmation and a full-width link to sign in, when the password has changed", () => {
    const html = view({ done: true });
    const signIn = startTags(html, "a").find((tag) => attribute(tag, "href") === "/sign-in") ?? "";

    expect(startTags(html, "form")).toEqual([]);
    expect(startTags(html, "input")).toEqual([]);
    expect(html).toContain('role="status"');
    expect(textOf(html)).toContain("Your password has been updated. You can now sign in.");
    expect(signIn).toContain("data-locale-link");
    expect(decodedClassesOf(signIn)).toEqual(expect.arrayContaining(["w-full", "bg-primary"]));
    expect(textOf(elements(html, "a").find((anchor) => anchor.includes('href="/sign-in"')) ?? "")).toBe("Sign In");
  });

  it("does not offer the way back next to the confirmation: the link to sign in is the one", () => {
    const anchors = startTags(view({ done: true }), "a").filter((tag) => attribute(tag, "href") === "/sign-in");

    expect(anchors).toHaveLength(1);
  });

  it("is a place the focus can be sent to once the form is gone, and never a tab stop", () => {
    const html = view({ done: true });
    const box = startTags(html, "div").find((tag) => attribute(tag, "tabindex") === "-1") ?? "";

    expect(box).not.toBe("");
    expect(decodedClassesOf(box)).toContain("focus:outline-hidden");
  });

  it("says the confirmation in French", () => {
    const html = view({ done: true }, "fr");

    expect(textOf(html)).toContain("Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.");
    expect(textOf(html)).toContain("Se connecter");
  });

  it("takes no color from the palette of the framework", () => {
    for (const props of [{ password: "abc" }, { password: STRONG, failure: "common.error" as const }, { done: true }]) {
      expect(view(props)).not.toMatch(/\b(?:bg|text|border)-(?:white|black|gray|slate|red|green)\b/);
    }
  });
});
