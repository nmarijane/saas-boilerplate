import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { joinWaitlist } from "@/features/waitlist/actions";
import { waitlistEntry } from "@/models/waitlist";
import { testDb } from "../setup";

/**
 * Joining the waitlist is open to anyone, and it must not tell whether an address
 * is already on it: a visitor who types somebody's address gets the answer of a
 * new one, with nothing of the entry that is there (its id, a flag).
 */

beforeEach(async () => {
  await testDb.delete(waitlistEntry);
});

describe("joining the waitlist", () => {
  it("answers a new address with its referral code and nothing else", async () => {
    const answer = await joinWaitlist({ email: "new@example.com" });

    expect(answer).toEqual({ success: true, data: { referralCode: expect.any(String) } });
  });

  it("answers a known address the same way: the same fields, and no sign that it was already there", async () => {
    const first = await joinWaitlist({ email: "known@example.com" });
    const again = await joinWaitlist({ email: "known@example.com" });

    expect(first.success && again.success).toBe(true);
    if (first.success && again.success) {
      expect(Object.keys(again.data)).toEqual(Object.keys(first.data));
      expect(Object.keys(again.data)).toEqual(["referralCode"]);
      // The code of the entry that is there: joining twice is the same as joining once
      expect(again.data.referralCode).toBe(first.data.referralCode);
    }
    expect(await testDb.select().from(waitlistEntry)).toHaveLength(1);
  });

  it("never gives away the id of an entry", async () => {
    await joinWaitlist({ email: "id@example.com" });
    const [entry] = await testDb.select().from(waitlistEntry).where(eq(waitlistEntry.email, "id@example.com"));

    const again = await joinWaitlist({ email: "id@example.com" });

    expect(JSON.stringify(again)).not.toContain(entry?.id ?? "no entry");
  });

  it("counts a referral once, for a new address only", async () => {
    const referrer = await joinWaitlist({ email: "referrer@example.com" });
    const code = referrer.success ? referrer.data.referralCode : "";

    await joinWaitlist({ email: "friend@example.com", referralCode: code });
    await joinWaitlist({ email: "friend@example.com", referralCode: code });

    const [row] = await testDb.select().from(waitlistEntry).where(eq(waitlistEntry.referralCode, code));
    expect(row?.referralCount).toBe(1);
  });
});
