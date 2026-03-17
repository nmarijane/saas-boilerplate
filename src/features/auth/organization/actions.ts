"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/features/auth/auth";
import { getServerSession } from "@/features/auth/guards";
import { sendEmail } from "@/features/email/send";
import { InvitationEmail } from "@/features/email/templates/invitation";
import { organizationMember, organization as organizationTable } from "@/models/organization";
import { db } from "@/shared/lib/DB";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export async function createOrganization(data: z.infer<typeof createOrgSchema>) {
  const parsed = createOrgSchema.parse(data);
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

  const result = await auth.api.createOrganization({
    headers: await headers(),
    body: {
      name: parsed.name,
      slug: parsed.slug,
    },
  });

  revalidatePath("/dashboard");
  return result;
}

const inviteSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

export async function inviteMember(data: z.infer<typeof inviteSchema>) {
  const parsed = inviteSchema.parse(data);
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

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
}

const removeMemberSchema = z.object({
  orgId: z.string().min(1),
  memberIdToRemove: z.string().min(1),
});

export async function removeMember(data: z.infer<typeof removeMemberSchema>) {
  const parsed = removeMemberSchema.parse(data);
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .delete(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, parsed.orgId),
        eq(organizationMember.id, parsed.memberIdToRemove),
      ),
    );

  revalidatePath("/settings/team");
}

const changeRoleSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  newRole: z.enum(["admin", "member"]),
});

export async function changeRole(data: z.infer<typeof changeRoleSchema>) {
  const parsed = changeRoleSchema.parse(data);
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

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
}

const deleteOrgSchema = z.object({
  orgId: z.string().min(1),
});

export async function deleteOrganization(data: z.infer<typeof deleteOrgSchema>) {
  const parsed = deleteOrgSchema.parse(data);
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .delete(organizationTable)
    .where(eq(organizationTable.id, parsed.orgId));

  revalidatePath("/dashboard");
}
