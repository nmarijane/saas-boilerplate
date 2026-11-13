import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestPasswordResetFlow,
  resetPasswordFlow,
  signInFlow,
  signUpFlow,
  socialSignInFlow,
} from "@/features/auth/auth-flows";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// What the sign-in pages ask of the auth client, as plain functions that are
// given the client: here it is a fake that holds every call the forms could
// make, so that a test says which one was made, and with what. The forms are the
// thin part that gives them the client of the app (a story gives them a fake
// one, and presses the buttons). The navigation of next-intl is replaced (no Next router
// runs in a test): a stand-in builds a path the way it does, with the locale in front.
vi.mock("@/shared/lib/i18n-navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

const reported = vi.fn();

const ANSWERED = { data: { status: true }, error: null };

/** How the request for the link of an address goes: without the cookies of the browser, whose session is not the person's. */
const WITHOUT_SESSION = { fetchOptions: { credentials: "omit" } };

/** What Better Auth answers when it refuses: a code to tell it by, and a sentence in English for a developer. */
function refused(code: string | undefined, message = "A sentence of the server") {
  return {
    data: null,
    error: { code, message, status: 400, statusText: "Bad Request" },
  };
}

/** A client with every call of the forms, and the one that no flow of the reset may make: signing in. */
function fakeClient() {
  return {
    signIn: { email: vi.fn().mockResolvedValue(ANSWERED), social: vi.fn().mockResolvedValue(ANSWERED) },
    sendVerificationEmail: vi.fn().mockResolvedValue(ANSWERED),
    signUp: { email: vi.fn().mockResolvedValue(ANSWERED) },
    requestPasswordReset: vi.fn().mockResolvedValue(ANSWERED),
    resetPassword: vi.fn().mockResolvedValue(ANSWERED),
  };
}

type Client = ReturnType<typeof fakeClient>;

/** The names of the calls that were made, whatever the arguments. */
function made(client: Client): string[] {
  const calls: [string, ReturnType<typeof vi.fn>][] = [
    ["signIn.email", client.signIn.email],
    ["signIn.social", client.signIn.social],
    ["sendVerificationEmail", client.sendVerificationEmail],
    ["signUp.email", client.signUp.email],
    ["requestPasswordReset", client.requestPasswordReset],
    ["resetPassword", client.resetPassword],
  ];

  return calls.filter(([, call]) => call.mock.calls.length > 0).map(([name]) => name);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("reportError", reported);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signing in", () => {
  it("asks for the email and the password, and for nothing else", async () => {
    const client = fakeClient();

    await expect(signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" })).resolves.toEqual({ ok: true });

    expect(client.signIn.email).toHaveBeenCalledExactlyOnceWith({
      email: "camille@example.com",
      password: "Secret-123!",
    });
    expect(made(client)).toEqual(["signIn.email"]);
  });

  it("tells a wrong password with the message of the locale, chosen by its code", async () => {
    const client = fakeClient();
    client.signIn.email.mockResolvedValue(refused("INVALID_EMAIL_OR_PASSWORD", "Invalid email or password"));

    await expect(signInFlow(client, { email: "camille@example.com", password: "nope", locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "auth.errors.invalidCredentials",
    });
  });

  it("tells an email that is not verified yet by its own code", async () => {
    const client = fakeClient();
    client.signIn.email.mockResolvedValue(refused("EMAIL_NOT_VERIFIED"));

    await expect(signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "auth.errors.emailNotVerified",
    });
  });

  // The server refuses with that code only when the password was the right one. Sending the
  // link is the form's job (the server's own sends it with no way back: `sendOnSignIn` is off),
  // so that the link comes back to the verify page of the language of the form, and to the page
  // that sent the person here
  describe("when the address is not verified yet", () => {
    const notVerified = () => {
      const client = fakeClient();
      client.signIn.email.mockResolvedValue(refused("EMAIL_NOT_VERIFIED"));

      return client;
    };

    it.each([
      ["en", "/en/verify-email?verified=1"],
      ["fr", "/fr/verify-email?verified=1"],
    ])("sends the link itself, back to the verify page of the language of the form: %s", async (locale, callbackURL) => {
      const client = notVerified();

      await signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale });

      expect(client.sendVerificationEmail).toHaveBeenCalledExactlyOnceWith({ email: "camille@example.com", callbackURL, ...WITHOUT_SESSION });
      expect(made(client)).toEqual(["signIn.email", "sendVerificationEmail"]);
    });

    // A browser that still holds the session of another person sends it with every request of its
    // own address, and the server refuses a request for the link of an address that is not the one of
    // the session. The person who signs in is not that session: the request goes without it
    it("asks for the link without the session the browser holds, so that the session of another person cannot refuse it", async () => {
      const client = notVerified();

      await signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" });

      expect(client.sendVerificationEmail.mock.calls[0]?.[0]).toMatchObject({ fetchOptions: { credentials: "omit" } });
      // Only that call: signing in is the one that is the person's, with what the browser holds
      expect(client.signIn.email.mock.calls[0]?.[0]).not.toHaveProperty("fetchOptions");
    });

    it("carries the page that sent the person here with the link, as sign-up does: signing in comes back to it", async () => {
      const client = notVerified();

      await signInFlow(client, {
        email: "lea@example.com",
        password: "Secret-123!",
        locale: "fr",
        callbackUrl: "/fr/accept-invitation/inv_1",
      });

      expect(client.sendVerificationEmail).toHaveBeenCalledExactlyOnceWith({
        email: "lea@example.com",
        callbackURL: "/fr/verify-email?verified=1&callbackUrl=%2Ffr%2Faccept-invitation%2Finv_1",
        ...WITHOUT_SESSION,
      });
    });

    it("asks for the same address as sign-up does for the same page to come back to", async () => {
      const signUp = fakeClient();
      const signIn = notVerified();
      const callbackUrl = "/en/accept-invitation/inv_9?x=1";

      await signUpFlow(signUp, { name: "Léa", email: "lea@example.com", password: "Secret-123!", locale: "en", callbackUrl });
      await signInFlow(signIn, { email: "lea@example.com", password: "Secret-123!", locale: "en", callbackUrl });

      const [{ callbackURL: fromSignUp }] = signUp.signUp.email.mock.calls[0] as [{ callbackURL: string }];
      const [{ callbackURL: fromSignIn }] = signIn.sendVerificationEmail.mock.calls[0] as [{ callbackURL: string }];
      expect(fromSignIn).toBe(fromSignUp);
    });

    it("drops a page to come back to that is not a path of the app, and sends the link bare", async () => {
      for (const callbackUrl of ["https://evil.example/phish", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
        const client = notVerified();

        await signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en", callbackUrl });

        expect(client.sendVerificationEmail, callbackUrl).toHaveBeenCalledExactlyOnceWith({
          email: "camille@example.com",
          callbackURL: "/en/verify-email?verified=1",
          ...WITHOUT_SESSION,
        });
      }
    });

    it("still tells the person that the address is not verified, and that a link is on its way", async () => {
      await expect(signInFlow(notVerified(), { email: "camille@example.com", password: "Secret-123!", locale: "en" })).resolves.toEqual({
        ok: false,
        messageKey: "auth.errors.emailNotVerified",
      });
    });

    // Not told that a link is on its way when none was sent
    it("tells why the link did not leave, not that it did, when the server refuses to send it", async () => {
      const client = notVerified();
      client.sendVerificationEmail.mockResolvedValue(refused("VERIFICATION_EMAIL_NOT_ENABLED", "Verification email isn't enabled"));

      const answer = await signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" });

      expect(answer).toEqual({ ok: false, messageKey: "common.error" });
      expect(JSON.stringify(answer)).not.toContain("enabled");
    });

    it("tells a link that could not be sent for too many requests to wait", async () => {
      const client = notVerified();
      client.sendVerificationEmail.mockResolvedValue({ data: null, error: { message: "Too many requests", status: 429 } });

      await expect(signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" })).resolves.toEqual({
        ok: false,
        messageKey: "auth.errors.tooManyAttempts",
      });
    });

    it("tells a send that fails outright with the generic error, and tells the error reporter", async () => {
      const client = notVerified();
      const offline = new Error("offline");
      client.sendVerificationEmail.mockRejectedValue(offline);

      await expect(signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" })).resolves.toEqual({
        ok: false,
        messageKey: "common.error",
      });

      expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
    });
  });

  // Nothing is mailed to whoever does not know the password: the link is asked for after the
  // one refusal that proves it
  it.each([
    ["a wrong password", refused("INVALID_EMAIL_OR_PASSWORD")],
    ["a code it does not know", refused("SOMETHING_NEW")],
    ["a limit", { data: null, error: { status: 429 } }],
  ])("sends no link after %s", async (_what, answer) => {
    const client = fakeClient();
    client.signIn.email.mockResolvedValue(answer);

    await signInFlow(client, { email: "camille@example.com", password: "nope", locale: "en" });

    expect(client.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends no link when the person is let in", async () => {
    const client = fakeClient();

    await signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" });

    expect(client.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("tells a code it does not know, or none, with the generic error, never with the sentence of the server", async () => {
    for (const code of ["SOMETHING_NEW", undefined]) {
      const client = fakeClient();
      client.signIn.email.mockResolvedValue(refused(code, "Boom, in English"));

      const answer = await signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" });

      expect(answer).toEqual({ ok: false, messageKey: "common.error" });
      expect(JSON.stringify(answer)).not.toContain("Boom");
    }
  });

  it("tells a call that fails outright with the generic error, and tells the error reporter", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.signIn.email.mockRejectedValue(offline);

    await expect(signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "common.error",
    });

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });

  it("does not tell the error reporter about a refusal: that is the person's to deal with", async () => {
    const client = fakeClient();
    client.signIn.email.mockResolvedValue(refused("INVALID_EMAIL_OR_PASSWORD"));

    await signInFlow(client, { email: "camille@example.com", password: "nope", locale: "en" });

    expect(reported).not.toHaveBeenCalled();
  });
});

describe("signing in with a provider", () => {
  // The client does not throw when the server refuses: it answers `{ data, error }`,
  // and the flow reads `error` (on an install without the provider's keys, the
  // click answers 404).
  it.each([
    ["en", "/en/dashboard"],
    ["fr", "/fr/dashboard"],
  ])("asks for the provider, and to be brought back to the dashboard of the language of the page: %s", async (locale, callbackURL) => {
    const client = fakeClient();

    await expect(socialSignInFlow(client, { provider: "github", locale })).resolves.toEqual({ ok: true });

    expect(client.signIn.social).toHaveBeenCalledExactlyOnceWith({
      provider: "github",
      callbackURL,
      errorCallbackURL: `/${locale}/sign-in`,
    });
    expect(made(client)).toEqual(["signIn.social"]);
  });

  it("asks for the provider that was pressed, and for nothing else", async () => {
    const client = fakeClient();

    await socialSignInFlow(client, { provider: "google", locale: "en" });

    expect(client.signIn.social).toHaveBeenCalledExactlyOnceWith({
      provider: "google",
      callbackURL: "/en/dashboard",
      errorCallbackURL: "/en/sign-in",
    });
  });

  // A provider that is cancelled or that refuses used to bring the person to a page of Better Auth
  it.each([
    ["en", "/en/sign-in"],
    ["fr", "/fr/sign-in"],
  ])("asks to be brought back to the sign-in page of the language of the page when the provider refuses: %s", async (locale, errorCallbackURL) => {
    const client = fakeClient();

    await socialSignInFlow(client, { provider: "github", locale });

    const [{ errorCallbackURL: asked }] = client.signIn.social.mock.calls[0] as [{ errorCallbackURL: string }];
    expect(asked).toBe(errorCallbackURL);
  });

  it("asks to be brought back to the page that was asked for, in its language, when there is one", async () => {
    const client = fakeClient();

    await socialSignInFlow(client, { provider: "google", locale: "en", callbackUrl: "/fr/projects/abc?tab=members" });

    expect(client.signIn.social).toHaveBeenCalledExactlyOnceWith({
      provider: "google",
      callbackURL: "/fr/projects/abc?tab=members",
      errorCallbackURL: "/en/sign-in",
    });
  });

  it("asks for the dashboard, never for the address, when the page that was asked for is not a path of the app", async () => {
    for (const callbackUrl of ["https://evil.example", "//evil.example", "javascript:alert(1)"]) {
      const client = fakeClient();

      await socialSignInFlow(client, { provider: "google", locale: "fr", callbackUrl });

      const [{ callbackURL }] = client.signIn.social.mock.calls[0] as [{ callbackURL: string }];
      expect(callbackURL).toBe("/fr/dashboard");
    }
  });

  it("does not bring the person back to a path with no language: the return leads through the middleware to find it", async () => {
    const client = fakeClient();

    await socialSignInFlow(client, { provider: "github", locale: "fr" });

    const [{ callbackURL }] = client.signIn.social.mock.calls[0] as [{ callbackURL: string }];
    expect(callbackURL).not.toBe("/dashboard");
    expect(callbackURL.startsWith("/fr/")).toBe(true);
  });

  it("tells a refusal that the client answers without throwing: a provider that is off is a 404 with its own code", async () => {
    const client = fakeClient();
    client.signIn.social.mockResolvedValue(refused("PROVIDER_NOT_FOUND", "Provider not found"));

    const answer = await socialSignInFlow(client, { provider: "github", locale: "en" });

    expect(answer).toEqual({ ok: false, messageKey: "common.error" });
    expect(JSON.stringify(answer)).not.toContain("Provider not found");
  });

  it("tells a refusal that has a code of its own with the message of the locale", async () => {
    const client = fakeClient();
    client.signIn.social.mockResolvedValue(refused("EMAIL_NOT_VERIFIED"));

    await expect(socialSignInFlow(client, { provider: "google", locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "auth.errors.emailNotVerified",
    });
  });

  it("tells a call that fails outright with the generic error, and tells the error reporter", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.signIn.social.mockRejectedValue(offline);

    await expect(socialSignInFlow(client, { provider: "github", locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "common.error",
    });

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });

  it("does not tell the error reporter about a refusal: that is the person's to deal with", async () => {
    const client = fakeClient();
    client.signIn.social.mockResolvedValue(refused("PROVIDER_NOT_FOUND"));

    await socialSignInFlow(client, { provider: "github", locale: "en" });

    expect(reported).not.toHaveBeenCalled();
  });
});

describe("signing up", () => {
  it("asks for the name, the email and the password, and for nothing else", async () => {
    const client = fakeClient();

    await expect(
      signUpFlow(client, { name: "Camille Laurent", email: "camille@example.com", password: "Secret-123!", locale: "en" }),
    ).resolves.toEqual({ ok: true });

    expect(client.signUp.email).toHaveBeenCalledExactlyOnceWith({
      name: "Camille Laurent",
      email: "camille@example.com",
      password: "Secret-123!",
      callbackURL: "/en/verify-email?verified=1",
    });
    expect(made(client)).toEqual(["signUp.email"]);
  });

  it("comes back, once the address is verified and the person signs in, to the page that sent them to sign up", async () => {
    const client = fakeClient();
    await signUpFlow(client, {
      name: "Léa",
      email: "lea@example.com",
      password: "Secret-123!",
      locale: "fr",
      callbackUrl: "/fr/accept-invitation/inv_1",
    });

    const [{ callbackURL: asked }] = client.signUp.email.mock.calls[0] as [{ callbackURL: string }];
    expect(asked).toBe("/fr/verify-email?verified=1&callbackUrl=%2Ffr%2Faccept-invitation%2Finv_1");
  });

  // The person may open the e-mail in a browser that has no memory of the language
  // they signed up in, and every path of the app carries its language
  it.each([
    ["en", "/en/verify-email?verified=1"],
    ["fr", "/fr/verify-email?verified=1"],
  ])("asks for the link of the e-mail to come back to the verify page of the language of the form: %s", async (locale, callbackURL) => {
    const client = fakeClient();

    await signUpFlow(client, { name: "Camille", email: "camille@example.com", password: "Secret-123!", locale });

    const [{ callbackURL: asked }] = client.signUp.email.mock.calls[0] as [{ callbackURL: string }];
    expect(asked).toBe(callbackURL);
  });

  it.each([
    ["USER_ALREADY_EXISTS", "auth.errors.userAlreadyExists"],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "auth.errors.userAlreadyExists"],
    ["INVALID_EMAIL", "auth.errors.invalidEmail"],
    ["PASSWORD_TOO_SHORT", "auth.errors.passwordTooShort"],
    ["PASSWORD_TOO_LONG", "auth.errors.passwordTooLong"],
  ])("tells %s with the message of the locale", async (code, messageKey) => {
    const client = fakeClient();
    client.signUp.email.mockResolvedValue(refused(code));

    await expect(
      signUpFlow(client, { name: "Camille", email: "camille@example.com", password: "Secret-123!", locale: "en" }),
    ).resolves.toEqual({ ok: false, messageKey });
  });

  it("tells a call that fails outright with the generic error, and tells the error reporter", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.signUp.email.mockRejectedValue(offline);

    await expect(
      signUpFlow(client, { name: "Camille", email: "camille@example.com", password: "Secret-123!", locale: "en" }),
    ).resolves.toEqual({ ok: false, messageKey: "common.error" });

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });
});

describe("asking for a link to reset the password", () => {
  // The link of the email leads to the page that takes the new password, in the
  // language the person asked in: they may open it in a browser that has no
  // memory of it, and every path of the app carries its locale.
  it.each([
    ["en", "/en/reset-password"],
    ["fr", "/fr/reset-password"],
  ])("sends the person back to the reset page in %s", async (locale, redirectTo) => {
    const client = fakeClient();

    await expect(requestPasswordResetFlow(client, { email: "camille@example.com", locale })).resolves.toEqual({ ok: true });

    expect(client.requestPasswordReset).toHaveBeenCalledExactlyOnceWith({
      email: "camille@example.com",
      redirectTo,
    });
    expect(made(client)).toEqual(["requestPasswordReset"]);
  });

  it("does not send the person back to the sign-in page, which ignores the token", async () => {
    const client = fakeClient();

    await requestPasswordResetFlow(client, { email: "camille@example.com", locale: "fr" });

    const [{ redirectTo }] = client.requestPasswordReset.mock.calls[0] as [{ redirectTo: string }];
    expect(redirectTo).not.toContain("sign-in");
  });

  it("tells a refusal with the message of the locale, and a call that fails with the generic error", async () => {
    const refusing = fakeClient();
    refusing.requestPasswordReset.mockResolvedValue(refused("INVALID_EMAIL"));
    await expect(requestPasswordResetFlow(refusing, { email: "nope", locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "auth.errors.invalidEmail",
    });

    const offline = new Error("offline");
    const failing = fakeClient();
    failing.requestPasswordReset.mockRejectedValue(offline);
    await expect(requestPasswordResetFlow(failing, { email: "camille@example.com", locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "common.error",
    });
    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });
});

describe("choosing a new password", () => {
  const STRONG = "Secret-123!";

  it("asks for the new password, and for nothing else (the token of the link is the server's): it does not sign the person in", async () => {
    const client = fakeClient();

    await expect(resetPasswordFlow(client, { newPassword: STRONG })).resolves.toEqual({ ok: true });

    expect(client.resetPassword).toHaveBeenCalledExactlyOnceWith({ newPassword: STRONG });
    expect(made(client)).toEqual(["resetPassword"]);
  });

  it("tells a link that expired while the form was open with its own message", async () => {
    const client = fakeClient();
    client.resetPassword.mockResolvedValue(refused("INVALID_TOKEN", "Invalid token"));

    await expect(resetPasswordFlow(client, { newPassword: STRONG })).resolves.toEqual({
      ok: false,
      messageKey: "auth.errors.invalidToken",
    });
  });

  it("tells a code it does not know with the generic error", async () => {
    const client = fakeClient();
    client.resetPassword.mockResolvedValue(refused("USER_NOT_FOUND", "User not found"));

    await expect(resetPasswordFlow(client, { newPassword: STRONG })).resolves.toEqual({
      ok: false,
      messageKey: "common.error",
    });
  });

  it("tells a call that fails outright with the generic error, and tells the error reporter", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.resetPassword.mockRejectedValue(offline);

    await expect(resetPasswordFlow(client, { newPassword: STRONG })).resolves.toEqual({
      ok: false,
      messageKey: "common.error",
    });

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });

  // The rule that sign-up asks of a new password. The form leaves its button off
  // until it passes, and the flow does not take a password that fails it either.
  it.each([
    ["abc", "a password that is short, with no capital, no number and no symbol"],
    ["abcdefgh", "eight lowercase letters"],
    ["Abcdefg1", "everything but a symbol"],
    ["abcdefg1!", "everything but a capital"],
    ["ABCDEFG1!", "everything but a lowercase letter"],
    ["Abcdefgh!", "everything but a number"],
    ["Abc1!", "everything but the length"],
    ["", "nothing at all"],
  ])("does not ask for %j: %s", async (newPassword) => {
    const client = fakeClient();

    await expect(resetPasswordFlow(client, { newPassword })).resolves.toEqual({
      ok: false,
      messageKey: "auth.passwordTooWeak",
    });

    expect(made(client)).toEqual([]);
  });
});


// The limiter of Better Auth, and the limit of the proxy, answer 429. The client reports it with
// its status and a sentence in English, and no code: each flow tells it to wait, in the words of
// the language of the page, where it told the generic error
describe("a refusal for too many requests", () => {
  const limited = {
    data: null,
    error: { message: "Too many requests. Please try again later.", status: 429, statusText: "Too Many Requests" },
  };

  const flows = [
    ["signing in", (client: Client) => signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" }), (client: Client) => client.signIn.email],
    ["signing in with a provider", (client: Client) => socialSignInFlow(client, { provider: "github", locale: "en" }), (client: Client) => client.signIn.social],
    ["signing up", (client: Client) => signUpFlow(client, { name: "Camille", email: "camille@example.com", password: "Secret-123!", locale: "en" }), (client: Client) => client.signUp.email],
    ["asking for a link to reset the password", (client: Client) => requestPasswordResetFlow(client, { email: "camille@example.com", locale: "en" }), (client: Client) => client.requestPasswordReset],
    ["choosing a new password", (client: Client) => resetPasswordFlow(client, { newPassword: "Secret-123!" }), (client: Client) => client.resetPassword],
  ] as const;

  it.each(flows)("is told to wait, not told as an error of the app, when %s", async (_name, run, call) => {
    const client = fakeClient();
    call(client).mockResolvedValue(limited);

    const answer = await run(client);

    expect(answer).toEqual({ ok: false, messageKey: "auth.errors.tooManyAttempts" });
    expect(JSON.stringify(answer)).not.toContain("Too many requests");
  });

  it("is not told to the error reporter: it is not an error of the app", async () => {
    const client = fakeClient();
    client.signIn.email.mockResolvedValue(limited);

    await signInFlow(client, { email: "camille@example.com", password: "Secret-123!", locale: "en" });

    expect(reported).not.toHaveBeenCalled();
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere: the helper that
// every sign-in flow goes through must not tell them as "an error occurred", nor report them.
describe.each(FRAMEWORK_ERRORS)("%s from a call", (_, framework) => {
  it("is handed on by every flow of the sign-in pages, and not reported", async () => {
    const reject = vi.fn().mockRejectedValue(framework);
    const client = {
      signIn: { email: reject, social: reject },
      sendVerificationEmail: reject,
      signUp: { email: reject },
      requestPasswordReset: reject,
      resetPassword: reject,
    };

    for (const flow of [
      signInFlow(client, { email: "a@b.co", password: "x", locale: "en" }),
      socialSignInFlow(client, { provider: "github", locale: "en" }),
      signUpFlow(client, { name: "Ada", email: "a@b.co", password: "x", locale: "en" }),
      requestPasswordResetFlow(client, { email: "a@b.co", locale: "en" }),
      resetPasswordFlow(client, { newPassword: "Secret-123!" }),
    ]) {
      expect(await outcomeOf(flow)).toBe(framework);
    }
    expect(reported).not.toHaveBeenCalled();
  });
});
