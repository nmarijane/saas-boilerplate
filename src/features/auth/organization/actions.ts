"use server";

import { and, eq, ne } from "drizzle-orm";
import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/features/auth/auth";
import { requireAuth, requireRole } from "@/features/auth/guards";
import { sendEmail } from "@/features/email/send";
import { InvitationEmail } from "@/features/email/templates/invitation";
import { emitEvent } from "@/features/events/emitter";
import { assertFreeWorkspaceRoom, assertWithinPlan, settleFreeWorkspaces } from "@/features/plan-limits";
import { invitation as invitationTable, organizationMember, organization as organizationTable } from "@/models/organization";
import { DEV_APP_URL } from "@/shared/config/app";
import { db } from "@/shared/lib/DB";
import { routing } from "@/shared/lib/i18n-routing";
import { safeAction } from "@/shared/lib/safe-action";
import { invitationPath } from "./invitation-path";
import { countMembers, getOrganization } from "./queries";
import { prepareWorkspaceDeletion } from "./workspace-deletion";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export async function createOrganization(data: z.infer<typeof createOrgSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = createOrgSchema.parse(data);
    // Free credits are the owner's, once a month: a person owns a limited number of free workspaces
    await assertFreeWorkspaceRoom((await requireAuth()).user.id);

    const result = await auth.api.createOrganization({
      headers: await headers(),
      body: {
        name: parsed.name,
        slug: parsed.slug,
      },
    });

    // Written on another connection, the workspace may have been made at the same time as another: the cap is settled now
    await settleFreeWorkspaces((await requireAuth()).user.id, result.id);

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
    // A seat for the person invited: the members and the invitations still waiting count against the plan
    await assertWithinPlan(parsed.orgId, "members");
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

    // The check above can be stale: the owner may hand the workspace to this member at this very moment. The
    // write itself refuses an owner, and a write that touched no row is the refusal
    const removed = await db
      .delete(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, parsed.orgId),
          eq(organizationMember.id, parsed.memberIdToRemove),
          ne(organizationMember.role, "owner"),
        ),
      )
      .returning();
    if (removed.length === 0) {
      throw new Error("The organization owner cannot be modified");
    }

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

    // As in removeMember: the write refuses an owner itself, whatever the check above read
    const changed = await db
      .update(organizationMember)
      .set({ role: parsed.newRole })
      .where(
        and(
          eq(organizationMember.organizationId, parsed.orgId),
          eq(organizationMember.id, parsed.memberId),
          ne(organizationMember.role, "owner"),
        ),
      )
      .returning();
    if (changed.length === 0) {
      throw new Error("The organization owner cannot be modified");
    }

    revalidatePath("/settings/team");
  }, "Failed to change role");
}

const transferOwnershipSchema = z.object({
  orgId: z.string().min(1),
  /** The membership that becomes the owner: by its own id, as `changeRole` finds one. */
  memberId: z.string().min(1),
});

/**
 * Hands the workspace over: the member chosen becomes its owner, and the owner becomes an admin. Only the owner
 * may, and only to a member of this workspace (an id from another one, or the owner's own, finds nothing). It is
 * one transaction that reads both rows again under a lock, so that two hand-overs at once, or an owner that
 * stopped being one in between, leave one owner and not two or none. The owner of a workspace that has other
 * members cannot delete their account until they have done this (or removed the members).
 */
export async function transferOwnership(data: z.infer<typeof transferOwnershipSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = transferOwnershipSchema.parse(data);
    const { session } = await requireRole(parsed.orgId, "owner");

    const next = await db.transaction(async (transaction) => {
      const [owner] = await transaction
        .select({ id: organizationMember.id, role: organizationMember.role })
        .from(organizationMember)
        .where(and(eq(organizationMember.organizationId, parsed.orgId), eq(organizationMember.userId, session.user.id)))
        .for("update");
      if (owner?.role !== "owner") {
        throw new Error("Only the owner can hand the workspace over");
      }

      const [target] = await transaction
        .select({ id: organizationMember.id, role: organizationMember.role, userId: organizationMember.userId })
        .from(organizationMember)
        .where(and(eq(organizationMember.organizationId, parsed.orgId), eq(organizationMember.id, parsed.memberId)))
        .for("update");
      if (!target || target.userId === session.user.id || target.role === "owner") {
        throw new Error("The new owner has to be another member of the workspace");
      }

      await transaction.update(organizationMember).set({ role: "owner" }).where(eq(organizationMember.id, target.id));
      await transaction.update(organizationMember).set({ role: "admin" }).where(eq(organizationMember.id, owner.id));

      return target;
    });

    await emitEvent("member.role_changed", {
      orgId: parsed.orgId,
      actorId: session.user.id,
      resourceType: "organization_member",
      resourceId: next.id,
      metadata: { role: "owner", previousRole: next.role, handedOverBy: session.user.id },
    });

    revalidatePath("/settings/team");
  }, "Failed to hand the workspace over");
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
 * there: the deliveries to its webhooks are made while its endpoints exist,
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

    const prepared = await prepareWorkspaceDeletion({ id: parsed.orgId, name: workspace.name }, session.user.id);
    if (!prepared.ready) {
      return { deleted: false, messageKey: prepared.messageKey, done: prepared.done };
    }

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

    // The invitation holds its seat already: what can have changed since is the plan (a downgrade), so
    // the members that are there, and the one who joins, are what is counted
    const [invited] = await db
      .select({ orgId: invitationTable.organizationId })
      .from(invitationTable)
      .where(eq(invitationTable.id, parsed.invitationId))
      .limit(1);
    if (invited) {
      await assertWithinPlan(invited.orgId, "members", 1, () => countMembers(invited.orgId));
    }

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
