import type { InviteDeps } from "@/features/waitlist/invite-flow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inviteFlow } from "@/features/waitlist/invite-flow";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// What the button that invites someone from the waiting list does with the answer
// of the server, as a plain function: a server that refuses or does not answer is
// an outcome here, and a test calls it with the server it wants (the interface
// cannot, in Node: it has no DOM to click in).

afterEach(() => {
  vi.unstubAllGlobals();
});

const done = { success: true, data: { success: true } } as const;
const refused = { success: false, error: "Failed" } as const;

/** What the error reporter of the page is told. */
function reporter() {
  const report = vi.fn();
  vi.stubGlobal("reportError", report);
  return report;
}

/** The flow's hands, with a server that answers as given, and what they were asked to do, in order. */
function setup(invite: InviteDeps["invite"], overrides: Partial<InviteDeps> = {}) {
  const calls: string[] = [];
  const server = vi.fn(invite);
  const deps: InviteDeps = {
    invite: server,
    pending: (entryId) => calls.push(`pending:${entryId}`),
    invited: (entryId) => calls.push(`invited:${entryId}`),
    refresh: () => calls.push("refresh"),
    failed: () => calls.push("failed"),
    ...overrides,
  };

  return { calls, server, deps };
}

describe("inviteFlow", () => {
  it("invites the entry, shows it invited, reads the page again so that the cards follow, and ends the wait last", async () => {
    const { calls, server, deps } = setup(async () => done);

    const result = await inviteFlow(deps, "e1");

    expect(result).toBe(true);
    expect(server).toHaveBeenCalledExactlyOnceWith({ entryId: "e1" });
    expect(calls).toEqual(["pending:e1", "invited:e1", "refresh", "pending:null"]);
  });

  it("says so when the server refuses: nothing is shown invited, the page is not read again, and the wait ends", async () => {
    const { calls, deps } = setup(async () => refused);

    const result = await inviteFlow(deps, "e1");

    expect(result).toBe(false);
    expect(calls).toEqual(["pending:e1", "failed", "pending:null"]);
  });

  it("says so when the server does not answer, tells the error reporter, and ends the wait", async () => {
    const report = reporter();
    const failure = new Error("network");
    const { calls, deps } = setup(async () => {
      throw failure;
    });

    const result = await inviteFlow(deps, "e1");

    expect(result).toBe(false);
    expect(calls).toEqual(["pending:e1", "failed", "pending:null"]);
    expect(report).toHaveBeenCalledExactlyOnceWith(failure);
  });

  // The button waits for the server: it must stop waiting whatever happens, a toast that throws included
  it("ends the wait in a `finally`: even when saying so fails", async () => {
    const calls: string[] = [];
    const { deps } = setup(async () => refused, {
      pending: (entryId) => calls.push(`pending:${entryId}`),
      failed: () => {
        throw new Error("the toast broke");
      },
    });

    await expect(inviteFlow(deps, "e1")).rejects.toThrow("the toast broke");
    expect(calls).toEqual(["pending:e1", "pending:null"]);
  });

  it("does not show the entry invited before the server has said so", async () => {
    let answer: (value: typeof done) => void = () => {};
    const { calls, deps } = setup(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );

    const running = inviteFlow(deps, "e1");
    await Promise.resolve();

    expect(calls).toEqual(["pending:e1"]);
    answer(done);
    await running;
    expect(calls).toEqual(["pending:e1", "invited:e1", "refresh", "pending:null"]);
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone, the role is too low). A flow that took one for a refusal would tell "the invitation could not be sent" to a
// person who is on their way to the sign-in page, and report it.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  it("is handed on, never taken for a refusal: nothing is told or reported, and the button still stops waiting", async () => {
    const report = reporter();
    const { calls, deps } = setup(async () => {
      throw framework;
    });

    expect(await outcomeOf(inviteFlow(deps, "e1"))).toBe(framework);
    expect(calls).toEqual(["pending:e1", "pending:null"]);
    expect(report).not.toHaveBeenCalled();
  });
});
