import type { OrgRole } from "@/shared/types";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { organizationMember } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { ROLE_HIERARCHY } from "@/shared/types";
import { auth } from "./auth";

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!(session.user as Record<string, unknown>).isAdmin) {
    redirect("/dashboard");
  }
  return session;
}

/**
 * Session user must belong to `orgId` with at least `minRole`.
 * The user always comes from the session, never from an argument:
 * `orgId` usually comes from the client, so membership is checked here.
 */
export async function requireRole(orgId: string, minRole: OrgRole) {
  const session = await requireAuth();

  if (typeof orgId !== "string" || orgId.length === 0) {
    redirect("/dashboard");
  }

  const members = await db
    .select({ id: organizationMember.id, role: organizationMember.role })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, orgId),
        eq(organizationMember.userId, session.user.id),
      ),
    )
    .limit(1);

  const member = members[0];

  if (!member) {
    redirect("/dashboard");
  }

  const userRoleLevel = ROLE_HIERARCHY[member.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userRoleLevel < requiredLevel) {
    redirect("/dashboard");
  }

  return { session, member };
}
