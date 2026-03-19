"use server";

import { requireAuth } from "@/features/auth/guards";
import { getUserOrganizations } from "./queries";

export async function getActiveOrgId(): Promise<string | null> {
  const session = await requireAuth();

  // Better Auth stores activeOrganizationId on the session
  // when the organization() plugin is active
  const activeOrgId = session.session.activeOrganizationId;

  if (activeOrgId) return activeOrgId;

  // Fallback: first org the user belongs to
  const orgs = await getUserOrganizations(session.user.id);
  return orgs[0]?.id ?? null;
}
