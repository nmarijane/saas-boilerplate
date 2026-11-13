import { describe, expect, it, vi } from "vitest";
import { sendInvites } from "@/features/onboarding/send-invites";
import { FRAMEWORK_ERRORS } from "../../helpers/next-errors";

/**
 * What the invite step of onboarding does with the rows it was filled in. The
 * server is a stand-in that says yes, says no (`{ success: false }`, how every
 * refusal of an action comes back) or does not answer. A refusal is not a
 * success: the row stays, the person is told, and nothing is said to have gone
 * that did not.
 */

const ORG = "org_1";
const ok = { success: true as const, data: {} };
const refusal = { success: false as const, error: "Failed to invite member" };

function run(rows: { email: string; role: "admin" | "member" }[], invite = vi.fn().mockResolvedValue(ok)) {
  return { invite, done: sendInvites({ invite }, { orgId: ORG, locale: "fr", rows }) };
}

describe("sending the invitations of the onboarding", () => {
  it("sends each filled row with its role and the language of the page, and keeps none when all go", async () => {
    const { invite, done } = run([
      { email: "ada@example.com", role: "admin" },
      { email: " bob@example.com ", role: "member" },
    ]);

    expect(await done).toEqual({ sent: 2, kept: [], problem: null });
    expect(invite).toHaveBeenCalledTimes(2);
    expect(invite).toHaveBeenCalledWith({ orgId: ORG, email: "ada@example.com", role: "admin", locale: "fr" });
    // The address is sent trimmed
    expect(invite).toHaveBeenCalledWith({ orgId: ORG, email: "bob@example.com", role: "member", locale: "fr" });
  });

  it("leaves out the empty rows: nothing was asked of them", async () => {
    const { invite, done } = run([
      { email: "", role: "member" },
      { email: "   ", role: "member" },
    ]);

    expect(await done).toEqual({ sent: 0, kept: [], problem: null });
    expect(invite).not.toHaveBeenCalled();
  });

  it("keeps the row the server refused, as it was typed, and says it failed: nothing is a success that was not", async () => {
    const invite = vi.fn().mockResolvedValue(refusal);
    const rows = [{ email: "ada@example.com", role: "admin" as const }];

    expect(await run(rows, invite).done).toEqual({ sent: 0, kept: rows, problem: "failed" });
  });

  it("keeps the row of a call that fails outright, and says it failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const invite = vi.fn().mockRejectedValue(new Error("network down"));
    const rows = [{ email: "ada@example.com", role: "member" as const }];

    expect(await run(rows, invite).done).toEqual({ sent: 0, kept: rows, problem: "failed" });
  });

  it("removes the rows that went and keeps the ones that did not, in their order", async () => {
    const invite = vi.fn(async ({ email }: { email: string }) => (email.startsWith("no") ? refusal : ok));
    const rows = [
      { email: "no-1@example.com", role: "member" as const },
      { email: "yes@example.com", role: "admin" as const },
      { email: "no-2@example.com", role: "admin" as const },
    ];

    const result = await run(rows, invite as never).done;

    expect(result.sent).toBe(1);
    expect(result.kept).toEqual([rows[0], rows[2]]);
    expect(result.problem).toBe("failed");
  });

  it("keeps a filled row that is no address, never sends it, and says the address is the matter", async () => {
    const { invite, done } = run([
      { email: "not-an-address", role: "member" },
      { email: "ada@example.com", role: "member" },
    ]);

    const result = await done;

    expect(result).toEqual({ sent: 1, kept: [{ email: "not-an-address", role: "member" }], problem: "invalid" });
    expect(invite).toHaveBeenCalledTimes(1);
    expect(invite).not.toHaveBeenCalledWith(expect.objectContaining({ email: "not-an-address" }));
  });

  it("tells the failure of the server before an address that is none: the person can do nothing about the first", async () => {
    const invite = vi.fn().mockResolvedValue(refusal);
    const result = await run(
      [
        { email: "bad", role: "member" },
        { email: "ada@example.com", role: "member" },
      ],
      invite,
    ).done;

    expect(result.problem).toBe("failed");
    expect(result.kept).toHaveLength(2);
  });

  // A redirect (the session is gone) or a not found is Next's way of sending the person elsewhere
  it.each(FRAMEWORK_ERRORS)("hands on %s, and does not take it for a refusal", async (_, error) => {
    const invite = vi.fn().mockRejectedValue(error);

    await expect(run([{ email: "ada@example.com", role: "member" }], invite).done).rejects.toBe(error);
  });
});
