import { emitEvent } from "@/features/events/emitter";
import { runWorkspaceCleanups } from "@/shared/shell/workspace-cleanup";
import "server-only";

// The steps that come before a workspace's rows go, for every way a workspace is
// deleted (its owner deletes it, or a person who owns only it deletes their
// account). Never a server action: the callers have checked who may.

/** A workspace that is ready to have its rows deleted, or the reason it is kept (a message key, with what the steps before it did). */
type DeletionPreparation =
  | { ready: true }
  | { ready: false; messageKey: string; done: string[] };

/**
 * The features that hold something for the workspace outside its rows clean it up
 * (`onWorkspaceDelete` in their `shell.ts`: billing cancels the subscription, upload
 * deletes the stored files); one that cannot keeps the workspace. Nothing is told to
 * anybody yet: a deletion that is about to be refused must not have been announced.
 */
export async function cleanUpWorkspace(workspace: { id: string }): Promise<DeletionPreparation> {
  // The registry is read when a workspace is deleted, and not when this module
  // loads: it holds every feature, which the other actions have no use for.
  const { FEATURES } = await import("@/features/registry");
  const { failed, done } = await runWorkspaceCleanups(FEATURES, workspace.id);

  return failed ? { ready: false, messageKey: failed, done } : { ready: true };
}

/**
 * `organization.deleted` is told while the workspace is still there: the deliveries
 * to its webhooks are made while its endpoints exist, and the audit log keeps it as
 * an entry of the platform, which outlives the workspace. The caller deletes the rows
 * right after, and calls this only once every cleanup it needs has gone through.
 */
export async function announceWorkspaceDeletion(workspace: { id: string; name: string }, actorId: string): Promise<void> {
  await emitEvent(
    "organization.deleted",
    {
      orgId: workspace.id,
      actorId,
      resourceType: "organization",
      resourceId: workspace.id,
      metadata: { name: workspace.name },
    },
    { awaitWebhooks: true },
  );
}

/** The two steps for one workspace, in order: cleanups, then the event. */
export async function prepareWorkspaceDeletion(
  workspace: { id: string; name: string },
  actorId: string,
): Promise<DeletionPreparation> {
  const cleaned = await cleanUpWorkspace(workspace);
  if (cleaned.ready) {
    await announceWorkspaceDeletion(workspace, actorId);
  }

  return cleaned;
}
