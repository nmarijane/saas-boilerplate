import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { addPackCredits } from "@/features/ai/service";
import { emitEvent } from "@/features/events/emitter";
import { organization, subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { getCreditPack } from "./credit-packs";
import { cancelAtProvider } from "./helpers";
import { mailWorkspaceOwner } from "./mail";
import { getPlanById, isLiveStatus } from "./plans";
import { getStripe } from "./stripe";
import {
  applySubscription,
  cancelOrphanSubscription,
  claimTrial,
  getWorkspaceOwner,
  holdsOtherLiveSubscription,
  releaseTrial,
  syncSubscription,
  TRIAL_SPENT_REASON,
} from "./subscription";
import "server-only";

// What each event of the payment provider does. They are called by the webhook
// route, once per event (the route claims the event first), and they are written
// to be safe all the same if one ran twice or in another order: a subscription
// is read at the provider and written whole (`syncSubscription`), a pack is
// credited once by a unique row, an e-mail follows a state that actually changed.

/** The id of what an event points at, whether the provider sent it expanded or not. */
function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

/** The row of a workspace's subscription, or null. */
async function rowOfSubscription(stripeSubscriptionId: string) {
  return (await db.query.subscription.findFirst({ where: eq(subscription.stripeSubscriptionId, stripeSubscriptionId) })) ?? null;
}

/**
 * A checkout that completed. For a subscription it is the first read of it: the
 * subscription is written, and the free trial it started is spent for the owner
 * of the workspace (a conditional write: of two checkouts that complete at once,
 * one spends it, the other is not given a second). For a pack of credits it is
 * the credit, once the payment is paid (a payment that settles later is
 * credited by `checkout.session.async_payment_succeeded`).
 */
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.orgId;
  if (!orgId) {
    return;
  }

  if (session.mode === "payment") {
    await creditPack(session);
    return;
  }

  const stripeSubscriptionId = idOf(session.subscription);
  if (session.mode !== "subscription" || !stripeSubscriptionId) {
    return;
  }

  // A workspace that was deleted since the checkout began has nowhere to hold a subscription: nothing is
  // written, nor told, and the provider is answered as usual, rather than with an error it would send again
  const workspace = await db.query.organization.findFirst({ where: eq(organization.id, orgId) });
  if (!workspace) {
    await cancelOrphanSubscription(orgId, stripeSubscriptionId);
    return;
  }

  const stripeSubscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);

  // A trial is spent once per owner, and claimed before anything is written: a workspace never shows a plan that is
  // cancelled the next moment. One that holds a live subscription already is no case for it (the second is cancelled below)
  const owner = stripeSubscription.status === "trialing" ? await getWorkspaceOwner(orgId) : null;
  let claimed = false;
  if (owner && !(await holdsOtherLiveSubscription(orgId, stripeSubscription.id))) {
    if (!(await claimTrial(owner.id, stripeSubscription.id))) {
      await refuseSpentTrial(orgId, stripeSubscription.id);
      return;
    }
    claimed = true;
  }

  // A second subscription of a workspace that pays is cancelled there, with no trial of its own to spend
  const outcome = await applySubscription(stripeSubscription);
  if (outcome === "duplicate") {
    if (owner && claimed) {
      await releaseTrial(owner.id, stripeSubscription.id);
    }
    return;
  }

  // The one in place had ended at the provider, and this one took its place: the trial was not claimed above
  if (owner && !claimed && !(await claimTrial(owner.id, stripeSubscription.id))) {
    await refuseSpentTrial(orgId, stripeSubscription.id);
  }
}

/**
 * The owner had their free trial already, on another workspace, and this checkout was sold to them as a trial. Nothing is
 * charged: the subscription is cancelled at the provider before its trial ends, the workspace stays on the free plan, and
 * the event is told. The page that waits for the payment says why, and leads to the plans.
 */
async function refuseSpentTrial(orgId: string, stripeSubscriptionId: string) {
  await cancelAtProvider(stripeSubscriptionId, TRIAL_SPENT_REASON);
  // What an event that came first wrote (a subscription is written as soon as the provider tells of it) follows the cancellation
  await syncSubscription(stripeSubscriptionId);
  await emitEvent("subscription.updated", {
    orgId,
    resourceType: "subscription",
    resourceId: orgId,
    metadata: { trialAlreadyUsed: stripeSubscriptionId },
  });
}

/** A payment that settled after the checkout (a bank debit): the pack is credited now. */
export async function handleCheckoutAsyncPaymentSucceeded(session: Stripe.Checkout.Session) {
  if (session.mode === "payment") {
    await creditPack(session);
  }
}

async function creditPack(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.orgId;
  const pack = getCreditPack(session.metadata?.packId ?? "");
  // Only the app's own packs, and only once they are paid: the credits come from the catalog, never from the metadata
  if (!orgId || session.metadata?.kind !== "credit_pack" || !pack || session.payment_status !== "paid") {
    return;
  }

  const workspace = await db.query.organization.findFirst({ where: eq(organization.id, orgId) });
  if (!workspace) {
    // Paid for a workspace that is gone: nothing to credit, and the refund is the operator's call
    console.error(`Billing: the pack of checkout ${session.id} was paid for a workspace that no longer exists`);
    return;
  }

  await addPackCredits(orgId, pack.credits, session.id);
}

/** A subscription that was created, changed or ended: it is read at the provider and written. */
export async function handleSubscriptionChanged(stripeSubscription: Stripe.Subscription) {
  const before = await rowOfSubscription(stripeSubscription.id);
  const outcome = await syncSubscription(stripeSubscription.id);
  if (outcome !== "applied" || !before || !isLiveStatus(before.status)) {
    return;
  }

  const after = await rowOfSubscription(stripeSubscription.id);
  const plan = getPlanById(before.planId);
  // A subscription that ended after it was live: the owner is told, with the date the plan was paid until
  if (after?.status === "canceled" && plan) {
    await mailWorkspaceOwner(
      before.organizationId,
      { kind: "subscriptionCancelled", planName: plan.name, endsAt: before.currentPeriodEnd },
      before.locale,
    );
  }
}

/** Three days before a trial ends: the owner is told, so that no one is charged by surprise. */
export async function handleTrialWillEnd(stripeSubscription: Stripe.Subscription) {
  const row = await rowOfSubscription(stripeSubscription.id);
  const plan = row ? getPlanById(row.planId) : undefined;
  if (!row || !plan || !stripeSubscription.trial_end) {
    return;
  }

  await mailWorkspaceOwner(
    row.organizationId,
    { kind: "trialEnding", planName: plan.name, endsAt: new Date(stripeSubscription.trial_end * 1000) },
    row.locale,
  );
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = subscriptionIdOfInvoice(invoice);
  if (!stripeSubscriptionId) {
    return;
  }

  await syncSubscription(stripeSubscriptionId);
  const row = await rowOfSubscription(stripeSubscriptionId);
  if (!row) {
    return;
  }

  await emitEvent("payment.succeeded", { orgId: row.organizationId, resourceType: "subscription", resourceId: row.id });

  // The invoice of a trial is for nothing: there is no payment to confirm
  const plan = getPlanById(row.planId);
  if (invoice.amount_paid > 0 && plan) {
    await mailWorkspaceOwner(
      row.organizationId,
      { kind: "paymentSuccess", planName: plan.name, amount: { minor: invoice.amount_paid, currency: invoice.currency } },
      row.locale,
    );
  }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = subscriptionIdOfInvoice(invoice);
  if (!stripeSubscriptionId) {
    return;
  }

  await syncSubscription(stripeSubscriptionId);
  const row = await rowOfSubscription(stripeSubscriptionId);
  if (!row) {
    return;
  }

  await emitEvent("payment.failed", { orgId: row.organizationId, resourceType: "subscription", resourceId: row.id });

  // A first payment that is refused leaves the subscription incomplete, on the free plan: there is no plan to name
  const plan = getPlanById(row.planId);
  if (plan && isLiveStatus(row.status)) {
    await mailWorkspaceOwner(row.organizationId, { kind: "paymentFailed", planName: plan.name }, row.locale);
  }
}
