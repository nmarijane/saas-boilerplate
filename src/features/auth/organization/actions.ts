"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/features/auth/auth";
import { requireAuth, requireRole } from "@/features/auth/guards";
import { sendEmail } from "@/features/email/send";
import { InvitationEmail } from "@/features/email/templates/invitation";
import { organizationMember, organization as organizationTable } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { safeAction } from "@/shared/lib/safe-action";
import { getOrganizationMembers, getUserOrganizations } from "./queries";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export async function createOrganization(data: z.infer<typeof createOrgSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = createOrgSchema.parse(data);

    const result = await auth.api.createOrganization({
      headers: await headers(),
      body: {
        name: parsed.name,
        slug: parsed.slug,
      },
    });

    revalidatePath("/dashboard");
    return result;
  }, "Failed to create organization");
}

const inviteSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

export async function inviteMember(data: z.infer<typeof inviteSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = inviteSchema.parse(data);
    const { session } = await requireRole(parsed.orgId, "admin");

    const result = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        organizationId: parsed.orgId,
        email: parsed.email,
        role: parsed.role,
      },
    });

    // Send invitation email
    await sendEmail({
      to: parsed.email,
      subject: "You've been invited to join an organization",
      template: InvitationEmail({
        inviterName: session.user.name,
        organizationName: result.organizationId,
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/accept-invitation/${result.id}`,
      }),
    });

    revalidatePath("/settings/team");
    return result;
  }, "Failed to invite member");
}

// The owner cannot be removed or demoted: otherwise an admin could take over the organization.
async function assertNotOwner(orgId: string, memberId: string) {
  const [target] = await db
    .select({ role: organizationMember.role })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, orgId),
        eq(organizationMember.id, memberId),
      ),
    )
    .limit(1);

  if (target?.role === "owner") {
    throw new Error("The organization owner cannot be modified");
  }
}

const removeMemberSchema = z.object({
  orgId: z.string().min(1),
  memberIdToRemove: z.string().min(1),
});

export async function removeMember(data: z.infer<typeof removeMemberSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = removeMemberSchema.parse(data);
    await requireRole(parsed.orgId, "admin");
    await assertNotOwner(parsed.orgId, parsed.memberIdToRemove);

    await db
      .delete(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, parsed.orgId),
          eq(organizationMember.id, parsed.memberIdToRemove),
        ),
      );

    revalidatePath("/settings/team");
  }, "Failed to remove member");
}

const changeRoleSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  newRole: z.enum(["admin", "member"]),
});

export async function changeRole(data: z.infer<typeof changeRoleSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = changeRoleSchema.parse(data);
    await requireRole(parsed.orgId, "admin");
    await assertNotOwner(parsed.orgId, parsed.memberId);

    await db
      .update(organizationMember)
      .set({ role: parsed.newRole })
      .where(
        and(
          eq(organizationMember.organizationId, parsed.orgId),
          eq(organizationMember.id, parsed.memberId),
        ),
      );

    revalidatePath("/settings/team");
  }, "Failed to change role");
}

const deleteOrgSchema = z.object({
  orgId: z.string().min(1),
});

export async function deleteOrganization(data: z.infer<typeof deleteOrgSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = deleteOrgSchema.parse(data);
    await requireRole(parsed.orgId, "owner");

    await db
      .delete(organizationTable)
      .where(eq(organizationTable.id, parsed.orgId));

    revalidatePath("/dashboard");
  }, "Failed to delete organization");
}

// Reads called from client components. The queries select display fields only.

export async function getOrganizationMembersAction(orgId: string) {
  await requireRole(orgId, "member");
  return getOrganizationMembers(orgId);
}

export async function getUserOrganizationsAction() {
  const session = await requireAuth();
  return getUserOrganizations(session.user.id);
}
