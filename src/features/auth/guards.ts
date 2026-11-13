import type { OrgRole } from "@/shared/types";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { organizationMember } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { ROLE_HIERARCHY } from "@/shared/types";
import { auth } from "./auth";
import { redirectTo } from "./redirect-to";

/**
 * The session of the request, read once however many callers ask (the guard of
 * the page, the layout of the shell, the workspace context): the lookup is a
 * database read, and a request's session does not change while it renders.
 */
export const getServerSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
});

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    return redirectTo("/sign-in");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!(session.user as Record<string, unknown>).isAdmin) {
    return redirectTo("/dashboard");
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
    return redirectTo("/dashboard");
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
    return redirectTo("/dashboard");
  }

  const userRoleLevel = ROLE_HIERARCHY[member.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userRoleLevel < requiredLevel) {
    return redirectTo("/dashboard");
  }

  return { session, member };
}
