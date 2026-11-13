import { describe, expect, it, vi } from "vitest";
import { answerInvitation } from "@/features/auth/organization/invitation-flows";
import { invitationView } from "@/features/auth/organization/invitation-view";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

const ok = { success: true as const, data: undefined };
const refused = { success: false as const, error: "Failed to accept the invitation" };

type Answer = Parameters<typeof answerInvitation>[0]["accept"];

function deps(answers: { accept?: Answer; decline?: Answer } = {}) {
  return {
    accept: answers.accept ?? vi.fn().mockResolvedValue(ok),
    decline: answers.decline ?? vi.fn().mockResolvedValue(ok),
    goHome: vi.fn(),
    fail: vi.fn(),
    report: vi.fn(),
  };
}

describe("answering an invitation", () => {
  it("goes to the home once the server has taken the acceptance, and not before", async () => {
    const page = deps();

    expect(await answerInvitation(page, "inv_1", "accept")).toBe("accepted");
    expect(page.accept).toHaveBeenCalledExactlyOnceWith({ invitationId: "inv_1" });
    expect(page.goHome).toHaveBeenCalledOnce();
    expect(page.decline).not.toHaveBeenCalled();
  });

  it("stays on the page once it is declined: the page says so", async () => {
    const page = deps();

    expect(await answerInvitation(page, "inv_1", "decline")).toBe("declined");
    expect(page.decline).toHaveBeenCalledExactlyOnceWith({ invitationId: "inv_1" });
    expect(page.goHome).not.toHaveBeenCalled();
  });

  it("tells a refusal of the server and moves nowhere", async () => {
    const page = deps({ accept: vi.fn().mockResolvedValue(refused), decline: vi.fn().mockResolvedValue(refused) });

    expect(await answerInvitation(page, "inv_1", "accept")).toBe("failed");
    expect(await answerInvitation(page, "inv_1", "decline")).toBe("failed");
    expect(page.fail.mock.calls).toEqual([["accept"], ["decline"]]);
    expect(page.goHome).not.toHaveBeenCalled();
    expect(page.report).not.toHaveBeenCalled();
  });

  it("tells a call that fails outright, and reports it", async () => {
    const offline = new Error("offline");
    const page = deps({ accept: vi.fn().mockRejectedValue(offline) });

    expect(await answerInvitation(page, "inv_1", "accept")).toBe("failed");
    expect(page.report).toHaveBeenCalledExactlyOnceWith(offline);
    expect(page.fail).toHaveBeenCalledExactlyOnceWith("accept");
    expect(page.goHome).not.toHaveBeenCalled();
  });
});

describe("what the page of an invitation shows", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const pending = {
    id: "inv_1",
    email: "lea@example.com",
    role: "member",
    status: "pending",
    expiresAt: new Date("2026-11-12T12:00:00Z"),
    workspaceName: "Acme",
    inviterName: "Camille Laurent",
  };

  it("is a dead link for anyone when there is no invitation, or it is answered, cancelled or out of date", () => {
    for (const viewer of [null, { email: "lea@example.com" }]) {
      expect(invitationView(null, viewer, now)).toEqual({ kind: "dead" });
      for (const status of ["accepted", "rejected", "canceled"]) {
        expect(invitationView({ ...pending, status }, viewer, now), status).toEqual({ kind: "dead" });
      }
      expect(invitationView({ ...pending, expiresAt: now }, viewer, now)).toEqual({ kind: "dead" });
    }
  });

  it("tells a visitor nothing of the workspace or the address", () => {
    expect(invitationView(pending, null, now)).toEqual({ kind: "signedOut" });
  });

  it("names the invited address to a person signed in with another, and nothing of the workspace", () => {
    expect(invitationView(pending, { email: "tom@example.com" }, now)).toEqual({
      kind: "otherAccount",
      invitedEmail: "lea@example.com",
      currentEmail: "tom@example.com",
    });
  });

  it("gives the invited person the workspace, the inviter and the role, whatever the case of the address", () => {
    const view = { kind: "invited", invitationId: "inv_1", workspaceName: "Acme", inviterName: "Camille Laurent", role: "member" };

    expect(invitationView(pending, { email: "lea@example.com" }, now)).toEqual(view);
    expect(invitationView(pending, { email: "Lea@Example.com" }, now)).toEqual(view);
    expect(invitationView({ ...pending, role: "admin" }, { email: "lea@example.com" }, now)).toEqual({ ...view, role: "admin" });
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone): the page of an invitation must not tell "your answer was not taken" to a person who is on their way to sign in.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  it.each(["accept", "decline"] as const)("is handed on when the person chooses to %s: nothing is told, reported or followed", async (choice) => {
    const reject = vi.fn().mockRejectedValue(framework);
    const page = deps({ accept: reject, decline: reject });

    expect(await outcomeOf(answerInvitation(page, "inv_1", choice))).toBe(framework);
    expect(page.fail).not.toHaveBeenCalled();
    expect(page.report).not.toHaveBeenCalled();
    expect(page.goHome).not.toHaveBeenCalled();
  });
});
