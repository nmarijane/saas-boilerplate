import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePasswordFlow,
  linkProviderFlow,
  revokeOtherSessionsFlow,
  revokeSessionFlow,
  unlinkAccountFlow,
} from "@/features/settings/account-flows";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// What the cards of the account page ask of the auth client, as plain functions
// given the client: here the client is a fake that holds every call the cards
// could make, so that a test says which one was made, and with what. The cards are
// the thin part that gives them the real client (the stories of the cards give
// them a fake one and press the buttons).

const reported = vi.fn();

const ANSWERED = { data: { status: true }, error: null };
const REFUSED = {
  data: null,
  error: { message: "Unauthorized", status: 401, statusText: "Unauthorized" },
};

/** A client with every call of the cards, and one more that no card may make: `revokeSessions` ends the session in use too. */
function fakeClient() {
  return {
    revokeSession: vi.fn().mockResolvedValue(ANSWERED),
    revokeOtherSessions: vi.fn().mockResolvedValue(ANSWERED),
    revokeSessions: vi.fn().mockResolvedValue(ANSWERED),
    linkSocial: vi.fn().mockResolvedValue(ANSWERED),
    unlinkAccount: vi.fn().mockResolvedValue(ANSWERED),
    changePassword: vi.fn().mockResolvedValue(ANSWERED),
  };
}

type Client = ReturnType<typeof fakeClient>;

/** The names of the calls that were made, whatever the arguments. */
function made(client: Client): string[] {
  return Object.entries(client)
    .filter(([, call]) => call.mock.calls.length > 0)
    .map(([name]) => name);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("reportError", reported);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("revoking the other sessions", () => {
  // The old card called `revokeSessions()`, which ends every session of the person,
  // the one in use included, while it told the person that this one was kept.
  it("asks for the other sessions to be revoked, and never for all of them: the one in use stays", async () => {
    const client = fakeClient();

    await expect(revokeOtherSessionsFlow(client)).resolves.toBe(true);

    expect(client.revokeOtherSessions).toHaveBeenCalledExactlyOnceWith();
    expect(client.revokeSessions).not.toHaveBeenCalled();
    expect(made(client)).toEqual(["revokeOtherSessions"]);
  });

  it("says no when the server refuses, and calls nothing else to make up for it", async () => {
    const client = fakeClient();
    client.revokeOtherSessions.mockResolvedValue(REFUSED);

    await expect(revokeOtherSessionsFlow(client)).resolves.toBe(false);

    expect(made(client)).toEqual(["revokeOtherSessions"]);
  });

  it("says no, and tells the error reporter, when the call fails outright", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.revokeOtherSessions.mockRejectedValue(offline);

    await expect(revokeOtherSessionsFlow(client)).resolves.toBe(false);

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });
});

describe("revoking one session", () => {
  it("asks for that session, by its token, and for nothing else", async () => {
    const client = fakeClient();

    await expect(revokeSessionFlow(client, "tok-phone")).resolves.toBe(true);

    expect(client.revokeSession).toHaveBeenCalledExactlyOnceWith({ token: "tok-phone" });
    expect(made(client)).toEqual(["revokeSession"]);
  });

  it("says no when the server refuses", async () => {
    const client = fakeClient();
    client.revokeSession.mockResolvedValue(REFUSED);

    await expect(revokeSessionFlow(client, "tok-phone")).resolves.toBe(false);

    expect(reported).not.toHaveBeenCalled();
  });

  it("says no, and tells the error reporter, when the call fails outright", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.revokeSession.mockRejectedValue(offline);

    await expect(revokeSessionFlow(client, "tok-phone")).resolves.toBe(false);

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });
});

describe("linking an account", () => {
  // The provider brings the person back to the page that holds the card: the account
  // page, now that /settings/profile only redirects to it.
  it("asks for the provider the person chose, and for the account page to be where they come back to", async () => {
    const client = fakeClient();

    await expect(linkProviderFlow(client, "github")).resolves.toBe(true);

    expect(client.linkSocial).toHaveBeenCalledExactlyOnceWith({
      provider: "github",
      callbackURL: "/settings/account",
    });
    expect(made(client)).toEqual(["linkSocial"]);
  });

  it("says no when the server refuses", async () => {
    const client = fakeClient();
    client.linkSocial.mockResolvedValue(REFUSED);

    await expect(linkProviderFlow(client, "google")).resolves.toBe(false);

    expect(reported).not.toHaveBeenCalled();
  });

  it("says no, and tells the error reporter, when the call fails outright", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.linkSocial.mockRejectedValue(offline);

    await expect(linkProviderFlow(client, "google")).resolves.toBe(false);

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });
});

describe("unlinking an account", () => {
  // Better Auth unlinks by the id of the account record: a provider name finds nothing.
  it("asks for that account, by its own id", async () => {
    const client = fakeClient();

    await expect(unlinkAccountFlow(client, "acc-2")).resolves.toBe(true);

    expect(client.unlinkAccount).toHaveBeenCalledExactlyOnceWith({ accountId: "acc-2" });
    expect(made(client)).toEqual(["unlinkAccount"]);
  });

  it("says no when the server refuses", async () => {
    const client = fakeClient();
    client.unlinkAccount.mockResolvedValue(REFUSED);

    await expect(unlinkAccountFlow(client, "acc-2")).resolves.toBe(false);

    expect(reported).not.toHaveBeenCalled();
  });

  it("says no, and tells the error reporter, when the call fails outright", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.unlinkAccount.mockRejectedValue(offline);

    await expect(unlinkAccountFlow(client, "acc-2")).resolves.toBe(false);

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });
});

describe("changing the password", () => {
  // The reason to change a password is often that someone else may have it: the
  // sessions that were opened with the old one must not outlive it
  it("sends the current password and the new one, and asks for the other sessions to end, and nothing else", async () => {
    const client = fakeClient();
    // What the form holds besides: the confirmation is no business of the server
    const held = { currentPassword: "old-Secret-1", newPassword: "New-Secret-123!", confirm: "New-Secret-123!" };

    await expect(changePasswordFlow(client, held)).resolves.toBe(true);

    expect(client.changePassword).toHaveBeenCalledExactlyOnceWith({
      currentPassword: "old-Secret-1",
      newPassword: "New-Secret-123!",
      revokeOtherSessions: true,
    });
    expect(made(client)).toEqual(["changePassword"]);
  });

  it("says no when the server refuses, a wrong current password for one: that is the person's to fix, not an error of the app", async () => {
    const client = fakeClient();
    client.changePassword.mockResolvedValue(REFUSED);

    await expect(
      changePasswordFlow(client, { currentPassword: "wrong", newPassword: "New-Secret-123!" }),
    ).resolves.toBe(false);

    expect(reported).not.toHaveBeenCalled();
  });

  it("says no, and tells the error reporter, when the call fails outright", async () => {
    const client = fakeClient();
    const offline = new Error("offline");
    client.changePassword.mockRejectedValue(offline);

    await expect(
      changePasswordFlow(client, { currentPassword: "old-Secret-1", newPassword: "New-Secret-123!" }),
    ).resolves.toBe(false);

    expect(reported).toHaveBeenCalledExactlyOnceWith(offline);
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere: the helper that
// every card of the account page goes through must not turn one into "no", which the card tells as a refusal.
describe.each(FRAMEWORK_ERRORS)("%s from a call", (_, framework) => {
  it("is handed on by every flow of the account page, and not reported", async () => {
    const reject = vi.fn().mockRejectedValue(framework);
    const client = { ...fakeClient(), revokeSession: reject, revokeOtherSessions: reject, linkSocial: reject, unlinkAccount: reject, changePassword: reject };

    for (const flow of [
      revokeSessionFlow(client, "token"),
      revokeOtherSessionsFlow(client),
      linkProviderFlow(client, "github"),
      unlinkAccountFlow(client, "acc_1"),
      changePasswordFlow(client, { currentPassword: "a", newPassword: "b" }),
    ]) {
      expect(await outcomeOf(flow)).toBe(framework);
    }
    expect(reported).not.toHaveBeenCalled();
  });
});
