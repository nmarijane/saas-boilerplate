import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SocialButtons } from "@/features/auth/components/social-buttons";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The other ways in, under the form of the sign-in and sign-up pages. The server
// says which providers are on, the page hands the list down, and a button is
// drawn for each of those and for no other. What a press does (the refusal told,
// the button held while the page leaves) needs a DOM to click in: the stories
// press the buttons. What is replaced here is what the buttons reach for outside
// themselves: the auth client and the navigation of next-intl.
vi.mock("@/features/auth/auth-client", () => ({ authClient: {} }));
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
    usePathname: () => "/sign-in",
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    redirect: () => undefined,
  };
});

type Provider = "google" | "github";

const draw = (providers: Provider[], locale: "en" | "fr" = "en") =>
  renderWithIntl(<SocialButtons providers={providers} />, locale);

describe("the other ways in", () => {
  it("draw nothing when no provider is on: neither the separator nor a button", () => {
    const html = draw([]);

    expect(html).toBe("");
    expect(textOf(html)).not.toContain("Or continue with");
  });

  it("draw only the button of the provider that is on, with the separator that says what it is", () => {
    const html = draw(["github"]);

    expect(elements(html, "button").map(textOf)).toEqual(["GitHub"]);
    expect(textOf(html)).not.toContain("Google");
    expect(textOf(html)).toContain("Or continue with");
  });

  it("draw one button for each provider, in the order of the list", () => {
    expect(elements(draw(["google", "github"]), "button").map(textOf)).toEqual(["Google", "GitHub"]);
    expect(elements(draw(["github", "google"]), "button").map(textOf)).toEqual(["GitHub", "Google"]);
    expect(elements(draw(["google"]), "button").map(textOf)).toEqual(["Google"]);
  });

  it("put two buttons side by side, and one button on the whole width", () => {
    const row = (providers: Provider[]) =>
      startTags(draw(providers), "div").find((tag) => decodedClassesOf(tag).includes("gap-3") && decodedClassesOf(tag).includes("grid")) ?? "";

    expect(decodedClassesOf(row(["google", "github"]))).toContain("grid-cols-2");
    expect(decodedClassesOf(row(["github"]))).not.toContain("grid-cols-2");
  });

  it("are outlined buttons, each as wide as its place, so that the one primary button of the form is the only filled one", () => {
    for (const providers of [["google"], ["github"], ["google", "github"]] as Provider[][]) {
      for (const button of startTags(draw(providers), "button")) {
        expect(attribute(button, "type")).toBe("button");
        expect(decodedClassesOf(button)).toEqual(expect.arrayContaining(["w-full", "border-input", "bg-surface"]));
        expect(decodedClassesOf(button)).not.toContain("bg-primary");
      }
    }
  });

  it("carry the logo of their provider in its own colors, as decoration: the name on the button is what it is called", () => {
    const html = draw(["google", "github"]);

    expect(startTags(html, "svg")).toHaveLength(2);
    for (const svg of startTags(html, "svg")) {
      expect(attribute(svg, "aria-hidden")).toBe("true");
    }
  });

  it("say the separator in the language of the page", () => {
    expect(textOf(draw(["github"], "fr"))).toContain("Ou continuer avec");
  });

  it("are quiet at rest: no alert, no status", () => {
    const html = draw(["google", "github"]);

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("let go of every button at rest: none loading, none off", () => {
    for (const button of startTags(draw(["google", "github"]), "button")) {
      expect(attribute(button, "data-loading")).toBeUndefined();
      expect(attribute(button, "disabled")).toBeUndefined();
      expect(attribute(button, "aria-disabled")).toBeUndefined();
    }
  });
});
