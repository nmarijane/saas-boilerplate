import { describe, expect, it } from "vitest";
import { verificationLink, verifiedAddress } from "@/features/auth/verification";

/**
 * Where the link of a verification e-mail comes back to. Better Auth checks the
 * token, then redirects to the `callbackURL` it was given (or to `/`, the
 * marketing site, signed out), with `error=` added when the link is dead. The
 * app gives it the verify page, which says the address is verified: a person
 * who followed the link has nowhere else to learn that it worked.
 */

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImEifQ.sig_nature-1";
const VERIFY = "http://localhost:3088/api/auth/verify-email";

/** The `callbackURL` a link carries, decoded: where the browser is sent once the address is verified. */
function callbackOf(link: string): string | null {
  return new URL(link).searchParams.get("callbackURL");
}

describe("the address a verification link comes back to", () => {
  it("is the verify page, with the mark that says the link was good", () => {
    expect(verifiedAddress()).toBe("/verify-email?verified=1");
  });

  it("is the verify page of a language when it is given the path of the page", () => {
    expect(verifiedAddress("/fr/verify-email")).toBe("/fr/verify-email?verified=1");
  });

  // Someone who signs up from a page that asked for it (an invitation) comes back to
  // that page once they sign in: the verify page passes it on to the sign-in page
  it("carries the page to come back to after signing in, when it is a page of the app", () => {
    expect(verifiedAddress("/fr/verify-email", "/fr/accept-invitation/inv_1")).toBe(
      "/fr/verify-email?verified=1&callbackUrl=%2Ffr%2Faccept-invitation%2Finv_1",
    );
  });

  it("drops a page to come back to that is not one of the app", () => {
    for (const elsewhere of ["https://evil.example/phish", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""]) {
      expect(verifiedAddress("/fr/verify-email", elsewhere), elsewhere).toBe("/fr/verify-email?verified=1");
    }
  });
});

describe("the link of a verification e-mail", () => {
  it("lands on the verify page when Better Auth gives it the default `/`: a sign-in does not say where it came from", () => {
    const link = verificationLink(`${VERIFY}?token=${TOKEN}&callbackURL=%2F`);

    expect(callbackOf(link)).toBe("/verify-email?verified=1");
  });

  it("lands on the verify page when no callbackURL was given at all", () => {
    expect(callbackOf(verificationLink(`${VERIFY}?token=${TOKEN}`))).toBe("/verify-email?verified=1");
  });

  it("keeps the page that the caller chose, with its language: the sign-up form knows it", () => {
    const link = verificationLink(`${VERIFY}?token=${TOKEN}&callbackURL=${encodeURIComponent("/fr/verify-email?verified=1")}`);

    expect(callbackOf(link)).toBe("/fr/verify-email?verified=1");
  });

  it("keeps the token, and everything else the link says, as it was", () => {
    const link = new URL(verificationLink(`${VERIFY}?token=${TOKEN}&callbackURL=%2F`));

    expect(link.origin + link.pathname).toBe(VERIFY);
    expect(link.searchParams.get("token")).toBe(TOKEN);
  });

  it("leaves a link that cannot be read as it is", () => {
    expect(verificationLink("not a url")).toBe("not a url");
  });
});
