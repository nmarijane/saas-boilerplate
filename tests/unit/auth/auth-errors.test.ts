import { describe, expect, it } from "vitest";
import { AUTH_ERROR_KEYS, authErrorKey, oauthErrorKey } from "@/features/auth/auth-errors";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";

// What the sign-in pages tell a person when the auth server refuses: a message
// in the language of the page, chosen by the code of the error. The sentence of
// the server (English, and meant for a developer) is never shown.

interface Messages {
  [key: string]: string | Messages;
}

/** The message at a full key ("auth.errors.invalidToken"), or undefined when there is none. */
function lookup(messages: Messages, key: string): string | undefined {
  let found: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    found = typeof found === "object" ? found[part] : undefined;
  }

  return typeof found === "string" ? found : undefined;
}

describe("the message told for an error code of the auth server", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", "auth.errors.invalidCredentials"],
    ["EMAIL_NOT_VERIFIED", "auth.errors.emailNotVerified"],
    ["USER_ALREADY_EXISTS", "auth.errors.userAlreadyExists"],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "auth.errors.userAlreadyExists"],
    ["INVALID_EMAIL", "auth.errors.invalidEmail"],
    ["INVALID_TOKEN", "auth.errors.invalidToken"],
    ["PASSWORD_TOO_SHORT", "auth.errors.passwordTooShort"],
    ["PASSWORD_TOO_LONG", "auth.errors.passwordTooLong"],
    ["ACCESS_DENIED", "auth.errors.accessDenied"],
  ])("tells %s with %s", (code, key) => {
    expect(authErrorKey({ code })).toBe(key);
  });

  it("covers exactly the nine codes the forms can meet", () => {
    expect(Object.keys(AUTH_ERROR_KEYS).sort()).toEqual([
      "ACCESS_DENIED",
      "EMAIL_NOT_VERIFIED",
      "INVALID_EMAIL",
      "INVALID_EMAIL_OR_PASSWORD",
      "INVALID_TOKEN",
      "PASSWORD_TOO_LONG",
      "PASSWORD_TOO_SHORT",
      "USER_ALREADY_EXISTS",
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    ]);
  });

  it("tells any other code, a missing one and no error at all with the generic error", () => {
    expect(authErrorKey({ code: "FAILED_TO_CREATE_USER" })).toBe("common.error");
    expect(authErrorKey({ code: "" })).toBe("common.error");
    expect(authErrorKey({})).toBe("common.error");
    expect(authErrorKey(null)).toBe("common.error");
    expect(authErrorKey(undefined)).toBe("common.error");
  });

  it("never carries the sentence of the server, whatever the code", () => {
    const answer = { code: "SOMETHING_NEW", message: "The server says boom" };

    expect(authErrorKey(answer)).toBe("common.error");
    expect(authErrorKey({ ...answer, code: "INVALID_TOKEN" })).toBe("auth.errors.invalidToken");
  });

  // The limiter of Better Auth answers 429 with a message and no code, and the limit of the
  // proxy (src/proxy.ts) answers 429 with a code the table does not know: it is the status
  // that says it
  it.each([
    ["the limiter of Better Auth, which tells no code", { status: 429, message: "Too many requests. Please try again later." }],
    ["the limit of the proxy, whose code is not in the table", { status: 429, code: "RATE_LIMIT" }],
  ])("tells a refusal for too many requests, from %s, to wait a moment", (_source, error) => {
    expect(authErrorKey(error)).toBe("auth.errors.tooManyAttempts");
  });

  it("does not take any other status for a rate limit", () => {
    for (const status of [400, 401, 403, 404, 422, 500, 502, 503]) {
      expect(authErrorKey({ status }), String(status)).toBe("common.error");
    }
  });

  it("still tells a refusal by its code first, when it has one the table knows", () => {
    expect(authErrorKey({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("auth.errors.invalidCredentials");
    expect(authErrorKey({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toBe("auth.errors.emailNotVerified");
  });

  // A code is looked up in a table, and every object has properties of its own
  // (`constructor`, `toString`...) that must not pass for a message.
  it.each(["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"])(
    "does not mistake %s for a code",
    (code) => {
      expect(authErrorKey({ code })).toBe("common.error");
    },
  );

  it("has words for every message it can tell, in both languages", () => {
    const keys = [...new Set([...Object.values(AUTH_ERROR_KEYS), "common.error", "auth.errors.tooManyAttempts"])];

    expect(keys.length).toBeGreaterThan(1);
    for (const [locale, messages] of Object.entries({ en, fr })) {
      const missing = keys.filter((key) => !lookup(messages as Messages, key)?.trim());

      expect(missing, `${locale}.json lacks messages the auth errors tell`).toEqual([]);
    }
  });
});

// A provider that the person cancels or that refuses brings them back to the
// sign-in page with `?error=<code>`, in the case the provider wrote it (`access_denied`).
// The code comes from the address bar: it is looked up in the same table, never shown.
describe("the message told for the error that a provider brings the person back with", () => {
  it("tells a cancelled sign-in, whatever the case of the code", () => {
    expect(oauthErrorKey("access_denied")).toBe("auth.errors.accessDenied");
    expect(oauthErrorKey("ACCESS_DENIED")).toBe("auth.errors.accessDenied");
  });

  it.each(["unable_to_get_user_info", "state_mismatch", "email_not_found", "who knows", "<script>alert(1)</script>"])(
    "tells any other code, %j, with the generic error: never the code itself",
    (code) => {
      expect(oauthErrorKey(code)).toBe("common.error");
    },
  );

  it("tells nothing when there is no error", () => {
    expect(oauthErrorKey(undefined)).toBeNull();
    expect(oauthErrorKey("")).toBeNull();
  });

  it("takes the first of an error that the address repeats", () => {
    expect(oauthErrorKey(["access_denied", "other"])).toBe("auth.errors.accessDenied");
  });

  it.each(["constructor", "__proto__", "toString"])("does not mistake %s for a code", (code) => {
    expect(oauthErrorKey(code)).toBe("common.error");
  });
});
