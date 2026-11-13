import { describe, expect, it } from "vitest";
import { signOutAndLeave } from "@/features/auth/sign-out";

describe("signOutAndLeave", () => {
  it("signs out, then goes to the sign-in page and refreshes", async () => {
    const calls: string[] = [];

    await signOutAndLeave({
      signOut: async () => {
        calls.push("signOut");
      },
      push: (href) => calls.push(`push:${href}`),
      refresh: () => calls.push("refresh"),
    });

    expect(calls).toEqual(["signOut", "push:/sign-in", "refresh"]);
  });

  it("waits for the session to end before it goes anywhere", async () => {
    const calls: string[] = [];
    let ended: () => void = () => {};
    const done = signOutAndLeave({
      signOut: () =>
        new Promise<void>((resolve) => {
          calls.push("signOut");
          ended = resolve;
        }),
      push: (href) => calls.push(`push:${href}`),
      refresh: () => calls.push("refresh"),
    });

    await Promise.resolve();
    expect(calls).toEqual(["signOut"]);

    ended();
    await done;
    expect(calls).toEqual(["signOut", "push:/sign-in", "refresh"]);
  });

  it("sends no one to the sign-in page when the session did not end, and says why", async () => {
    const calls: string[] = [];

    // Still signed in: the sign-in page would send them straight back.
    await expect(
      signOutAndLeave({
        signOut: async () => {
          calls.push("signOut");
          throw new Error("Failed to fetch");
        },
        push: (href) => calls.push(`push:${href}`),
        refresh: () => calls.push("refresh"),
      }),
    ).rejects.toThrow("Failed to fetch");

    expect(calls).toEqual(["signOut"]);
  });
});
