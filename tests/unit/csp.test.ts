import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { contentSecurityPolicy, makeNonce } from "@/shared/lib/csp";

vi.mock("@/shared/lib/rate-limit", () => ({ getRateLimiter: vi.fn() }));
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return {
    default: () => (request: Request) => NextResponse.next({ request: { headers: request.headers } }),
  };
});

const directive = (policy: string, name: string) =>
  policy.split("; ").find((entry) => entry.startsWith(`${name} `))?.slice(name.length + 1).split(" ") ?? [];

describe("the Content-Security-Policy", () => {
  const policy = contentSecurityPolicy({ nonce: "abc123" });

  it("lets scripts run when they are the app's own or carry the nonce of the request, and not inline", () => {
    const scripts = directive(policy, "script-src");

    expect(scripts).toEqual(expect.arrayContaining(["'self'", "'nonce-abc123'", "'strict-dynamic'"]));
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("allows eval for the dev server only", () => {
    expect(directive(contentSecurityPolicy({ nonce: "n", development: true }), "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(policy, "connect-src")).not.toContain("ws:");
    expect(directive(contentSecurityPolicy({ nonce: "n", development: true }), "connect-src")).toContain("ws:");
  });

  it("shuts what the app does not use", () => {
    expect(directive(policy, "default-src")).toEqual(["'self'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
  });

  it("allows pictures from https (the pictures of people), and no plain http", () => {
    const images = directive(policy, "img-src");

    expect(images).toContain("https:");
    expect(images).not.toContain("http:");
  });

  it("draws a nonce that is new each time and is base64 of 128 bits", () => {
    const nonces = new Set(Array.from({ length: 50 }, makeNonce));

    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Z0-9+/]{22}==$/i);
    }
  });
});

// The proxy puts the policy on the page, and the nonce on the request that the page is drawn for
describe("the policy on a page", () => {
  it("is enforced, with a nonce that is the one of the request, and never report-only", async () => {
    const response = await proxy(new NextRequest("http://localhost/en/sign-in"));

    const policy = response.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeTruthy();
    expect(response.headers.get("content-security-policy-report-only")).toBeNull();
    // The request that the page is drawn for carries the same nonce, which Next reads to mark its own scripts
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
  });

  it("uses a nonce of its own for each request", async () => {
    const nonces = await Promise.all(
      [1, 2, 3].map(async () => /'nonce-([^']+)'/.exec((await proxy(new NextRequest("http://localhost/en/sign-in"))).headers.get("content-security-policy") ?? "")?.[1]),
    );

    expect(new Set(nonces).size).toBe(3);
  });

  it("does not take a nonce that the client sends", async () => {
    const response = await proxy(new NextRequest("http://localhost/en/sign-in", { headers: { "x-nonce": "attacker" } }));

    expect(response.headers.get("x-middleware-request-x-nonce")).not.toBe("attacker");
  });
});
