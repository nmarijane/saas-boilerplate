"use server";

import { eq } from "drizzle-orm";
import { requireAuth } from "@/features/auth/guards";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";

export async function completeOnboarding() {
  const session = await requireAuth();
  const organizations = await getUserOrganizations(session.user.id);

  if (organizations.length === 0) {
    throw new Error("Create a workspace before completing onboarding");
  }

  await db
    .update(user)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
}
