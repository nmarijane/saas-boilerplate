import type { ShellRole, WorkspaceScope } from "@/shared/shell/contract";
import type { ShellUser } from "@/shared/shell/view";
import { cache } from "react";
import { requireAuth } from "@/features/auth/guards";
import { redirectTo } from "@/features/auth/redirect-to";
import { getUserOrganizations } from "./queries";
import "server-only";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: ShellRole;
}

interface WorkspaceContext {
  user: ShellUser;
  /** The workspace the person works in; null when they belong to none. */
  workspace: Workspace | null;
  /** Every workspace of the person, the oldest membership first. */
  workspaces: Workspace[];
}

/**
 * Who is signed in and which workspace they work in, read once per request.
 * Better Auth keeps the active workspace on the session, and it can outlive a
 * membership (a removed member keeps it): it is trusted only while the person
 * still belongs to it, and otherwise the oldest workspace takes its place. The
 * guard is inside: a visitor without a session is sent to sign in.
 */
export const getWorkspaceContext: () => Promise<WorkspaceContext> = cache(
  async () => {
    const session = await requireAuth();
    const organizations = await getUserOrganizations(session.user.id);
    const workspaces = organizations.map(({ id, name, slug, role }) => ({
      id,
      name,
      slug,
      role,
    }));

    const activeId = session.session.activeOrganizationId;
    const workspace =
      workspaces.find(({ id }) => id === activeId) ?? workspaces[0] ?? null;

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
        isPlatformAdmin: session.user.isAdmin === true,
      },
      workspace,
      workspaces,
    };
  },
);

/**
 * The context of a page that works inside a workspace. Someone who has none is
 * sent to onboarding: a page takes its workspace from here, never from a
 * parameter the client could change.
 */
export async function requireWorkspace(): Promise<
  WorkspaceContext & { workspace: NonNullable<WorkspaceContext["workspace"]> }
> {
  const context = await getWorkspaceContext();
  if (!context.workspace) {
    return redirectTo("/onboarding");
  }

  return { ...context, workspace: context.workspace };
}

/** What a loader reads a workspace with: the workspace and the person, from the session. */
export function scopeOf(ctx: {
  user: { id: string };
  workspace: { id: string; role: ShellRole };
}): WorkspaceScope {
  return {
    orgId: ctx.workspace.id,
    userId: ctx.user.id,
    role: ctx.workspace.role,
  };
}
