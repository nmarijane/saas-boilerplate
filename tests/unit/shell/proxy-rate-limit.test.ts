import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

/**
 * The limit by address on the API routes: which address the proxy counts a request for.
 * The limiter is a stub that records the key it is asked about.
 */

const { check } = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});
vi.mock("@/shared/lib/rate-limit", () => ({ getRateLimiter: async () => ({ check }) }));

function call(headers: Record<string, string>) {
  check.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });

  return proxy(new NextRequest("http://localhost/api/notifications", { headers }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  check.mockReset();
});

describe("the key of the limit on an API route", () => {
  // Without a trusted proxy, a client that varies its X-Forwarded-For would be a new client at each request
  it("is the same shared key whatever X-Forwarded-For says, when no proxy is trusted", async () => {
    vi.stubEnv("TRUST_PROXY", "");

    await call({ "x-forwarded-for": "1.1.1.1" });
    await call({ "x-forwarded-for": "2.2.2.2" });

    expect(check.mock.calls.map(([key]) => key)).toEqual(["ip:unknown", "ip:unknown"]);
  });

  it("is the address that the proxy appended, behind one reverse proxy, and not what the client wrote before it", async () => {
    vi.stubEnv("TRUST_PROXY", "1");

    await call({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" });
    await call({ "x-forwarded-for": "7.7.7.7, 203.0.113.7" });

    expect(check.mock.calls.map(([key]) => key)).toEqual(["ip:203.0.113.7", "ip:203.0.113.7"]);
  });

  it("is the address that Vercel sets, on Vercel", async () => {
    vi.stubEnv("TRUST_PROXY", "vercel");

    await call({ "x-vercel-forwarded-for": "198.51.100.4", "x-forwarded-for": "6.6.6.6" });

    expect(check.mock.calls[0]?.[0]).toBe("ip:198.51.100.4");
  });
});
