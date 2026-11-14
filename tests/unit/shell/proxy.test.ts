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

// The plan a visitor picked on the pricing page survives sign-up in a short-lived
// cookie, and is resumed once they land in the app (src/features/billing/plan-choice.ts)
describe("the plan chosen before signing up", () => {
  const cookieOf = (response: Response) => response.headers.getSetCookie().find((line) => line.startsWith("plan_choice="));

  it.each(["/en/sign-up", "/fr/sign-in", "/en/choose-plan"])("is remembered when %s is opened with a plan of the product", async (path) => {
    const cookie = cookieOf(await visit(`${path}?plan=pro&interval=yearly`, path.endsWith("choose-plan") ? SESSION : {}));

    expect(cookie).toContain("plan_choice=pro%3Ayearly");
    expect(cookie?.toLowerCase()).toContain("httponly");
    expect(cookie).toContain("Max-Age=3600");
  });

  it("is remembered even when the visitor is sent to sign in", async () => {
    const response = await visit("/en/choose-plan?plan=pro&interval=monthly");

    expect(redirectedTo(response)?.pathname).toBe("/en/sign-in");
    expect(cookieOf(response)).toContain("plan_choice=pro%3Amonthly");
  });

  it.each(["plan=free", "plan=nope&interval=monthly", "plan=pro&interval=weekly", "plan[]=pro", ""])("is never made of what is not a plan of the product: %s", async (query) => {
    expect(cookieOf(await visit(`/en/sign-up?${query}`))).toBeUndefined();
  });

  it("is not remembered by a link that Next fetches ahead of the click: only a visitor who goes there chooses a plan", async () => {
    expect(cookieOf(await visit("/en/sign-up?plan=pro&interval=monthly", { "next-router-prefetch": "1", rsc: "1" }))).toBeUndefined();
    expect(cookieOf(await visit("/en/sign-up?plan=pro&interval=monthly", { "next-router-segment-prefetch": "/_tree" }))).toBeUndefined();
    expect(cookieOf(await visit("/en/sign-up?plan=pro&interval=monthly", { purpose: "prefetch" }))).toBeUndefined();
    // The navigation itself (client-side, a fetch of the page) does remember it
    expect(cookieOf(await visit("/en/sign-up?plan=pro&interval=monthly", { rsc: "1" }))).toContain("plan_choice=pro%3Amonthly");
  });

  it("is not set by any other page", async () => {
    expect(cookieOf(await visit("/en/pricing?plan=pro&interval=monthly"))).toBeUndefined();
  });

  it("sends the home to the choice of a plan, once: the choice goes in the address and the cookie is spent", async () => {
    const response = await visit("/en/dashboard", { ...SESSION, cookie: `${SESSION.cookie}; plan_choice=pro%3Ayearly` });
    const target = redirectedTo(response);

    expect(target?.pathname).toBe("/en/choose-plan");
    expect(target?.searchParams.get("plan")).toBe("pro");
    expect(target?.searchParams.get("interval")).toBe("yearly");
    expect(response.headers.getSetCookie().find((line) => line.startsWith("plan_choice="))).toMatch(/plan_choice=;|Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it("does not send the home anywhere for a choice that is not one, or without a session", async () => {
    expect(redirectedTo(await visit("/en/dashboard", { cookie: `${SESSION.cookie}; plan_choice=free%3Amonthly` }))).toBeNull();
    expect(redirectedTo(await visit("/en/dashboard", { cookie: "plan_choice=pro%3Amonthly" }))?.pathname).toBe("/en/sign-in");
  });
});
