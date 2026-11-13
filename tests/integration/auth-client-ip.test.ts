import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/features/auth/auth";
import { CLIENT_IP_HEADER } from "@/shared/lib/client-ip";

/**
 * The route of Better Auth hands it the address of the client in the one header
 * that its own limit by address reads (`advanced.ipAddress` in auth.ts), and
 * whatever the client wrote in that header is dropped: the address is the one that
 * TRUST_PROXY allows. Better Auth itself takes a single `X-Forwarded-For` from any
 * client, which is why it is not told to read that one.
 */

const { handler } = vi.hoisted(() => ({ handler: vi.fn(async (_request: Request) => new Response("{}")) }));
vi.mock("@/features/auth/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/auth/auth")>();
  return { auth: new Proxy(original.auth, { get: (target, property) => (property === "handler" ? handler : Reflect.get(target, property)) }) };
});

const { GET, POST } = await import("@/app/api/auth/[...all]/route");

const url = "http://localhost:3088/api/auth/get-session";

afterEach(() => {
  vi.unstubAllEnvs();
  handler.mockClear();
});

function addressSeenFor(headers: Record<string, string>) {
  return GET(new Request(url, { headers })).then(() => handler.mock.calls[0]?.[0].headers.get(CLIENT_IP_HEADER) ?? null);
}

describe("the address that Better Auth is given", () => {
  it("reads its address from the header that the route writes", () => {
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([CLIENT_IP_HEADER]);
  });

  it("is none when no proxy is trusted, whatever the client wrote, in X-Forwarded-For or in that header itself", async () => {
    vi.stubEnv("TRUST_PROXY", "");

    expect(await addressSeenFor({ "x-forwarded-for": "6.6.6.6", [CLIENT_IP_HEADER]: "7.7.7.7" })).toBeNull();
  });

  it("is the address that the proxy allows, and never one that the client put in the header itself", async () => {
    vi.stubEnv("TRUST_PROXY", "1");

    expect(await addressSeenFor({ "x-forwarded-for": "6.6.6.6, 203.0.113.7", [CLIENT_IP_HEADER]: "7.7.7.7" })).toBe("203.0.113.7");
  });

  it("is given to a POST too, with its body", async () => {
    vi.stubEnv("TRUST_PROXY", "1");

    await POST(new Request(url, { method: "POST", body: '{"a":1}', headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" } }));

    const received = handler.mock.calls[0]?.[0];
    expect(received?.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(await received?.text()).toBe('{"a":1}');
  });
});

describe("where a failed provider sign-in lands", () => {
  // Better Auth's own error page is unstyled under the closed policy of /api: the sign-in page says it in words
  it("is the sign-in page of the app, not Better Auth's own error page", () => {
    expect(auth.options.onAPIError?.errorURL).toBe("/sign-in");
  });
});
