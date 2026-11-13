import type Stripe from "stripe";
import { and, eq, isNull } from "drizzle-orm";
import { emitEvent } from "@/features/events/emitter";
import { auditLog, organization, subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { cancelAtProvider } from "./helpers";
import { getStripe } from "./stripe";

async function getOrgIdFromSubscription(
  stripeSubscription: Stripe.Subscription
): Promise<string | null> {
  return (
    (stripeSubscription.metadata?.orgId as string | undefined) ?? null
  );
}

/**
 * Cancels at once the subscription of a checkout paid for a workspace that was
 * deleted since it began (it lasts a day): it would renew every month for a
 * workspace that is gone, and nothing in the app could reach it any more. Only
 * when the app deleted that workspace itself, as the record of the deletion in
 * its audit log says: the session's `orgId` is the app's own metadata, and a
 * Stripe account may also sell other things, or serve another copy of the app
 * (a staging, a laptop forwarding the events), whose workspaces are not this
 * app's to know. Refunding the first payment is the operator's call. Stripe
 * delivers an event at least once: a second delivery finds the subscription
 * cancelled, and is answered as the first.
 */
async function cancelOrphanSubscription(orgId: string, stripeSubscriptionId: string) {
  const [deletion] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.action, "organization.deleted"), eq(auditLog.resourceId, orgId), isNull(auditLog.orgId)))
    .limit(1);
  if (!deletion) return;

  await cancelAtProvider(stripeSubscriptionId);
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const orgId = session.metadata?.orgId;
  if (!orgId || !session.subscription) return;

  // A workspace that was deleted since the checkout began has nowhere to hold a
  // subscription: nothing is written, nor told, and the provider is answered as
  // usual, rather than with an error it would send again for days
  const workspace = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });
  if (!workspace) {
    await cancelOrphanSubscription(orgId, session.subscription as string);
    return;
  }

  const stripeSubscription = await getStripe().subscriptions.retrieve(
    session.subscription as string
  );

  const priceId = stripeSubscription.items.data[0]?.price.id;

  // Find the plan matching this price
  const plan = await db.query.plan?.findFirst({
    where: (p, { eq: eqOp }) => eqOp(p.stripePriceId, priceId ?? ""),
  });

  const planId = plan?.id ?? "pro";

  // Check if a subscription record already exists
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  const newId = generateId();

  if (existing) {
    await db
      .update(subscription)
      .set({
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        status: "active",
        planId,
        currentPeriodEnd: new Date(
          stripeSubscription.items.data[0].current_period_end * 1000
        ),
        updatedAt: new Date(),
      })
      .where(eq(subscription.organizationId, orgId));
  } else {
    await db.insert(subscription).values({
      id: newId,
      organizationId: orgId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
      status: "active",
      planId,
      currentPeriodEnd: new Date(
        stripeSubscription.items.data[0].current_period_end * 1000
      ),
    });
  }

  await emitEvent("subscription.created", {
    orgId,
    resourceType: "subscription",
    resourceId: existing?.id ?? newId,
    metadata: { planId },
  });
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = invoice.parent?.subscription_details?.subscription as string | null;
  if (!stripeSubscriptionId) return;

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, stripeSubscriptionId),
  });

  if (sub) {
    await db
      .update(subscription)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(subscription.stripeSubscriptionId, stripeSubscriptionId));

    await emitEvent("payment.succeeded", {
      orgId: sub.organizationId,
      resourceType: "subscription",
      resourceId: sub.id,
    });
  }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = invoice.parent?.subscription_details?.subscription as string | null;
  if (!stripeSubscriptionId) return;

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, stripeSubscriptionId),
  });

  if (sub) {
    await db
      .update(subscription)
      .set({
        status: "past_due",
        updatedAt: new Date(),
      })
      .where(eq(subscription.stripeSubscriptionId, stripeSubscriptionId));

    await emitEvent("payment.failed", {
      orgId: sub.organizationId,
      resourceType: "subscription",
      resourceId: sub.id,
    });
  }
}

export async function handleSubscriptionUpdated(
  stripeSubscription: Stripe.Subscription
) {
  const orgId = await getOrgIdFromSubscription(stripeSubscription);
  if (!orgId) return;

  const priceId = stripeSubscription.items.data[0]?.price.id;

  const plan = await db.query.plan?.findFirst({
    where: (p, { eq: eqOp }) => eqOp(p.stripePriceId, priceId ?? ""),
  });

  const planId = plan?.id ?? "pro";

  const updated = await db
    .update(subscription)
    .set({
      status: stripeSubscription.status === "active" ? "active" : "past_due",
      planId,
      currentPeriodEnd: new Date(
        stripeSubscription.items.data[0].current_period_end * 1000
      ),
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId))
    .returning();

  // No subscription of the workspace here (it was deleted, and its rows with it): nothing to tell
  if (updated.length === 0) return;

  await emitEvent("subscription.updated", {
    orgId,
    resourceType: "subscription",
    resourceId: orgId,
    metadata: { planId },
  });
}

export async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription
) {
  const orgId = await getOrgIdFromSubscription(stripeSubscription);
  if (!orgId) return;

  const updated = await db
    .update(subscription)
    .set({
      status: "canceled",
      planId: "free",
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId))
    .returning();

  // A workspace that was deleted had its subscription cancelled first: it is
  // gone, with its rows, and there is no one left to tell
  if (updated.length === 0) return;

  await emitEvent("subscription.cancelled", {
    orgId,
    resourceType: "subscription",
    resourceId: orgId,
  });
}
