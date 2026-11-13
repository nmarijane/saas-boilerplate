import type { BillingInterval } from "./plans";
import { eq } from "drizzle-orm";
import { subscription } from "@/models";
import { ActionRefusal } from "@/shared/lib/action-refusal";
import { db } from "@/shared/lib/DB";
import { getPlanById, isLiveStatus, isPaidPlan } from "./plans";
import { priceIdFor } from "./price-ids";
import { getStripe } from "./stripe";
import { applySubscription } from "./subscription";
import "server-only";

// Changing the plan of a subscription that exists, without a new Checkout: the
// subscription at the provider is updated, with the prorations of the change
// invoiced at once (an upgrade is paid for the days left, a downgrade becomes a
// credit), and the preview shows what the change costs before it is confirmed.
// During a trial there is nothing to prorate: the plan that starts when the
// trial ends is the one that is changed.

type PlanChangePreview =
  /** In a trial: nothing is charged, the new plan starts when the trial ends. */
  | { kind: "trial"; startsAt: Date }
  /** A running subscription: `dueNow` is invoiced at once (minor units, 0 or less when the change is a credit). */
  | { kind: "proration"; dueNow: number; currency: string; prorationDate: number; nextRenewal: Date | null };

async function currentSubscription(orgId: string) {
  const row = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, orgId) });
  if (!row?.stripeSubscriptionId || !isLiveStatus(row.status)) {
    throw new ActionRefusal("no_subscription");
  }

  return { row, stripeSubscriptionId: row.stripeSubscriptionId };
}

function targetPrice(planId: string, interval: BillingInterval, row: { planId: string; billingInterval: string | null }) {
  const plan = getPlanById(planId);
  if (!plan || !isPaidPlan(plan)) {
    throw new ActionRefusal("unknown_plan");
  }
  const priceId = priceIdFor(plan.id, interval);
  if (!priceId) {
    throw new ActionRefusal("price_missing");
  }
  const sameInterval = (row.billingInterval === "year") === (interval === "yearly");
  if (row.planId === plan.id && sameInterval) {
    throw new ActionRefusal("same_plan");
  }

  return priceId;
}

/** How long the date of a preview can be used for the charge that follows it. */
const PREVIEW_VALID_SECONDS = 15 * 60;

/** What changing to a plan and an interval would cost, read at the provider: nothing is changed. */
export async function previewPlanChange(orgId: string, planId: string, interval: BillingInterval): Promise<PlanChangePreview> {
  const { row, stripeSubscriptionId } = await currentSubscription(orgId);
  const priceId = targetPrice(planId, interval, row);
  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = current.items.data[0];
  if (!item) {
    throw new ActionRefusal("no_subscription");
  }

  if (current.status === "trialing" && current.trial_end) {
    return { kind: "trial", startsAt: new Date(current.trial_end * 1000) };
  }

  const prorationDate = Math.floor(Date.now() / 1000);
  const invoice = await stripe.invoices.createPreview({
    customer: typeof current.customer === "string" ? current.customer : current.customer.id,
    subscription: current.id,
    subscription_details: {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "always_invoice",
      proration_date: prorationDate,
    },
  });

  return {
    kind: "proration",
    dueNow: invoice.amount_due,
    currency: invoice.currency,
    prorationDate,
    nextRenewal: item.current_period_end ? new Date(item.current_period_end * 1000) : null,
  };
}

/**
 * Moves the subscription to another plan or interval. The proration date of the
 * preview is the one used, so that what is charged is what was shown. The row is
 * written from the provider's answer at once (the webhook writes it again, to the
 * same result).
 */
export async function changePlan(orgId: string, planId: string, interval: BillingInterval, prorationDate?: number): Promise<void> {
  const { row, stripeSubscriptionId } = await currentSubscription(orgId);
  const priceId = targetPrice(planId, interval, row);
  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = current.items.data[0];
  if (!item) {
    throw new ActionRefusal("no_subscription");
  }

  // The date of a preview is what the charge is computed on: it is taken only when it is recent, not in the future and
  // inside the period in course, so that no one picks a date that makes a change cheaper. Otherwise the preview is asked again
  const now = Math.floor(Date.now() / 1000);
  const validDate =
    prorationDate !== undefined &&
    prorationDate <= now &&
    prorationDate >= now - PREVIEW_VALID_SECONDS &&
    prorationDate >= (item.current_period_start ?? 0);
  if (prorationDate !== undefined && !validDate) {
    throw new ActionRefusal("stale_preview");
  }

  const trialing = current.status === "trialing";
  const updated = await stripe.subscriptions.update(current.id, {
    items: [{ id: item.id, price: priceId }],
    metadata: { ...current.metadata, planId },
    // In a trial nothing is prorated: the new plan is the one that starts when it ends
    proration_behavior: trialing ? "none" : "always_invoice",
    ...(trialing || !prorationDate ? {} : { proration_date: prorationDate }),
  });

  await applySubscription(updated);
}

/**
 * Cancels the subscription at the end of the period that is paid for, or takes
 * the cancellation back: the workspace keeps its plan until then, and no more is
 * charged. Nothing is refunded. In a trial the period is the trial: nothing is
 * ever charged.
 */
export async function setCancelAtPeriodEnd(orgId: string, cancel: boolean): Promise<void> {
  const { stripeSubscriptionId } = await currentSubscription(orgId);
  const updated = await getStripe().subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: cancel });

  await applySubscription(updated);
}
