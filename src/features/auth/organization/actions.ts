"use server";

import { and, eq } from "drizzle-orm";
import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/features/auth/auth";
import { requireAuth, requireRole } from "@/features/auth/guards";
import { sendEmail } from "@/features/email/send";
import { InvitationEmail } from "@/features/email/templates/invitation";
import { emitEvent } from "@/features/events/emitter";
import { organizationMember, organization as organizationTable } from "@/models/organization";
import { DEV_APP_URL } from "@/shared/config/app";
import { db } from "@/shared/lib/DB";
import { routing } from "@/shared/lib/i18n-routing";
import { safeAction } from "@/shared/lib/safe-action";
import { runWorkspaceCleanups } from "@/shared/shell/workspace-cleanup";
import { invitationPath } from "./invitation-path";
import { getOrganization } from "./queries";

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
  /** The language of the page the invitation is sent from: the e-mail's link opens the invitation in it. */
  locale: z.string().max(10).optional(),
});

export async function inviteMember(data: z.infer<typeof inviteSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = inviteSchema.parse(data);
    const { session } = await requireRole(parsed.orgId, "admin");
    // A language the app does not serve gives the link the default one
    const locale = hasLocale(routing.locales, parsed.locale) ? parsed.locale : routing.defaultLocale;

    // The email names the workspace by its name. `requireRole` has proved that the
    // person belongs to it, so one that is not found is a failure of the action,
    // not an empty name: no invitation is made for it, and none is mailed.
    const workspace = await getOrganization(parsed.orgId);
    if (!workspace) {
      throw new Error("Organization not found");
    }

    const result = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        organizationId: parsed.orgId,
        email: parsed.email,
        role: parsed.role,
      },
    });

    // The e-mail names the workspace, and its link opens the page of the
    // invitation, in the language of the person who sent it
    await sendEmail({
      to: parsed.email,
      subject: `${session.user.name} invited you to join ${workspace.name}`,
      template: InvitationEmail({
        inviterName: session.user.name,
        organizationName: workspace.name,
        inviteUrl: new URL(
          invitationPath(result.id, locale),
          process.env.NEXT_PUBLIC_APP_URL ?? DEV_APP_URL,
        ).toString(),
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

/**
 * Deletes a workspace, with what it holds. First the features that hold
 * something for it outside its rows clean it up (`onWorkspaceDelete` in their
 * `shell.ts`: billing cancels the subscription, upload deletes the stored
 * files); one that cannot keeps the workspace, and the answer says why, as a
 * message key, with what the steps before it did (a subscription cancelled
 * already). Then `organization.deleted` is told while the workspace is still
 * there: the deliveries to its webhooks are queued while its endpoints exist,
 * and the audit log keeps it as an entry of the platform, which outlives the
 * workspace. Then the rows go, in cascade, with the workspace's own log.
 */
export async function deleteOrganization(data: z.infer<typeof deleteOrgSchema>) {
  return safeAction(async (): Promise<{ deleted: true } | { deleted: false; messageKey: string; done: string[] }> => {
    await requireAuth();
    const parsed = deleteOrgSchema.parse(data);
    const { session } = await requireRole(parsed.orgId, "owner");

    const workspace = await getOrganization(parsed.orgId);
    if (!workspace) {
      throw new Error("Organization not found");
    }

    // The registry is read when a workspace is deleted, and not when this module
    // loads: it holds every feature, which the other actions have no use for.
    const { FEATURES } = await import("@/features/registry");
    const { failed, done } = await runWorkspaceCleanups(FEATURES, parsed.orgId);
    if (failed) {
      return { deleted: false, messageKey: failed, done };
    }

    // Its webhooks are queued before the rows go: the endpoints go in cascade
    await emitEvent(
      "organization.deleted",
      {
        orgId: parsed.orgId,
        actorId: session.user.id,
        resourceType: "organization",
        resourceId: parsed.orgId,
        metadata: { name: workspace.name },
      },
      { awaitWebhooks: true },
    );

    await db
      .delete(organizationTable)
      .where(eq(organizationTable.id, parsed.orgId));

    revalidatePath("/dashboard");
    return { deleted: true };
  }, "Failed to delete organization");
}

const invitationSchema = z.object({
  invitationId: z.string().min(1).max(100),
});

// Answering an invitation goes through Better Auth with the session's headers:
// it checks that the invitation is pending and not expired, and that it was
// sent to the address the person is signed in with, so that a link that was
// forwarded opens nothing. Its own routes stay closed over HTTP (auth.ts).

/** Joins the workspace of the invitation, which becomes the active one of the session. */
export async function acceptInvitation(data: z.infer<typeof invitationSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = invitationSchema.parse(data);

    const { invitation } = await auth.api.acceptInvitation({
      headers: await headers(),
      body: { invitationId: parsed.invitationId },
    });

    revalidatePath("/dashboard");
    return { organizationId: invitation.organizationId };
  }, "Failed to accept the invitation");
}

/** Says no to the invitation: the person joins nothing, and the link no longer works. */
export async function declineInvitation(data: z.infer<typeof invitationSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = invitationSchema.parse(data);

    await auth.api.rejectInvitation({
      headers: await headers(),
      body: { invitationId: parsed.invitationId },
    });
  }, "Failed to decline the invitation");
}

const leaveSchema = z.object({
  orgId: z.string().min(1),
});

/**
 * Takes the person out of a workspace they belong to. The owner cannot leave:
 * a workspace is never left without one, so the owner deletes it instead.
 * Better Auth deletes the membership, and the session stops naming the
 * workspace when it was the active one: the next page takes the oldest
 * workspace the person still has, or sends them to onboarding.
 */
export async function leaveWorkspace(data: z.infer<typeof leaveSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = leaveSchema.parse(data);
    const { member } = await requireRole(parsed.orgId, "member");
    if (member.role === "owner") {
      throw new Error("The owner cannot leave the workspace");
    }

    await auth.api.leaveOrganization({
      headers: await headers(),
      body: { organizationId: parsed.orgId },
    });

    revalidatePath("/dashboard");
  }, "Failed to leave the workspace");
}
