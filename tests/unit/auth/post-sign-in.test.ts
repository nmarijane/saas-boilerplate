import { describe, expect, it } from "vitest";
import { signInTarget } from "@/features/auth/post-sign-in";

/**
 * Where signing in leads. The proxy sends a visitor who has no session to the
 * sign-in page with the page they asked for in `callbackUrl`, a path with its
 * language (`/fr/projects/abc`): after signing in they should be there. The
 * parameter comes from the address bar, so it is whatever anyone put in a link:
 * only a path of the app is followed, and everything else (a web address, a
 * path that a browser reads as another host, a scheme) leads to the dashboard.
 */

const DASHBOARD = { href: "/dashboard" };

describe("where signing in leads", () => {
  it.each([undefined, null, ""])("is the dashboard when there is no page that was asked for: %j", (callbackUrl) => {
    expect(signInTarget(callbackUrl)).toEqual(DASHBOARD);
  });

  it("is the page that was asked for, in the language its path carries", () => {
    expect(signInTarget("/fr/projects/abc")).toEqual({ href: "/projects/abc", locale: "fr" });
    expect(signInTarget("/en/settings/team")).toEqual({ href: "/settings/team", locale: "en" });
  });

  it("is the page that was asked for, in the language of the sign-in page, when its path carries none", () => {
    expect(signInTarget("/projects/abc")).toEqual({ href: "/projects/abc" });
  });

  it("keeps the query and the fragment of the page", () => {
    expect(signInTarget("/fr/projects/abc?tab=members#top")).toEqual({
      href: "/projects/abc?tab=members#top",
      locale: "fr",
    });
  });

  it("is the home of a language when the path is only the language", () => {
    expect(signInTarget("/fr")).toEqual({ href: "/", locale: "fr" });
    expect(signInTarget("/fr/")).toEqual({ href: "/", locale: "fr" });
  });

  it("does not take the first segment of a path for a language when it is not one of the app's", () => {
    expect(signInTarget("/de/projects")).toEqual({ href: "/de/projects" });
    expect(signInTarget("/frozen/projects")).toEqual({ href: "/frozen/projects" });
  });

  // What a browser would resolve on another origin, or not as a page at all
  it.each([
    "https://evil.example/phish",
    "http://evil.example",
    "//evil.example/phish",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    " //evil.example",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "mailto:someone@example.com",
    "evil.example/phish",
    "dashboard",
    "?x=1",
  ])("is the dashboard, never the address: %j", (callbackUrl) => {
    expect(signInTarget(callbackUrl)).toEqual(DASHBOARD);
  });

  it("is the dashboard when what follows the language would make another host", () => {
    // "/fr//evil.example" is the path "//evil.example" once the language is taken off
    expect(signInTarget("/fr//evil.example/phish")).toEqual(DASHBOARD);
    expect(signInTarget("/fr/\\evil.example")).toEqual(DASHBOARD);
  });

  it("reads the path a browser would, not the characters it was written with", () => {
    expect(signInTarget("/en/../fr/projects")).toEqual({ href: "/projects", locale: "fr" });
  });
});
