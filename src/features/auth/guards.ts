import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { organizationMember } from "@/models/organization";
import { db } from "@/shared/lib/DB";
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
  minRole: "member" | "admin" | "owner",
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

  const roleHierarchy = { member: 0, admin: 1, owner: 2 };
  const userRoleLevel = roleHierarchy[member.role as keyof typeof roleHierarchy] ?? 0;
  const requiredLevel = roleHierarchy[minRole];

  if (userRoleLevel < requiredLevel) {
    redirect("/dashboard");
  }

  return { session, member };
}
