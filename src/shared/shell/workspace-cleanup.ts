import type { FeatureShell } from "./contract";
import { unstable_rethrow } from "next/navigation";

/** How the cleanups of a workspace about to be deleted went. */
interface CleanupOutcome {
  /** The message key of the cleanup that failed, which keeps the workspace; null when every one did its part. */
  failed: string | null;
  /** What the cleanups before it did, as message keys: what the person is told was done already. */
  done: string[];
}

/**
 * Runs the cleanups the features declare for a workspace that is about to be
 * deleted (`onWorkspaceDelete`), in their order, one after the other. The first
 * that fails stops them, and its message says why the workspace was kept; what
 * the ones before it did is told with it (a subscription that is cancelled
 * already). A feature that is not installed has none: its cleanup goes with its
 * line of the registry. What ends an action in Next (a redirect, a not found) is
 * not a cleanup that failed: it is handed on, and the workspace is kept all the same
 * (nothing was deleted yet).
 */
export async function runWorkspaceCleanups(
  features: readonly FeatureShell[],
  orgId: string,
): Promise<CleanupOutcome> {
  const cleanups = features
    .flatMap(({ onWorkspaceDelete }) => (onWorkspaceDelete ? [onWorkspaceDelete] : []))
    .sort((a, b) => a.order - b.order);
  const done: string[] = [];

  for (const cleanup of cleanups) {
    try {
      const did = await cleanup.run(orgId);
      if (did) {
        done.push(did);
      }
    } catch (error) {
      unstable_rethrow(error);
      console.error(`The workspace ${orgId} was kept: a cleanup failed`, error);
      return { failed: cleanup.failureKey, done };
    }
  }

  return { failed: null, done };
}
