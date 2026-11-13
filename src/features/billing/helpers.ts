import { eq } from "drizzle-orm";
import { subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { env } from "@/shared/lib/env";
import { ensurePlanRow } from "./plan-rows";
import { getFreePlan } from "./plans";
import { getStripe } from "./stripe";
import "server-only";

export async function createPortalSession(orgId: string) {
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  if (!sub?.stripeCustomerId) {
    throw new Error("No Stripe customer found for this organization");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/settings/billing`,
    // The portal of the app (payment method and invoices); the account's default one may let anyone cancel
    ...(env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: env.STRIPE_PORTAL_CONFIGURATION_ID } : {}),
  });

  return session;
}

export async function getSubscriptionForOrg(orgId: string) {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  if (!sub) {
    return { planId: getFreePlan().id, status: "active" as const, subscription: null };
  }

  return {
    planId: sub.planId,
    status: sub.status,
    subscription: sub,
  };
}

/** Whether the payment provider says it knows no such object: a subscription it does not have is not live there. */
function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "resource_missing";
}

/** Whether the payment provider reads the subscription cancelled; not when it cannot be read. */
async function isCancelledThere(stripeSubscriptionId: string): Promise<boolean> {
  try {
    return (await getStripe().subscriptions.retrieve(stripeSubscriptionId)).status === "canceled";
  } catch {
    return false;
  }
}

/**
 * Cancels a subscription at the payment provider, at once. One that it no
 * longer has, or has cancelled already, is not live there: the provider refuses
 * to cancel it again (an event delivered twice, a subscription cancelled from
 * its dashboard), and that refusal is the cancel done. Any other failure throws.
 * A `reason` is written on the subscription as the comment of its cancellation.
 */
export async function cancelAtProvider(stripeSubscriptionId: string, reason?: string): Promise<void> {
  try {
    // The reason stays on the subscription, where the page that waits for the payment reads why nothing was bought
    await (reason ? getStripe().subscriptions.cancel(stripeSubscriptionId, { cancellation_details: { comment: reason } }) : getStripe().subscriptions.cancel(stripeSubscriptionId));
  } catch (error) {
    if (isMissing(error) || (await isCancelledThere(stripeSubscriptionId))) {
      return;
    }
    throw error;
  }
}

/**
 * Cancels at the payment provider, at once, the subscription of a workspace
 * that is being deleted: its rows go with the workspace, and nothing would
 * cancel it afterwards, so the person would go on paying for a workspace that
 * is gone. A workspace with no subscription there (the free plan, one never
 * paid for) has nothing to cancel, nor one whose subscription is over: the
 * provider is not asked. Once it is cancelled the row says so at once, on the
 * free plan, as the provider's webhook would have it: a deletion that a later
 * step stops, then tries again, does not ask the provider twice, and the
 * workspace it keeps has no paid credits left. It answers whether the
 * subscription of the workspace is cancelled there, by this deletion or before,
 * and throws when the provider cannot cancel it: the workspace is kept.
 */
export async function cancelWorkspaceSubscription(orgId: string): Promise<boolean> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  if (!sub?.stripeSubscriptionId) {
    return false;
  }
  if (sub.status === "canceled") {
    return true;
  }

  await cancelAtProvider(sub.stripeSubscriptionId);
  await ensurePlanRow(getFreePlan().id);
  await db
    .update(subscription)
    .set({ status: "canceled", planId: getFreePlan().id, cancelAtPeriodEnd: false, trialEnd: null, updatedAt: new Date() })
    .where(eq(subscription.id, sub.id));
  return true;
}
