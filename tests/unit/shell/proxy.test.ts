import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { APP_PATH_PREFIXES } from "@/shared/config/app";

// The proxy hands the request to the i18n middleware of next-intl and, for an
// API route, to the rate limiter: neither is what is tested here. The first
// answers "go on", and the second is never reached by a page.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});
vi.mock("@/shared/lib/rate-limit", () => ({ getRateLimiter: vi.fn() }));

const SESSION = { cookie: "better-auth.session_token=abc" };

function visit(path: string, headers: HeadersInit = {}) {
  return proxy(new NextRequest(`http://localhost${path}`, { headers }));
}

/** Where the proxy sends the visitor, or null when it lets them through. */
function redirectedTo(response: Response): URL | null {
  const location = response.headers.get("location");
  return location ? new URL(location) : null;
}

describe("the auth guard of the proxy", () => {
  it("guards the pages of the connected space", () => {
    // The list of what needs a session is APP_PATH_PREFIXES, and nothing else.
    expect(APP_PATH_PREFIXES).toEqual(
      expect.arrayContaining([
        "/dashboard",
        // The assistant guarded itself in its page, but the proxy let a visitor reach it.
        "/ai",
        "/settings",
        "/onboarding",
        "/admin",
      ]),
    );
  });

  it.each(APP_PATH_PREFIXES)(
    "sends a visitor with no session from %s to sign in, and keeps where they were going",
    async (prefix) => {
      const target = redirectedTo(await visit(`/en${prefix}`));

      expect(target?.pathname).toBe("/en/sign-in");
      expect(target?.searchParams.get("callbackUrl")).toBe(`/en${prefix}`);
    },
  );

  it.each(APP_PATH_PREFIXES)(
    "guards the pages under %s too, in the language of the visitor",
    async (prefix) => {
      const target = redirectedTo(await visit(`/fr${prefix}/a/page`));

      expect(target?.pathname).toBe("/fr/sign-in");
      expect(target?.searchParams.get("callbackUrl")).toBe(`/fr${prefix}/a/page`);
    },
  );

  it("signs in in the default language when the path has none", async () => {
    const target = redirectedTo(await visit("/dashboard"));

    expect(target?.pathname).toBe("/en/sign-in");
  });

  it.each(APP_PATH_PREFIXES)(
    "lets a visitor with a session into %s",
    async (prefix) => {
      expect(redirectedTo(await visit(`/en${prefix}`, SESSION))).toBeNull();
    },
  );

  it.each([
    "/en",
    "/en/pricing",
    "/en/sign-in",
    "/fr/blog/a-post",
    // Whole segments only: a page whose name merely starts like a guarded one is public.
    "/en/dashboard-old",
    "/en/settingsfoo",
    "/en/administrator",
  ])("leaves %s to everyone", async (path) => {
    expect(redirectedTo(await visit(path))).toBeNull();
  });
});
