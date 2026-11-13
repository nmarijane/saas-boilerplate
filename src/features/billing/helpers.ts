import { eq } from "drizzle-orm";
import { plan, subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { env } from "@/shared/lib/env";
import { getPlanById } from "./plans";
import { getStripe } from "./stripe";
import "server-only";

export async function createCheckoutSession(
  orgId: string,
  priceId: string,
  successUrl?: string,
  cancelUrl?: string
) {
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      metadata: { orgId },
    });
    customerId = customer.id;
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl ?? `${appUrl}/settings/billing?success=true`,
    cancel_url: cancelUrl ?? `${appUrl}/settings/billing?canceled=true`,
    metadata: { orgId },
    subscription_data: {
      metadata: { orgId },
    },
  });

  return session;
}

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
  });

  return session;
}

export async function checkPlanLimit(
  orgId: string,
  feature: string
): Promise<{ allowed: boolean; limit: number; current?: number }> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  if (!sub) {
    // No subscription = free plan
    const freePlan = getPlanById("free");
    const limit = freePlan?.limits[feature] ?? 0;
    return { allowed: limit === -1 || limit > 0, limit };
  }

  const currentPlan = await db.query.plan.findFirst({
    where: eq(plan.id, sub.planId),
  });

  if (!currentPlan) {
    return { allowed: false, limit: 0 };
  }

  const limits = currentPlan.limits as Record<string, number> | null;
  const limit = limits?.[feature] ?? 0;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1 };
  }

  return { allowed: limit > 0, limit };
}

export async function getSubscriptionForOrg(orgId: string) {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  if (!sub) {
    return { planId: "free", status: "active" as const, subscription: null };
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
 */
export async function cancelAtProvider(stripeSubscriptionId: string): Promise<void> {
  try {
    await getStripe().subscriptions.cancel(stripeSubscriptionId);
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
  await db
    .update(subscription)
    .set({ status: "canceled", planId: "free", updatedAt: new Date() })
    .where(eq(subscription.id, sub.id));
  return true;
}
