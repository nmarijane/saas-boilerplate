// What the button of a plan card does, decided by the page that draws the cards
// from who is looking (a visitor, a person with a workspace, the plan it is on).
// Plain data, so that a Server Component can hand it to the cards.

export type PlanCta =
  /** A visitor: to sign-up, with the plan and the period kept. */
  | { kind: "signup" }
  /** A signed-in admin of a workspace that has not paid: starts the payment. */
  | { kind: "checkout"; orgId: string }
  /** The plan the workspace is on: a disabled "Your plan", or a link to the billing page. */
  | { kind: "current"; href: string | null }
  /** A subscriber looking at another plan: to the billing page, where plans are changed. */
  | { kind: "change" }
  /** The free plan, offered when choosing: continues on it. */
  | { kind: "continue-free" }
  /** The free plan of a visitor: to sign-up. */
  | { kind: "free-signup" }
  /** A member: only an admin can pay, said under the cards instead of on a button. */
  | { kind: "none" };
