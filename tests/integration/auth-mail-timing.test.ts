import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/features/auth/auth";
import { user } from "@/models";
import { testDb } from "../setup";

/**
 * The mails of Better Auth (verification, password reset) go out after the answer, so that the
 * answer takes as long whether a mail was sent or not: an address with an account and one
 * without are not told apart by the time they take. The transport is slow here (1.5 s, as a mail
 * server that is busy can be), and `after` is the one of a test: it keeps what it is given, and
 * the test runs it when it says the answer has gone.
 */

const { sendMail, BASE_URL, later } = vi.hoisted(() => {
  const BASE_URL = "http://localhost:3088";
  vi.stubEnv("BETTER_AUTH_URL", BASE_URL);
  return {
    sendMail: vi.fn(),
    BASE_URL,
    later: { tasks: [] as (() => Promise<void>)[] },
  };
});
vi.mock("@/features/email/transporter", () => ({ transporter: { sendMail }, hasSmtpConfig: true }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void later.tasks.push(task),
}));
vi.mock("@/shared/lib/i18n-navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

const SLOW_MAIL_MS = 1500;

beforeEach(() => {
  later.tasks.length = 0;
  sendMail.mockReset();
  sendMail.mockImplementation(() => new Promise((done) => setTimeout(done, SLOW_MAIL_MS, {})));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function post(path: string, body: unknown) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: { origin: BASE_URL, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function timed(path: string, body: unknown) {
  const start = Date.now();
  const answer = await post(path, body);

  return { elapsed: Date.now() - start, answer };
}

async function account(email: string, verified: boolean) {
  const { user: created } = await auth.api.signUpEmail({ body: { name: "Mail Person", email, password: "correct-horse-battery" } });
  await testDb.update(user).set({ emailVerified: verified }).where(eq(user.id, created.id));
  // Signing up queued its own mail: it is not what these tests are about
  later.tasks.length = 0;
  sendMail.mockClear();
}

async function runLater() {
  await Promise.all(later.tasks.splice(0).map((task) => task()));
}

describe("the verification mail", () => {
  it("is not waited for: an unverified address is answered as fast as an unknown one, with the mail still to go", async () => {
    await account("unverified@example.com", false);
    await account("verified@example.com", true);

    const unverified = await timed("/send-verification-email", { email: "unverified@example.com" });
    const verified = await timed("/send-verification-email", { email: "verified@example.com" });
    const unknown = await timed("/send-verification-email", { email: "nobody@example.com" });

    for (const { answer } of [unverified, verified, unknown]) {
      expect(answer.status).toBe(200);
      expect(await answer.json()).toEqual({ status: true });
    }
    // All three wait for the floor of Better Auth and nothing more: the 1.5 s of the mail is not in the answer
    for (const { elapsed } of [unverified, verified, unknown]) {
      expect(elapsed).toBeLessThan(SLOW_MAIL_MS - 300);
    }
    expect(Math.abs(unverified.elapsed - unknown.elapsed)).toBeLessThan(250);

    // The mail was handed to `after`, and goes when the answer has
    expect(sendMail).not.toHaveBeenCalled();
    expect(later.tasks).toHaveLength(1);
    await runLater();
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({ to: "unverified@example.com" });
  });

  it("does not fail the request when the mail cannot be sent", async () => {
    await account("unverified@example.com", false);
    sendMail.mockRejectedValue(new Error("SMTP is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { answer } = await timed("/send-verification-email", { email: "unverified@example.com" });
    await expect(runLater()).resolves.toBeUndefined();

    expect(answer.status).toBe(200);
  });
});

describe("the password reset mail", () => {
  it("is not waited for, and an address that has no account is answered the same way, just as fast", async () => {
    await account("known@example.com", true);

    const known = await timed("/request-password-reset", { email: "known@example.com", redirectTo: "/reset-password" });
    const unknown = await timed("/request-password-reset", { email: "nobody@example.com", redirectTo: "/reset-password" });

    expect(known.answer.status).toBe(200);
    expect(await known.answer.json()).toEqual(await unknown.answer.json());
    expect(known.elapsed).toBeLessThan(SLOW_MAIL_MS - 300);
    expect(unknown.elapsed).toBeLessThan(SLOW_MAIL_MS - 300);
    expect(sendMail).not.toHaveBeenCalled();
    expect(later.tasks).toHaveLength(1);

    await runLater();
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({ to: "known@example.com", subject: "Reset your password" });
  });
});

describe("the sign-up mail", () => {
  it("is not waited for", async () => {
    const { elapsed, answer } = await timed("/sign-up/email", { name: "New Person", email: "new-person@example.com", password: "correct-horse-battery" });

    expect(answer.status).toBe(200);
    expect(elapsed).toBeLessThan(SLOW_MAIL_MS - 300);
    expect(sendMail).not.toHaveBeenCalled();
    await runLater();
    expect(sendMail).toHaveBeenCalledOnce();
  });
});
