import { requireAuth } from "@/features/auth/guards";
import { getUserOrganizations } from "./queries";
import "server-only";

export async function getActiveOrgId(): Promise<string | null> {
  const session = await requireAuth();
  const orgs = await getUserOrganizations(session.user.id);

  // Better Auth stores activeOrganizationId on the session
  // when the organization() plugin is active. It can outlive a membership
  // (a removed member keeps it), so only trust it if the user still belongs.
  const activeOrgId = session.session.activeOrganizationId;
  if (activeOrgId && orgs.some((org) => org.id === activeOrgId)) return activeOrgId;

  // Fallback: first org the user belongs to
  return orgs[0]?.id ?? null;
}
