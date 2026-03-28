"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { waitlistEntry } from "@/models/waitlist";
import { db } from "@/shared/lib/DB";
import { safeAction } from "@/shared/lib/safe-action";
import { generateId } from "@/shared/utils/helpers";
import { generateReferralCode } from "./lib/referral";
import { getWaitlistEntryByCode } from "./queries";

const joinSchema = z.object({
  email: z.string().email("Invalid email address"),
  referralCode: z.string().optional(),
});

export async function joinWaitlist(input: { email: string; referralCode?: string }) {
  return safeAction(async () => {
    const parsed = joinSchema.parse(input);

    // Check if already registered
    const existing = await db
      .select()
      .from(waitlistEntry)
      .where(eq(waitlistEntry.email, parsed.email))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      return { id: existing.id, referralCode: existing.referralCode, alreadyExists: true };
    }

    // Find referrer if code provided
    let referrerId: string | null = null;
    if (parsed.referralCode) {
      const referrer = await getWaitlistEntryByCode(parsed.referralCode);
      if (referrer) {
        referrerId = referrer.id;
        // Increment referrer's count
        await db
          .update(waitlistEntry)
          .set({ referralCount: sql`${waitlistEntry.referralCount} + 1` })
          .where(eq(waitlistEntry.id, referrer.id));
      }
    }

    const id = generateId();
    const code = generateReferralCode();

    await db.insert(waitlistEntry).values({
      id,
      email: parsed.email,
      referralCode: code,
      referredBy: referrerId,
      referralCount: 0,
      status: "waiting",
    });

    revalidatePath("/waitlist");
    return { id, referralCode: code, alreadyExists: false };
  });
}

const inviteSchema = z.object({
  entryId: z.string().min(1),
});

export async function inviteFromWaitlist(input: { entryId: string }) {
  return safeAction(async () => {
    const parsed = inviteSchema.parse(input);

    await db
      .update(waitlistEntry)
      .set({ status: "invited" })
      .where(eq(waitlistEntry.id, parsed.entryId));

    revalidatePath("/admin/waitlist");
    return { success: true };
  });
}
