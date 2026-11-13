import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthClient } from "better-auth/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { signInFlow } from "@/features/auth/auth-flows";
import { testDb } from "../setup";

/**
 * A sign-in that the limiter of Better Auth refuses, as the form hears it.
 * Better Auth limits sign-in to three attempts in ten seconds for one address,
 * in production only (that is why the app's own instance, built for the tests,
 * never refuses): here a second instance turns the real limiter on, and the
 * client of the browser talks to it. The refusal is a 429 with a sentence and
 * no code, and the flow tells it to wait, in the words of the page, where it
 * told the generic error.
 */

const BASE_URL = "http://localhost:3088";

vi.mock("@/shared/lib/i18n-navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

afterAll(() => {
  vi.unstubAllGlobals();
});

const limited = betterAuth({
  baseURL: BASE_URL,
  secret: "a-secret-of-this-test-alone-0123456789abcdef",
  database: drizzleAdapter(testDb, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: true },
});

/** The client of a browser whose address is `address`, against the instance that limits. */
function browserAt(address: string) {
  return createAuthClient({
    baseURL: BASE_URL,
    fetchOptions: {
      customFetchImpl: (input, init) => {
        const request = new Request(input, init);
        request.headers.set("origin", BASE_URL);
        request.headers.set("x-forwarded-for", address);

        return limited.handler(request);
      },
    },
  });
}

const attempt = { email: "nobody-here@example.com", password: "not-the-password", locale: "en" };

describe("a sign-in refused by the limiter", () => {
  it("reports a 429 with its status, a sentence and no code: the status is all there is to tell it by", async () => {
    const client = browserAt("10.20.0.1");
    for (let attempts = 0; attempts < 3; attempts += 1) {
      await client.signIn.email({ email: attempt.email, password: attempt.password });
    }

    const { data, error } = await client.signIn.email({ email: attempt.email, password: attempt.password });

    expect(data).toBeNull();
    expect(error).toMatchObject({ status: 429 });
    expect(error?.code).toBeUndefined();
  });

  it("tells the fourth attempt in ten seconds to wait, and the three before it that the password is wrong", async () => {
    const client = browserAt("10.20.0.2");

    const told = [];
    for (let attempts = 0; attempts < 4; attempts += 1) {
      const result = await signInFlow(client, attempt);
      told.push(result.ok ? "in" : result.messageKey);
    }

    expect(told).toEqual([
      "auth.errors.invalidCredentials",
      "auth.errors.invalidCredentials",
      "auth.errors.invalidCredentials",
      "auth.errors.tooManyAttempts",
    ]);
  });

  it("limits an address on its own: another one still gets its answer", async () => {
    const busy = browserAt("10.20.0.3");
    for (let attempts = 0; attempts < 4; attempts += 1) {
      await signInFlow(busy, attempt);
    }

    const other = await signInFlow(browserAt("10.20.0.4"), attempt);

    expect(other).toEqual({ ok: false, messageKey: "auth.errors.invalidCredentials" });
  });
});
