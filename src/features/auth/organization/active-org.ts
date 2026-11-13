import { getWorkspaceContext } from "./workspace";
import "server-only";

/** The id of the workspace the signed-in person works in, or null when they have none. */
export async function getActiveOrgId(): Promise<string | null> {
  // The session's active workspace while the person still belongs to it,
  // otherwise the oldest one: see getWorkspaceContext.
  const { workspace } = await getWorkspaceContext();
  return workspace?.id ?? null;
}
