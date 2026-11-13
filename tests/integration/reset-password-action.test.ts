import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/features/auth/auth";
import { resetPasswordWithLinkToken } from "@/features/auth/reset-password-action";
import { RESET_TOKEN_COOKIE } from "@/features/auth/reset-token";

/**
 * Setting the new password from the link of the reset e-mail: the token is in the HttpOnly cookie that the
 * proxy set (tests/unit/auth/reset-token.test.ts), and the server action reads it there. The page and the
 * browser never hold it. Better Auth is the real one, against the migrated database.
 */

const { sendMail, jar, BASE_URL } = vi.hoisted(() => {
  const BASE_URL = "http://localhost:3088";
  vi.stubEnv("BETTER_AUTH_URL", BASE_URL);
  return { sendMail: vi.fn().mockResolvedValue({}), jar: new Map<string, string>(), BASE_URL };
});
vi.mock("@/features/email/transporter", () => ({ transporter: { sendMail }, hasSmtpConfig: true }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    has: (name: string) => jar.has(name),
    delete: (name: string) => void jar.delete(name),
    // A cookie set to nothing, or to expire at once, on the path it was made for, is how it is taken away
    set: (name: string, value: string, options?: { path?: string; maxAge?: number }) => {
      if (value === "" || options?.maxAge === 0) {
        expect(options?.path).toBe("/en/reset-password");
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    },
  }),
}));

const OLD = "correct-horse-battery";
const NEW = "Another-Passw0rd!";
let counter = 0;

/** An account, and the token of the reset link that was e-mailed to it. */
async function asksForAReset() {
  counter += 1;
  const email = `reset-${counter}@example.com`;
  await auth.api.signUpEmail({ body: { name: "Reset Person", email, password: OLD } });
  const { testDb } = await import("../setup");
  const { user } = await import("@/models");
  const { eq } = await import("drizzle-orm");
  await testDb.update(user).set({ emailVerified: true }).where(eq(user.email, email));
  sendMail.mockClear();

  await auth.api.requestPasswordReset({ body: { email, redirectTo: "/en/reset-password" } });
  const html = (sendMail.mock.calls.at(-1)?.[0] as { html: string }).html;
  const link = /href="([^"]*reset-password\/[^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&") ?? "";
  const token = new URL(link, BASE_URL).pathname.split("/").pop() ?? "";

  return { email, token };
}

const canSignInWith = (email: string, password: string) =>
  auth.api.signInEmail({ body: { email, password } }).then(
    () => true,
    () => false,
  );

beforeEach(() => {
  jar.clear();
});

describe("setting the password from the cookie that holds the token", () => {
  it("sets it, forgets the token, and the old password stops working", async () => {
    const { email, token } = await asksForAReset();
    jar.set(RESET_TOKEN_COOKIE, token);

    await expect(resetPasswordWithLinkToken({ newPassword: NEW })).resolves.toEqual({ error: null });

    expect(jar.has(RESET_TOKEN_COOKIE)).toBe(false);
    expect(await canSignInWith(email, NEW)).toBe(true);
    expect(await canSignInWith(email, OLD)).toBe(false);
  });

  it("is used once: the link no longer works afterwards", async () => {
    const { token } = await asksForAReset();
    jar.set(RESET_TOKEN_COOKIE, token);
    await resetPasswordWithLinkToken({ newPassword: NEW });

    jar.set(RESET_TOKEN_COOKIE, token);
    const second = await resetPasswordWithLinkToken({ newPassword: "Yet-Another-1!" });

    expect(second.error).toMatchObject({ code: "INVALID_TOKEN" });
    expect(jar.has(RESET_TOKEN_COOKIE)).toBe(false);
  });

  // What stands in for a session is the cookie: with none, there is nothing to set a password for
  it("refuses when no token is waiting, and changes nothing", async () => {
    const { email } = await asksForAReset();

    await expect(resetPasswordWithLinkToken({ newPassword: NEW })).resolves.toMatchObject({ error: { code: "INVALID_TOKEN" } });

    expect(await canSignInWith(email, OLD)).toBe(true);
  });

  it("refuses a token that is not one, and throws it away", async () => {
    const { email } = await asksForAReset();
    jar.set(RESET_TOKEN_COOKIE, "a-token-that-is-nobodys");

    await expect(resetPasswordWithLinkToken({ newPassword: NEW })).resolves.toMatchObject({ error: { code: "INVALID_TOKEN" } });

    expect(jar.has(RESET_TOKEN_COOKIE)).toBe(false);
    expect(await canSignInWith(email, OLD)).toBe(true);
  });

  it("keeps the token when the password is refused: it can be chosen again", async () => {
    const { token } = await asksForAReset();
    jar.set(RESET_TOKEN_COOKIE, token);

    const answer = await resetPasswordWithLinkToken({ newPassword: "short" });

    expect(answer.error).toMatchObject({ status: 400 });
    expect(jar.get(RESET_TOKEN_COOKIE)).toBe(token);
  });

  // The token is not an argument: a request cannot bring its own
  it("takes no token from its arguments", async () => {
    const { email, token } = await asksForAReset();
    const withToken = { newPassword: NEW, token } as { newPassword: string };

    await expect(resetPasswordWithLinkToken(withToken)).resolves.toMatchObject({ error: { code: "INVALID_TOKEN" } });

    expect(await canSignInWith(email, OLD)).toBe(true);
  });
});
