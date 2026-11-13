/** What switching workspace needs from the outside: the session, and the router of the app. */
interface SwitchWorkspaceDeps {
  /** Tells the session which workspace is the active one. It rejects when the workspace cannot be activated. */
  setActive: (organizationId: string) => Promise<unknown>;
  push: (href: string) => void;
  refresh: () => void;
}

/**
 * Makes a workspace the active one, then goes to its home and reads the shell
 * again. The order is the point: the home comes only once the session has the
 * new workspace (a page drawn before would still be the old workspace's), and
 * the page the person was on is left for the home (a project of the workspace
 * they left must never be drawn in the new one). A caller that opens a page of
 * the new workspace (a notification of it) gives that page instead. A
 * workspace that cannot be activated leaves the person where they are: the
 * rejection goes to the caller, which is the one that says so.
 */
export async function switchWorkspace(
  deps: SwitchWorkspaceDeps,
  organizationId: string,
  href = "/dashboard",
): Promise<void> {
  await deps.setActive(organizationId);
  deps.push(href);
  deps.refresh();
}
