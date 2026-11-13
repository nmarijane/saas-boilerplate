import { workspaceSlug } from "./slug";

/** What `createOrganization` answers, as far as creating a workspace reads it. */
type CreateWorkspaceResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string };

interface CreateWorkspaceDeps {
  create: (input: { name: string; slug: string }) => Promise<CreateWorkspaceResult>;
  /**
   * Makes the new workspace the active one (`switchTo` of `useSwitchWorkspace`):
   * true once it is, false when it could not be (it has said so itself).
   */
  switchTo: (organizationId: string) => Promise<boolean>;
  /** Reads the shell again, so that a workspace that exists shows in the list. */
  refresh: () => void;
}

/**
 * Creates a workspace under the name given, then switches to it. It answers
 * whether the workspace was created: a refusal of the server is `false`, and
 * nothing is switched to. A call that fails outright (the network) rejects,
 * and the caller says so, as it does for a refusal.
 *
 * Once the workspace is created it exists, switched to or not. When the switch
 * fails the shell is read again: otherwise the workspace would be missing from
 * the list until the page is reloaded, and the person, who sees nothing new,
 * would create it a second time.
 */
export async function createWorkspace(
  deps: CreateWorkspaceDeps,
  name: string,
): Promise<boolean> {
  const trimmed = name.trim();
  const result = await deps.create({ name: trimmed, slug: workspaceSlug(trimmed) });
  if (!result.success) {
    return false;
  }

  const switched = await deps.switchTo(result.data.id);
  if (!switched) {
    deps.refresh();
  }

  return true;
}
