import { and, asc, count, eq, gt } from "drizzle-orm";
import { cache } from "react";
import { invitation, organization, organizationMember, user } from "@/models";
import { db } from "@/shared/lib/DB";
import "server-only";

export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  return org ?? null;
}

/**
 * The members of a workspace, for its Team page: the id of the membership and
 * the id of the person (the server removes and changes by the first), their name,
 * email and photo, and their role. Display fields only, never the user record.
 * The oldest membership comes first, with the id as the tie-break, so that the
 * list keeps its order from one read to the next: the owner opens it, and a role
 * that changes does not move a row.
 */
export async function getOrganizationMembers(orgId: string) {
  return db
    .select({
      id: organizationMember.id,
      userId: organizationMember.userId,
      role: organizationMember.role,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(organizationMember)
    .innerJoin(user, eq(organizationMember.userId, user.id))
    .where(eq(organizationMember.organizationId, orgId))
    .orderBy(asc(organizationMember.createdAt), asc(organizationMember.id));
}

/**
 * How many people belong to a workspace: what its plan limits, and what the
 * invite step of the home reads. The members card and the first step both ask
 * for it in one render: a request counts them once.
 */
export const countMembers = cache(async (orgId: string): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(organizationMember)
    .where(eq(organizationMember.organizationId, orgId));

  return result?.count ?? 0;
});

/**
 * The seats of a workspace, read fresh through `reader`: its members, and the
 * invitations still waiting (a person invited holds a seat, so that a workspace
 * cannot invite past its limit and let them all accept). What the plan's members
 * limit is enforced with.
 */
export async function countSeats(orgId: string, reader: Pick<typeof db, "select"> = db): Promise<number> {
  const [members] = await reader.select({ count: count() }).from(organizationMember).where(eq(organizationMember.organizationId, orgId));
  const [pending] = await reader
    .select({ count: count() })
    .from(invitation)
    .where(and(eq(invitation.organizationId, orgId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())));

  return (members?.count ?? 0) + (pending?.count ?? 0);
}

export async function getUserOrganizations(userId: string) {
  const orgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      role: organizationMember.role,
    })
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organizationMember.organizationId, organization.id),
    )
    .where(eq(organizationMember.userId, userId))
    // The oldest membership first: it is the workspace a person falls back to.
    .orderBy(asc(organizationMember.createdAt), asc(organizationMember.id));
  return orgs;
}

/**
 * An invitation as its page reads it: who it was sent to, the role it gives,
 * whether it still holds, the workspace it opens and who sent it. Null when
 * there is no invitation of that id. The page decides what it shows from it
 * (`invitationView`): only the invited person sees the workspace and the inviter.
 */
export async function getInvitation(invitationId: string) {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      workspaceName: organization.name,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .innerJoin(user, eq(invitation.inviterId, user.id))
    .where(eq(invitation.id, invitationId))
    .limit(1);
  return row ?? null;
}
