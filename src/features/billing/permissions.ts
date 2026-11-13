import type { OrgRole } from "@/shared/types";
import { ROLE_HIERARCHY } from "@/shared/types";

// Who may change the plan of a workspace and open its billing portal, written
// once. The actions ask this role of `requireRole`, the shell offers the
// upgrade from it up, and the billing page draws its buttons for it alone, by
// the comparison `requireRole` makes itself. This module is plain, so that a
// Server Component and a client component both read it.

/** The lowest role that may change the plan and manage the billing. */
export const BILLING_MIN_ROLE: OrgRole = "admin";

/** Whether a role is offered the buttons of the billing page. */
export function canManageBilling(role: OrgRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= ROLE_HIERARCHY[BILLING_MIN_ROLE];
}

/**
 * The lowest role that may cancel the subscription, or take the cancellation
 * back: what ends the plan of the whole team is the owner's alone, as deleting
 * the workspace is. Buying and changing the plan stay with `BILLING_MIN_ROLE`.
 */
export const SUBSCRIPTION_OWNER_ROLE: OrgRole = "owner";

/** Whether a role may cancel or resume the subscription. */
export function canCancelSubscription(role: OrgRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= ROLE_HIERARCHY[SUBSCRIPTION_OWNER_ROLE];
}
