import type { OrgRole } from "@/shared/types";
import { ROLE_HIERARCHY } from "@/shared/types";

// What a role may do in the Team page, written once. The server asks the same
// roles of `requireRole` (inviteMember, changeRole and removeMember need an
// admin, deleteOrganization the owner), and the page offers an action to the
// roles at least as high, by the comparison `requireRole` makes itself: the
// values of `ROLE_HIERARCHY` (owner above admin above member), not by a ranking
// of its own. The page only hides what a role cannot do; the server decides
// again. This module is plain, so that a Server Component and a client component
// both read it.

/** The lowest role that may invite people, change the role of a member and remove one. */
export const MANAGE_MEMBERS_MIN_ROLE: OrgRole = "admin";

/** The lowest role that may delete the workspace. */
export const DELETE_WORKSPACE_MIN_ROLE: OrgRole = "owner";

/** The roles a person can be given, when they are invited and afterwards: the owner is made once, with the workspace. */
export const ASSIGNABLE_ROLES = ["admin", "member"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

// As `requireRole` reads it (guards.ts): a role that is not in the hierarchy counts for nothing.
function atLeast(minRole: OrgRole, role: OrgRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= ROLE_HIERARCHY[minRole];
}

/** Whether a role is offered the invitation button and the actions of a member. */
export function canManageMembers(role: OrgRole): boolean {
  return atLeast(MANAGE_MEMBERS_MIN_ROLE, role);
}

/** Whether a role is offered the zone that deletes the workspace. */
export function canDeleteWorkspace(role: OrgRole): boolean {
  return atLeast(DELETE_WORKSPACE_MIN_ROLE, role);
}

/**
 * Whether the viewer is offered the actions of this member's row. The owner is
 * never touched, as the server refuses it (an admin could otherwise take the
 * workspace over), and nobody changes their own role or removes themselves from
 * here: their own row offers to leave (`canLeaveWorkspace`).
 */
export function canManageMember(
  viewer: { userId: string; role: OrgRole },
  member: { userId: string; role: string },
): boolean {
  return (
    canManageMembers(viewer.role) &&
    member.role !== "owner" &&
    member.userId !== viewer.userId
  );
}

/** Whether the viewer, who must own the workspace, is offered to hand it over to this member: any other member of it. */
export function canTransferOwnership(
  viewer: { userId: string; role: OrgRole },
  member: { userId: string; role: string },
): boolean {
  return viewer.role === "owner" && member.role !== "owner" && member.userId !== viewer.userId;
}

/**
 * Whether this row is the viewer's own, and offers them to leave the workspace.
 * The owner never leaves (`leaveWorkspace` refuses it): a workspace is never
 * left without one, so the owner deletes it instead.
 */
export function canLeaveWorkspace(
  viewer: { userId: string; role: OrgRole },
  member: { userId: string; role: string },
): boolean {
  return member.userId === viewer.userId && member.role !== "owner" && viewer.role !== "owner";
}
