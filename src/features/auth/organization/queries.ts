"use server";

import { eq } from "drizzle-orm";
import { organization, organizationMember, user } from "@/models";
import { db } from "@/shared/lib/DB";

export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  return org ?? null;
}

export async function getOrganizationMembers(orgId: string) {
  const members = await db
    .select({
      id: organizationMember.id,
      userId: organizationMember.userId,
      role: organizationMember.role,
      createdAt: organizationMember.createdAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(organizationMember)
    .innerJoin(user, eq(organizationMember.userId, user.id))
    .where(eq(organizationMember.organizationId, orgId));
  return members;
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
    .where(eq(organizationMember.userId, userId));
  return orgs;
}
