"use server";

import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/features/auth/guards";
import { announceWorkspaceDeletion, cleanUpWorkspace } from "@/features/auth/organization/workspace-deletion";
import { invitation, organization, organizationMember } from "@/models/organization";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import { enforceActionRateLimit } from "@/shared/lib/rate-limit/action";
import { safeAction } from "@/shared/lib/safe-action";
import { isAvatarUrl } from "@/shared/utils/avatar-url";
import { checkReauthentication } from "./reauthentication";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  // An https address, or nothing to take the picture away (isAvatarUrl)
  image: z.string().refine(isAvatarUrl, { message: "The picture must be an https address" }).or(z.literal("")).optional(),
});

export async function updateProfile(
  input: z.infer<typeof updateProfileSchema>,
) {
  return safeAction(async () => {
    const session = await requireAuth();
    const parsed = updateProfileSchema.parse(input);

    await db
      .update(user)
      .set({
        name: parsed.name,
        image: parsed.image || null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    revalidatePath("/settings/account");
  }, "Failed to update profile");
}

/** What deleting an account came to: it went, or why it did not (the person is told, and nothing was deleted). */
export type DeleteAccountOutcome =
  | { deleted: true }
  | { deleted: false; reason: "password-required" | "wrong-password" | "recent-sign-in-required" }
  /** A workspace the person owns has other members: someone has to take it over (or the members leave) first. */
  | { deleted: false; reason: "workspace-has-members"; workspace: string }
  /** A workspace the person owns alone could not be cleaned up (a subscription that would not cancel): it is kept, with its message key. */
  | { deleted: false; reason: "workspace-kept"; messageKey: string };

const deleteAccountSchema = z.object({ password: z.string().min(1).max(128).optional() });

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Locks the workspaces the person is about to delete and the memberships that make them owner, then reads them
 * again: the name of a workspace that has another member, or that the person owns and is not among `expected`
 * (the owner handed it to them while the cleanups ran: nobody else would be left to delete it), or `null` when
 * every one is the person's alone. A member being added needs a share of the row of its workspace, so it either
 * lands before this reads or waits until the transaction is over.
 */
async function aloneOrBlocking(
  transaction: Transaction,
  personId: string,
  expected: { id: string; name: string }[],
): Promise<string | null> {
  if (expected.length > 0) {
    await transaction
      .select({ id: organization.id })
      .from(organization)
      .where(inArray(organization.id, expected.map(({ id }) => id)))
      .for("update");
  }

  // Every membership of the person is locked, not only an owner's: a hand-over to this person then waits for
  // the deletion, or the deletion reads the owner it made
  const memberships = await transaction
    .select({ id: organization.id, name: organization.name, role: organizationMember.role })
    .from(organizationMember)
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(eq(organizationMember.userId, personId))
    .for("update");
  const known = new Set(expected.map(({ id }) => id));
  const gained = memberships.find(({ id, role }) => role === "owner" && !known.has(id));
  if (gained) {
    return gained.name;
  }

  for (const workspace of expected) {
    const [others] = await transaction
      .select({ total: count() })
      .from(organizationMember)
      .where(and(eq(organizationMember.organizationId, workspace.id), ne(organizationMember.userId, personId)));
    if ((others?.total ?? 0) > 0) {
      return workspace.name;
    }
  }

  return null;
}

/**
 * Deletes the account of the person who asks, once they have proved it is them (the
 * password, asked again, or a session opened in the last minutes: `reauthentication.ts`).
 *
 * The workspaces they own are dealt with first, and nothing is deleted until every one is:
 * a workspace they own with other members is not theirs to take away, so the account is
 * kept and says so (the owner hands it over, or the members leave, first); one they own
 * alone goes with them, as it would if they deleted it, cleanups and webhooks included
 * (`prepareWorkspaceDeletion`). Then the rows of those workspaces and the person's own go
 * in one transaction, so that a failure leaves no half-deleted account. What the cleanups
 * did outside the database (a subscription cancelled, files deleted) cannot be rolled back
 * with it: they run before, while a failure still keeps everything.
 */
export async function deleteAccount(input?: { password?: string }) {
  return safeAction(async (): Promise<DeleteAccountOutcome> => {
    const { user: person, session } = await requireAuth();
    const parsed = deleteAccountSchema.parse(input ?? {});
    // A wrong password is a guess at it: a stolen session gets a few
    await enforceActionRateLimit(`delete-account:${person.id}`, 5, 600);

    const proof = await checkReauthentication({
      userId: person.id,
      sessionCreatedAt: session.createdAt,
      password: parsed.password,
    });
    if (proof !== "ok") {
      return { deleted: false, reason: proof };
    }

    const owned = await db
      .select({ id: organization.id, name: organization.name })
      .from(organizationMember)
      .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
      .where(and(eq(organizationMember.userId, person.id), eq(organizationMember.role, "owner")));

    for (const workspace of owned) {
      const [others] = await db
        .select({ total: count() })
        .from(organizationMember)
        .where(and(eq(organizationMember.organizationId, workspace.id), ne(organizationMember.userId, person.id)));
      if ((others?.total ?? 0) > 0) {
        return { deleted: false, reason: "workspace-has-members", workspace: workspace.name };
      }
    }

    // Every cleanup first: one that fails keeps everything, and nothing has been told to anybody
    for (const workspace of owned) {
      const cleaned = await cleanUpWorkspace(workspace);
      if (!cleaned.ready) {
        return { deleted: false, reason: "workspace-kept", messageKey: cleaned.messageKey };
      }
    }

    // The cleanups took time. One short transaction closes the doors before anything is told: it locks the
    // workspaces, checks the members again and deletes the invitations that are still pending (the only way
    // anybody could join a workspace owned alone). After it nobody but the person can add a member, so the
    // events below are true; no lock is held during a delivery, and the last check below stays as the backstop
    const closed = await db.transaction(async (transaction) => {
      const blocking = await aloneOrBlocking(transaction, person.id, owned);
      if (blocking === null && owned.length > 0) {
        await transaction.delete(invitation).where(inArray(invitation.organizationId, owned.map(({ id }) => id)));
      }

      return blocking;
    });
    if (closed !== null) {
      return { deleted: false, reason: "workspace-has-members", workspace: closed };
    }

    // Then the events, which go last (a receiver is told of a deletion that is going to happen)
    for (const workspace of owned) {
      await announceWorkspaceDeletion(workspace, person.id);
    }

    const refused = await db.transaction(async (transaction) => {
      const blocking = await aloneOrBlocking(transaction, person.id, owned);
      if (blocking !== null) {
        return blocking;
      }

      for (const workspace of owned) {
        await transaction.delete(organization).where(eq(organization.id, workspace.id));
      }
      // The sessions, accounts, memberships and notifications of the person go with it (cascade)
      await transaction.delete(user).where(eq(user.id, person.id));

      return null;
    });
    if (refused !== null) {
      return { deleted: false, reason: "workspace-has-members", workspace: refused };
    }

    revalidatePath("/");
    return { deleted: true };
  }, "Failed to delete account");
}
