import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Where the auth client of the browser sends its calls: to the origin of the
 * page it runs in, whatever port the app is served on (`npm run dev` and the
 * production build do not share one) and whatever `NEXT_PUBLIC_APP_URL` says.
 * A base URL written into the client is the one origin that is wrong somewhere.
 *
 * Node has no window: one is given, with the origin of a page, and a `fetch`
 * that says what it was asked. The client captures the global `fetch` when its
 * module loads, so both are in place before the module is imported.
 */

/** The URL the client asks for when it signs in, on a page served from `origin`. */
async function signInRequestFrom(origin: string): Promise<string> {
  vi.resetModules();
  vi.stubGlobal("window", { location: { origin, href: `${origin}/en/sign-in` } });
  let requested = "";
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    requested = String(input instanceof Request ? input.url : input);

    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  });
  const { authClient } = await import("@/features/auth/auth-client");

  await authClient.signIn.email({ email: "camille@example.com", password: "admin123" });

  return requested;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the auth client of the browser", () => {
  it.each([
    "http://localhost:3088",
    "http://localhost:3089",
    "https://preview-42.example.app",
  ])("calls the origin of the page it runs in: %s", async (origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

    await expect(signInRequestFrom(origin)).resolves.toBe(`${origin}/api/auth/sign-in/email`);
  });

  it("ignores NEXT_PUBLIC_APP_URL: the page it runs in is where its session cookie lives", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

    await expect(signInRequestFrom("http://localhost:3088")).resolves.toBe(
      "http://localhost:3088/api/auth/sign-in/email",
    );
  });
});
