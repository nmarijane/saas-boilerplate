import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { RESET_TOKEN_COOKIE, RESET_TOKEN_MAX_AGE_SECONDS, resetTokenCookieOptions } from "@/features/auth/reset-token";
import { proxy } from "@/proxy";

/**
 * The token of the reset link does not stay in the address: the proxy takes it out before any page is
 * drawn, keeps it in an HttpOnly cookie and redirects to the same address without it. The page and its
 * payload never hold it (reset-password.test.tsx), and the server action reads the cookie
 * (tests/integration/reset-password-action.test.ts).
 */

vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});
vi.mock("@/shared/lib/rate-limit", () => ({ getRateLimiter: vi.fn() }));

const visit = (path: string, headers: HeadersInit = {}) => proxy(new NextRequest(`http://localhost${path}`, { headers }));

describe("following the link of a reset e-mail", () => {
  it.each([
    ["/en/reset-password?token=abc123", "/en/reset-password"],
    ["/fr/reset-password?token=abc123", "/fr/reset-password"],
    // No language in the address: the page, and the cookie that is for it, get the default one
    ["/reset-password?token=abc123", "/en/reset-password"],
  ])(
    "keeps the token of %s in a cookie and redirects to the page without it",
    async (path, bare) => {
      const response = await visit(path);

      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe(bare);
      expect(location.search).toBe("");
      expect(response.cookies.get(RESET_TOKEN_COOKIE)?.value).toBe("abc123");
    },
  );

  it("sets a cookie that no script reads, that is not sent across sites, and that does not last", async () => {
    const response = await visit("/en/reset-password?token=abc123");
    const set = response.headers.get("set-cookie") ?? "";

    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=lax/i);
    // The page that reads it, not the whole site: it is not sent with every request for fifteen minutes
    expect(set).toMatch(/Path=\/en\/reset-password(?:;|$)/i);
    expect(set).not.toMatch(/Path=\/(?:;|$)/i);
    expect(set).toContain(`Max-Age=${RESET_TOKEN_MAX_AGE_SECONDS}`);
    expect(set).not.toMatch(/;\s*Secure/i);
  });

  // From the scheme of the app's own address (what Better Auth uses for its cookies), not from a header that a proxy
  // may or may not send, and not from NODE_ENV: a Secure cookie is refused on plain http, and the page would say the link expired
  it("makes the cookie Secure when the app is served over https, whatever the headers say", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
    const noHeader = await visit("/en/reset-password?token=abc123");
    const claimsHttp = await visit("/en/reset-password?token=abc123", { "x-forwarded-proto": "http" });
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3088");
    const plainHttp = await visit("/en/reset-password?token=abc123", { "x-forwarded-proto": "https" });
    vi.stubEnv("NODE_ENV", "production");
    const productionOverHttp = await visit("/en/reset-password?token=abc123");
    vi.unstubAllEnvs();

    expect(noHeader.headers.get("set-cookie") ?? "").toMatch(/;\s*Secure/i);
    expect(claimsHttp.headers.get("set-cookie") ?? "").toMatch(/;\s*Secure/i);
    expect(plainHttp.headers.get("set-cookie") ?? "").not.toMatch(/;\s*Secure/i);
    expect(productionOverHttp.headers.get("set-cookie") ?? "").not.toMatch(/;\s*Secure/i);
    expect(resetTokenCookieOptions("fr", true)).toMatchObject({ secure: true, path: "/fr/reset-password" });
  });

  it("reads the app's other address when BETTER_AUTH_URL is set to nothing", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    const response = await visit("/en/reset-password?token=abc123");
    vi.unstubAllEnvs();

    expect(response.headers.get("set-cookie") ?? "").toMatch(/;\s*Secure/i);
  });

  it("keeps what else is in the address, and nothing of the token", async () => {
    const response = await visit("/en/reset-password?token=abc123&utm=mail");
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.search).toBe("?utm=mail");
    expect(response.headers.get("location")).not.toContain("abc123");
  });

  it("leaves the page alone when the link brings an error, or no token", async () => {
    for (const path of ["/en/reset-password?error=INVALID_TOKEN", "/en/reset-password"]) {
      const response = await visit(path);

      expect(response.headers.get("location"), path).toBeNull();
      expect(response.cookies.get(RESET_TOKEN_COOKIE), path).toBeUndefined();
    }
  });

  // Another page that has a `token` in its address is none of this business
  it("does not take the token of any other page", async () => {
    for (const path of ["/en/verify-email?token=abc123", "/en/sign-in?token=abc123", "/en/blog?token=abc123"]) {
      const response = await visit(path);

      expect(response.cookies.get(RESET_TOKEN_COOKIE), path).toBeUndefined();
    }
  });
});
