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

export async function requireRole(
  orgId: string,
  userId: string,
  minRole: OrgRole,
) {
  const session = await requireAuth();

  const members = await db
    .select()
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, orgId),
        eq(organizationMember.userId, userId),
      ),
    )
    .limit(1);

  const member = members[0];

  if (!member) {
    redirect("/dashboard");
  }

  const userRoleLevel = ROLE_HIERARCHY[member.role as OrgRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userRoleLevel < requiredLevel) {
    redirect("/dashboard");
  }

  return { session, member };
}
