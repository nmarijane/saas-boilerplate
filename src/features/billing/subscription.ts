import type Stripe from "stripe";
import type { BillingInterval } from "./plans";
import { and, eq, isNull } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { emitEvent } from "@/features/events/emitter";
import { auditLog, organization, organizationMember, subscription, user } from "@/models";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { cancelAtProvider } from "./helpers";
import { ensurePlanRow } from "./plan-rows";
import { getFreePlan, getPlanById, isLiveStatus } from "./plans";
import { planForPriceId } from "./price-ids";
import { getStripe } from "./stripe";
import "server-only";

// What the payment provider says about a subscription, written into the one row
// a workspace has. Every event that touches a subscription ends here, and it
// reads the subscription at the provider instead of trusting the event: events
// arrive twice, late and out of order, and the subscription as the provider
// holds it now is the one answer that is right whatever the order was.

/** The person who owns a workspace: who gets the mails about its subscription, and whose trial it is. */
export async function getWorkspaceOwner(orgId: string): Promise<{ id: string; name: string; email: string } | null> {
  const [owner] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(and(eq(organizationMember.organizationId, orgId), eq(organizationMember.role, "owner")))
    .limit(1);

  return owner ?? null;
}

/**
 * Spends the free trial of a person, once: the write is conditional, so that of
 * two checkouts that complete at the same time one wins and the other is told it
 * did not. True when this call is the one that used the trial.
 */
export async function claimTrial(userId: string, stripeSubscriptionId: string): Promise<boolean> {
  const claimed = await db
    .update(user)
    .set({ trialUsedAt: new Date(), trialSubscriptionId: stripeSubscriptionId })
    .where(and(eq(user.id, userId), isNull(user.trialUsedAt)))
    .returning();
  if (claimed.length > 0) {
    return true;
  }

  // The trial was spent: by this very subscription (an event delivered again), or by another one
  const [owner] = await db.select({ spentBy: user.trialSubscriptionId }).from(user).where(eq(user.id, userId)).limit(1);

  return owner?.spentBy === stripeSubscriptionId;
}

/** The comment a subscription is cancelled with when its owner had their free trial already: what the page that waits for its payment reads. */
export const TRIAL_SPENT_REASON = "trial_already_used";

/** Gives a trial back to the person it was claimed for, when the subscription that claimed it came to nothing (it was cancelled as a duplicate). */
export async function releaseTrial(userId: string, stripeSubscriptionId: string): Promise<void> {
  await db
    .update(user)
    .set({ trialUsedAt: null, trialSubscriptionId: null })
    .where(and(eq(user.id, userId), eq(user.trialSubscriptionId, stripeSubscriptionId)));
}

/** Whether the workspace holds a live subscription other than this one, as its row says. */
export async function holdsOtherLiveSubscription(orgId: string, stripeSubscriptionId: string): Promise<boolean> {
  const existing = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, orgId) });

  return Boolean(existing?.stripeSubscriptionId && existing.stripeSubscriptionId !== stripeSubscriptionId && isLiveStatus(existing.status));
}

/** The interval of a subscription: its price in the catalog says it, and the recurrence of the price when the catalog does not know it. */
function intervalOf(item: Stripe.SubscriptionItem | undefined, known: BillingInterval | undefined): BillingInterval | null {
  if (known) {
    return known;
  }
  const recurring = item?.price.recurring?.interval;
  if (recurring === "year") {
    return "yearly";
  }

  return recurring === "month" ? "monthly" : null;
}

/**
 * Cancels at once the subscription of a checkout paid for a workspace that was
 * deleted since it began (it lasts a day): it would renew every month for a
 * workspace that is gone, and nothing in the app could reach it any more. Only
 * when the app deleted that workspace itself, as the record of the deletion in
 * its audit log says: the `orgId` is the app's own metadata, and a Stripe account
 * may also sell other things, or serve another copy of the app (a staging, a
 * laptop forwarding the events), whose workspaces are not this app's to know.
 * Refunding the first payment is the operator's call. A second delivery finds
 * the subscription cancelled, and is answered as the first.
 */
export async function cancelOrphanSubscription(orgId: string, stripeSubscriptionId: string): Promise<void> {
  const [deletion] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.action, "organization.deleted"), eq(auditLog.resourceId, orgId), isNull(auditLog.orgId)))
    .limit(1);
  if (!deletion) {
    return;
  }

  await cancelAtProvider(stripeSubscriptionId);
}

/** Whether the provider says it knows no such object. */
function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "resource_missing";
}

type SyncOutcome = "applied" | "ignored" | "duplicate";

/**
 * Writes a subscription, as the provider holds it, into the row of its
 * workspace, and says what changed (an event of the app, for the audit log, the
 * notifications and the webhooks) only when something did: delivered twice, the
 * second time changes nothing and says nothing.
 *
 * The workspace is the `orgId` the app put in the metadata of the subscription
 * when it opened the checkout. A subscription with none is not the app's (the
 * account sells other things): it is left alone. A workspace that is gone has
 * its subscription cancelled (`cancelOrphanSubscription`).
 */
export async function applySubscription(stripeSubscription: Stripe.Subscription): Promise<SyncOutcome> {
  const orgId = stripeSubscription.metadata?.orgId;
  if (!orgId) {
    return "ignored";
  }

  // Read and written with the workspace held: a checkout that completes and the event of its subscription arrive
  // within milliseconds of each other, and two writers that both found no row would make two
  const written = await db.transaction(async (tx) => {
    const [workspace] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, orgId)).for("update");
    if (!workspace) {
      return { kind: "orphan" } as const;
    }

    const existing = await tx.query.subscription.findFirst({ where: eq(subscription.organizationId, orgId) });

    // A second live subscription for a workspace that pays already (a second checkout, in another tab or by another
    // admin) is never written over the first: the provider would go on billing both. It is cancelled after the write
    // is over, and the first stays. This is decided here, under the lock, so that it does not depend on which event came first
    if (
      existing?.stripeSubscriptionId &&
      existing.stripeSubscriptionId !== stripeSubscription.id &&
      isLiveStatus(existing.status) &&
      isLiveStatus(stripeSubscription.status)
    ) {
      return { kind: "duplicate", existing } as const;
    }

    // The late `deleted` of a subscription that was replaced: the workspace has a
    // newer live one, which this event is not about
    const replaced =
      existing?.stripeSubscriptionId &&
      existing.stripeSubscriptionId !== stripeSubscription.id &&
      isLiveStatus(existing.status) &&
      !isLiveStatus(stripeSubscription.status);
    if (replaced) {
      return { kind: "ignored" } as const;
    }

    const item = stripeSubscription.items.data[0];
    const fromCatalog = planForPriceId(item?.price.id);
    const live = isLiveStatus(stripeSubscription.status);
    // The plan comes from the price of the catalog; a price that is not in it falls
    // back on what the app wrote in the metadata, then on what the row already holds
    const paidPlanId = fromCatalog?.planId ?? stripeSubscription.metadata?.planId ?? existing?.planId;
    if (live && (!paidPlanId || !getPlanById(paidPlanId))) {
      console.error(`Billing: the subscription ${stripeSubscription.id} is on a price that is not in the catalog`);
      return { kind: "ignored" } as const;
    }
    // A subscription that is over gives no plan: the workspace is back on the free one
    const planId = live ? paidPlanId! : getFreePlan().id;
    await ensurePlanRow(planId, tx);

    const periodEnd = item?.current_period_end;
    const values = {
      stripeCustomerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      planId,
      billingInterval: live ? (intervalOf(item, fromCatalog?.interval) === "yearly" ? "year" : "month") : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: live ? stripeSubscription.cancel_at_period_end : false,
      trialEnd: live && stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      locale: stripeSubscription.metadata?.locale ?? existing?.locale ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      await tx.update(subscription).set(values).where(eq(subscription.id, existing.id));
    } else {
      await tx.insert(subscription).values({ id: generateId(), organizationId: orgId, ...values });
    }

    return { kind: "written", existing, values, planId, live } as const;
  });

  if (written.kind === "orphan") {
    // A workspace that is gone has nowhere to hold a subscription
    await cancelOrphanSubscription(orgId, stripeSubscription.id);
    return "ignored";
  }
  if (written.kind === "duplicate") {
    // The row says the one in place is live; the provider is asked before the new one is given up: the one in place may
    // have ended there (cancelled from the dashboard, a payment that never came) before its event reached the app, and the
    // new one is then what the person bought. It takes the place, once the one in place is written as over.
    const inPlace = await retrieveInPlace(written.existing.stripeSubscriptionId!);
    if (!inPlace || !isLiveStatus(inPlace.status)) {
      // Written as over by its own id: its metadata may no longer name the workspace, and an event that is ignored
      // would leave the row live, and this call going round
      if (inPlace?.metadata?.orgId === orgId) {
        await applySubscription(inPlace);
      }
      await markEnded(written.existing.stripeSubscriptionId!, inPlace?.status ?? "canceled");
      return applySubscription(stripeSubscription);
    }

    await cancelAtProvider(stripeSubscription.id);
    await emitEvent("subscription.updated", {
      orgId,
      resourceType: "subscription",
      resourceId: written.existing.id,
      metadata: { planId: written.existing.planId, duplicate: stripeSubscription.id },
    });
    return "duplicate";
  }
  if (written.kind === "ignored") {
    return "ignored";
  }

  const { existing, values, planId, live } = written;
  const changed =
    !existing ||
    existing.stripeSubscriptionId !== values.stripeSubscriptionId ||
    existing.status !== values.status ||
    existing.planId !== values.planId ||
    existing.billingInterval !== values.billingInterval ||
    existing.cancelAtPeriodEnd !== values.cancelAtPeriodEnd;
  if (!changed) {
    return "applied";
  }

  const wasLive = existing ? isLiveStatus(existing.status) && existing.stripeSubscriptionId !== null : false;
  const resourceId = existing?.id ?? orgId;
  if (!live) {
    // Only a subscription that was live is cancelled: an `incomplete` one that expires never was
    if (wasLive) {
      await emitEvent("subscription.cancelled", { orgId, resourceType: "subscription", resourceId });
    }
  } else if (!wasLive) {
    await emitEvent("subscription.created", { orgId, resourceType: "subscription", resourceId, metadata: { planId } });
  } else {
    await emitEvent("subscription.updated", { orgId, resourceType: "subscription", resourceId, metadata: { planId } });
  }

  return "applied";
}

/** The subscription that holds the place of a workspace, as the provider has it now; null when the provider no longer has it. */
async function retrieveInPlace(stripeSubscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await getStripe().subscriptions.retrieve(stripeSubscriptionId);
  } catch (error) {
    unstable_rethrow(error);
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads a subscription at the provider and applies it. A subscription the
 * provider no longer has is over: the row that points at it is marked so.
 */
export async function syncSubscription(stripeSubscriptionId: string): Promise<SyncOutcome> {
  try {
    const stripeSubscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
    return await applySubscription(stripeSubscription);
  } catch (error) {
    unstable_rethrow(error);
    if (!isMissing(error)) {
      throw error;
    }
  }

  return (await markEnded(stripeSubscriptionId, "canceled")) ? "applied" : "ignored";
}

/** Writes the row that holds this subscription as over, back on the free plan; false when no row holds it. */
async function markEnded(stripeSubscriptionId: string, status: string): Promise<boolean> {
  await ensurePlanRow(getFreePlan().id);
  const updated = await db
    .update(subscription)
    .set({ status, planId: getFreePlan().id, billingInterval: null, cancelAtPeriodEnd: false, trialEnd: null, updatedAt: new Date() })
    .where(eq(subscription.stripeSubscriptionId, stripeSubscriptionId))
    .returning();

  return updated.length > 0;
}
