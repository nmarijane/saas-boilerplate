import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

// The proxy hands a page to the i18n middleware of next-intl, which is not what
// is tested here: it answers "go on". The rate limiter is for API routes only.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});
vi.mock("@/shared/lib/rate-limit", () => ({ getRateLimiter: vi.fn() }));

function visit(path: string, cookie?: string) {
  const headers: HeadersInit = cookie ? { cookie } : {};
  return proxy(new NextRequest(`https://app.example.com${path}`, { headers }));
}

/** The page the proxy sends the visitor to, or null when it lets them through. */
function redirectedTo(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("the session check of the proxy", () => {
  it("sends a visitor with no session to sign-in", async () => {
    expect(redirectedTo(await visit("/en/dashboard"))).toBe("/en/sign-in");
  });

  it("lets a session through under the cookie name used on http", async () => {
    const response = await visit("/en/dashboard", "better-auth.session_token=abc");

    expect(redirectedTo(response)).toBeNull();
  });

  // On https, as in production, Better Auth prefixes its cookie with __Secure-.
  it("lets a session through under the cookie name used on https", async () => {
    const response = await visit("/en/dashboard", "__Secure-better-auth.session_token=abc");

    expect(redirectedTo(response)).toBeNull();
  });
});
