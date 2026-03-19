import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { emitEvent } from "@/features/events/emitter";
import { subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { getStripe } from "./stripe";

async function getOrgIdFromSubscription(
  stripeSubscription: Stripe.Subscription
): Promise<string | null> {
  return (
    (stripeSubscription.metadata?.orgId as string | undefined) ?? null
  );
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const orgId = session.metadata?.orgId;
  if (!orgId || !session.subscription) return;

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

  await db
    .update(subscription)
    .set({
      status: stripeSubscription.status === "active" ? "active" : "past_due",
      planId,
      currentPeriodEnd: new Date(
        stripeSubscription.items.data[0].current_period_end * 1000
      ),
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId));

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

  await db
    .update(subscription)
    .set({
      status: "canceled",
      planId: "free",
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId));

  await emitEvent("subscription.cancelled", {
    orgId,
    resourceType: "subscription",
    resourceId: orgId,
  });
}
