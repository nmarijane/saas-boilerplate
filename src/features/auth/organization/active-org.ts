"use server";

import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/features/auth/guards";
import { organizationMember } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { getUserOrganizations } from "./queries";

export async function getActiveOrgId(): Promise<string | null> {
  const session = await requireAuth();

  // Better Auth stores activeOrganizationId on the session
  // when the organization() plugin is active
  const activeOrgId = session.session.activeOrganizationId;

  if (activeOrgId) {
    const [membership] = await db
      .select({ id: organizationMember.id })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, activeOrgId),
          eq(organizationMember.userId, session.user.id),
        ),
      )
      .limit(1);

    if (membership) return activeOrgId;
  }

  // Fallback: first org the user belongs to
  const orgs = await getUserOrganizations(session.user.id);
  return orgs[0]?.id ?? null;
}
