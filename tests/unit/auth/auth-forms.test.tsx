import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The three forms of the sign-in pages, drawn as they are when the page opens.
// What a send does (the call, the message told for a refusal, the pending
// state) is the job of the flows (auth-flows.test.ts) and of the plays of the
// stories, which can press the buttons: Node has no DOM to click in. What is
// replaced here is what a form reaches for outside itself: the auth client, and
// the navigation of next-intl, which is replaced ({R}; its Link marks
// what it draws, so that a plain `<a>` is told from a link that keeps the locale).
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

type Locale = "en" | "fr";
type Providers = ("google" | "github")[];

/** What the server says is on, when the test does not choose: both. */
const BOTH: Providers = ["google", "github"];

const RAW_PALETTE = /\b(?:bg|text|border)-(?:white|black|gray|slate|zinc|red|green|blue)\b/;

/** The input of a form that is called by this name. */
function inputNamed(html: string, name: string): string {
  return startTags(html, "input").find((tag) => attribute(tag, "name") === name) ?? "";
}

/** The submit button of a form. */
function submitOf(html: string): string {
  return startTags(html, "button").find((tag) => attribute(tag, "type") === "submit") ?? "";
}

/** The words of the labels, in the order of the form. */
function labelsOf(html: string): string[] {
  return elements(html, "label").map(textOf);
}

describe("the sign-in form", () => {
  const draw = (locale: Locale = "en", providers: Providers = BOTH) =>
    renderWithIntl(<SignInForm socialProviders={providers} />, locale);

  // The screenshots of the README fill the form by these two labels.
  it("labels its two fields Email and Password, exactly", () => {
    expect(labelsOf(draw())).toEqual(["Email", "Password"]);
    expect(labelsOf(draw("fr"))).toEqual(["Email", "Mot de passe"]);
  });

  it("tells the browser and the password manager what each field is", () => {
    const html = draw();

    expect(attribute(inputNamed(html, "email"), "type")).toBe("email");
    expect(attribute(inputNamed(html, "email"), "autoComplete")).toBe("email");
    expect(attribute(inputNamed(html, "password"), "autoComplete")).toBe("current-password");
    expect(attribute(inputNamed(html, "email"), "required")).toBe("");
    expect(attribute(inputNamed(html, "password"), "required")).toBe("");
  });

  it("points each label at its field, through the field that wraps them", () => {
    const html = draw();

    for (const name of ["email", "password"]) {
      expect(html).toContain(`for="${attribute(inputNamed(html, name), "id")}"`);
    }
  });

  it("checks the fields itself, not the browser, so that what it says is in the language of the page", () => {
    expect(attribute(startTags(draw(), "form")[0] ?? "", "noValidate")).toBe("");
  });

  it("has one primary button, full width, which sends the form", () => {
    const html = draw();
    const submit = submitOf(html);

    expect(startTags(html, "button").filter((tag) => attribute(tag, "type") === "submit")).toHaveLength(1);
    expect(decodedClassesOf(submit)).toEqual(expect.arrayContaining(["w-full", "bg-primary"]));
    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toBe("Sign In");
  });

  it("offers the way to a new password as a link under the field, on a line of its own: a 44 px target that keeps the locale", () => {
    const html = draw();
    const forgot = startTags(html, "a").find((tag) => attribute(tag, "href") === "/forgot-password") ?? "";

    expect(forgot).toContain("data-locale-link");
    expect(decodedClassesOf(forgot)).toContain("tap-target");
    expect(textOf(html)).toContain("Forgot Password?");
    // Under the password field, over the button that sends the form
    expect(html.indexOf('href="/forgot-password"')).toBeGreaterThan(html.indexOf('name="password"'));
    expect(html.indexOf('href="/forgot-password"')).toBeLessThan(html.indexOf('type="submit"'));
  });

  it("offers the other ways in under the form: Google and GitHub, as outlined buttons, after the separator", () => {
    const html = draw();
    const social = startTags(html, "button").filter((tag) => attribute(tag, "type") === "button" && !tag.includes("aria-label"));

    expect(textOf(html)).toContain("Or continue with");
    expect(textOf(html)).toContain("Google");
    expect(textOf(html)).toContain("GitHub");
    expect(social).toHaveLength(2);
    expect(html.indexOf("Or continue with")).toBeGreaterThan(html.indexOf('type="submit"'));
  });

  it("offers only the way in that the server says is on", () => {
    const html = draw("en", ["github"]);

    expect(elements(html, "button").map(textOf)).toContain("GitHub");
    expect(elements(html, "button").map(textOf)).not.toContain("Google");
    expect(textOf(html)).toContain("Or continue with");
  });

  it("offers no other way in when none is on: no separator and no button, an install that has no OAuth keys", () => {
    const html = draw("en", []);

    expect(textOf(html)).not.toContain("Or continue with");
    expect(textOf(html)).not.toContain("Google");
    expect(textOf(html)).not.toContain("GitHub");
    // The form itself is whole
    expect(labelsOf(html)).toEqual(["Email", "Password"]);
    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toBe("Sign In");
  });

  it("offers no other way in when it is given no list at all", () => {
    const html = renderWithIntl(<SignInForm />);

    expect(textOf(html)).not.toContain("Or continue with");
  });

  it("is quiet at rest: no alert", () => {
    expect(draw()).not.toContain('role="alert"');
  });

  it("keeps the locale in every link, and takes no color from the palette of the framework", () => {
    const html = draw();

    for (const anchor of startTags(html, "a")) {
      expect(anchor).toContain("data-locale-link");
    }
    expect(html).not.toMatch(RAW_PALETTE);
  });
});

describe("the sign-up form", () => {
  const draw = (locale: Locale = "en", providers: Providers = BOTH) =>
    renderWithIntl(<SignUpForm socialProviders={providers} />, locale);

  it("labels its four fields in the order a person fills them", () => {
    expect(labelsOf(draw())).toEqual(["Name", "Email", "Password", "Confirm Password"]);
    expect(labelsOf(draw("fr"))).toEqual(["Nom", "Email", "Mot de passe", "Confirmer le mot de passe"]);
  });

  it("tells the browser and the password manager what each field is", () => {
    const html = draw();

    expect(attribute(inputNamed(html, "name"), "autoComplete")).toBe("name");
    expect(attribute(inputNamed(html, "email"), "autoComplete")).toBe("email");
    expect(attribute(inputNamed(html, "password"), "autoComplete")).toBe("new-password");
    expect(attribute(inputNamed(html, "confirmPassword"), "autoComplete")).toBe("new-password");
  });

  it("checks the fields itself, not the browser", () => {
    expect(attribute(startTags(draw(), "form")[0] ?? "", "noValidate")).toBe("");
  });

  it("tells the strength of the password only once there is one to tell", () => {
    expect(elements(draw(), "li")).toHaveLength(0);
  });

  it("has one primary button, full width, which sends the form, and the other ways in under it", () => {
    const html = draw();
    const submit = submitOf(html);

    expect(decodedClassesOf(submit)).toEqual(expect.arrayContaining(["w-full", "bg-primary"]));
    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toBe("Sign Up");
    expect(textOf(html)).toContain("Or continue with");
  });

  it("offers only the way in that the server says is on, and none when none is", () => {
    expect(elements(draw("en", ["google"]), "button").map(textOf)).toContain("Google");
    expect(elements(draw("en", ["google"]), "button").map(textOf)).not.toContain("GitHub");
    expect(textOf(draw("en", []))).not.toContain("Or continue with");
    expect(textOf(renderWithIntl(<SignUpForm />))).not.toContain("Or continue with");
  });

  it("is quiet at rest: no alert, no status", () => {
    const html = draw();

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("keeps the locale in every link, and takes no color from the palette of the framework", () => {
    const html = draw();

    for (const anchor of startTags(html, "a")) {
      expect(anchor).toContain("data-locale-link");
    }
    expect(html).not.toMatch(RAW_PALETTE);
  });
});

describe("the forgot-password form", () => {
  const draw = (locale: Locale = "en") => renderWithIntl(<ForgotPasswordForm />, locale);

  it("asks for the email, which the browser may fill in", () => {
    const html = draw();

    expect(labelsOf(html)).toEqual(["Email"]);
    expect(attribute(inputNamed(html, "email"), "type")).toBe("email");
    expect(attribute(inputNamed(html, "email"), "autoComplete")).toBe("email");
    expect(attribute(startTags(html, "form")[0] ?? "", "noValidate")).toBe("");
  });

  it("has one primary button, full width, which sends the form", () => {
    const html = draw();

    expect(decodedClassesOf(submitOf(html))).toEqual(expect.arrayContaining(["w-full", "bg-primary"]));
    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toBe("Reset Password");
  });

  // The way back to the sign-in page is the footer of the card the page draws
  // (it is the same in both states of the form, so the form has none of its own).
  it("has no link of its own: the way back is the footer of its card", () => {
    expect(startTags(draw(), "a")).toEqual([]);
    expect(startTags(draw("fr"), "a")).toEqual([]);
  });

  it("is quiet at rest: no alert, no status", () => {
    const html = draw();

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });
});

// A form that is sent before the scripts of its page have run (a slow network, a
// script that does not load) is sent by the browser as plain HTML. With no
// `method` that is a GET: the fields, a password among them, end up in the address
// bar, then in the history and in the access logs of every server on the way.
// A POST carries them in its body.
describe("what a form with a password does when it is sent before the scripts have run", () => {
  it.each([
    ["sign-in", () => renderWithIntl(<SignInForm />)],
    ["sign-up", () => renderWithIntl(<SignUpForm />)],
    ["forgot-password", () => renderWithIntl(<ForgotPasswordForm />)],
  ])("posts the %s form, so that its fields never go into the address", (_, draw) => {
    const forms = startTags(draw(), "form");

    expect(forms).toHaveLength(1);
    expect(attribute(forms[0] ?? "", "method")).toBe("post");
  });
});

// Better Auth sends the person back to the sign-in page with `?error=<code>` when a
// provider is cancelled or refuses, and the page gives the form the message to tell.
describe("the sign-in form, when a provider has sent the person back with an error", () => {
  it("tells it in an alert, in the words of the language of the page", () => {
    const html = renderWithIntl(<SignInForm initialFailure="auth.errors.accessDenied" />);

    expect(html).toContain('role="alert"');
    expect(textOf(html)).toContain("Sign-in was cancelled");
    expect(textOf(renderWithIntl(<SignInForm initialFailure="auth.errors.accessDenied" />, "fr"))).toContain(
      "La connexion a été annulée",
    );
  });

  it("tells the generic error for a code it has no words for", () => {
    expect(textOf(renderWithIntl(<SignInForm initialFailure="common.error" />))).toContain("An error occurred");
  });

  it("is quiet when there is none", () => {
    expect(renderWithIntl(<SignInForm />)).not.toContain('role="alert"');
  });
});
