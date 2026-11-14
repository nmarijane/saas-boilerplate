import type { PlanCta } from "./components/plan-cta";
import type { ShellRole } from "@/shared/shell/contract";
import { getServerSession } from "@/features/auth/guards";
import { getWorkspaceContext } from "@/features/auth/organization/workspace";
import { env } from "@/shared/lib/env";
import { isTrialAvailable } from "./checkout";
import { getSubscriptionForOrg } from "./helpers";
import { canManageBilling } from "./permissions";
import { effectivePlan, findFreePlan, isPaidPlan, PLANS } from "./plans";
import "server-only";

// Who is looking at the plans, and so what each button does. The prices are
// public, but the buttons are not the same for everyone: a visitor signs up, a
// signed-in admin pays, a subscriber is led to the billing page, a member is
// told that only an admin can pay.

type PricingViewer =
  | { kind: "visitor" }
  | { kind: "member"; planId: string; orgId: string }
  | { kind: "subscriber"; planId: string; orgId: string }
  | { kind: "payer"; planId: string; orgId: string; role: ShellRole };

/** Who is looking: nothing is read of a visitor but the absence of a session. */
export async function getPricingViewer(): Promise<PricingViewer> {
  const session = await getServerSession();
  if (!session) {
    return { kind: "visitor" };
  }

  const { workspace } = await getWorkspaceContext();
  if (!workspace) {
    return { kind: "visitor" };
  }

  const { planId, status, subscription } = await getSubscriptionForOrg(workspace.id);
  const plan = effectivePlan(planId, status);
  if (!canManageBilling(workspace.role)) {
    return { kind: "member", planId: plan.id, orgId: workspace.id };
  }

  const subscribed = isPaidPlan(plan) && subscription?.stripeSubscriptionId != null;

  return subscribed
    ? { kind: "subscriber", planId: plan.id, orgId: workspace.id }
    : { kind: "payer", planId: plan.id, orgId: workspace.id, role: workspace.role };
}

/**
 * What the button of each plan does for this viewer. `choosing` is the page that
 * follows sign-up, where the free plan is a way forward ("Continue on Free"), as
 * against the public prices, where it says which plan the workspace is on.
 */
export function ctasFor(viewer: PricingViewer, { choosing }: { choosing: boolean }): Record<string, PlanCta> {
  const ctas: Record<string, PlanCta> = {};
  const free = findFreePlan();

  for (const plan of PLANS) {
    const paid = isPaidPlan(plan);
    if (viewer.kind === "visitor") {
      ctas[plan.id] = paid ? { kind: "signup" } : { kind: "free-signup" };
    } else if (viewer.kind === "member") {
      ctas[plan.id] = plan.id === viewer.planId ? { kind: "current", href: null } : { kind: "none" };
    } else if (viewer.kind === "subscriber") {
      ctas[plan.id] = plan.id === viewer.planId ? { kind: "current", href: "/settings/billing" } : { kind: "change" };
    } else if (paid) {
      ctas[plan.id] = { kind: "checkout", orgId: viewer.orgId };
    } else {
      ctas[plan.id] = choosing && free ? { kind: "continue-free" } : { kind: "current", href: null };
    }
  }

  return ctas;
}

/** The plans whose free trial the viewer can still have: a visitor has all of them, the owner of a workspace those they have not used. */
export async function trialPlanIdsFor(viewer: PricingViewer): Promise<string[]> {
  const withTrial = PLANS.filter((plan) => plan.trialDays);
  if (viewer.kind === "visitor") {
    return withTrial.map((plan) => plan.id);
  }

  const available = await Promise.all(withTrial.map(async (plan) => ((await isTrialAvailable(viewer.orgId, plan.id)) ? plan.id : null)));

  return available.filter((id): id is string => id !== null);
}

/** The currency the plans are priced in, and whether the prices are quoted without VAT: what the pages that show prices need. */
export function pricingMoney() {
  // Read with its default: where the environment is not validated (a build, a test run), the schema's default is not applied
  return { currency: (env.BILLING_CURRENCY ?? "usd").toLowerCase(), taxExcluded: env.STRIPE_TAX_ENABLED === true };
}
