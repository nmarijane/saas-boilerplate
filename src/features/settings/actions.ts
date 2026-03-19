"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/features/auth/guards";
import { organizationMember } from "@/models/organization";
import { subscription } from "@/models/subscription";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  image: z.string().url().optional().or(z.literal("")),
});

export async function updateProfile(
  input: z.infer<typeof updateProfileSchema>,
) {
  const session = await requireAuth();
  const parsed = updateProfileSchema.parse(input);

  await db
    .update(user)
    .set({
      name: parsed.name,
      image: parsed.image || null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id));

  revalidatePath("/settings/profile");
}

export async function deleteAccount() {
  const session = await requireAuth();

  // Find orgs where user is owner
  const ownedOrgs = await db
    .select()
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.userId, session.user.id),
        eq(organizationMember.role, "owner"),
      ),
    );

  for (const membership of ownedOrgs) {
    const otherMembers = await db
      .select()
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, membership.organizationId),
          ne(organizationMember.userId, session.user.id),
        ),
      );

    if (otherMembers.length === 0) {
      // Sole member — cancel Stripe subscription if active
      const subs = await db
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, membership.organizationId))
        .limit(1);

      const sub = subs[0];

      if (sub?.stripeSubscriptionId) {
        try {
          const { getStripe } = await import("@/features/billing/stripe");
          await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
        } catch {
          // Stripe cancellation is best-effort
        }
      }
    } else {
      // Multi-member org — transfer ownership to next admin or oldest member
      const nextOwner =
        otherMembers.find((m) => m.role === "admin") ?? otherMembers[0];

      if (nextOwner) {
        await db
          .update(organizationMember)
          .set({ role: "owner" })
          .where(eq(organizationMember.id, nextOwner.id));
      }
    }
  }

  // Delete user account (cascades handle members, notifications, etc.)
  await db.delete(user).where(eq(user.id, session.user.id));
  revalidatePath("/");
}
