import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { notification, subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { getStripe } from "./stripe";

function generateId() {
  return crypto.randomUUID();
}

async function getOrgIdFromSubscription(
  stripeSubscription: Stripe.Subscription
): Promise<string | null> {
  return (
    (stripeSubscription.metadata?.orgId as string | undefined) ?? null
  );
}

async function notifyOrgOwner(orgId: string, title: string, body: string) {
  // Find owner of the org to send notification
  const member = await db.query.organizationMember?.findFirst({
    where: (m, { and, eq: eqOp }) =>
      and(eqOp(m.organizationId, orgId), eqOp(m.role, "owner")),
  });

  if (member) {
    await db.insert(notification).values({
      id: generateId(),
      userId: member.userId,
      title,
      body,
      type: "billing",
    });
  }
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

  if (existing) {
    await db
      .update(subscription)
      .set({
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        status: "active",
        planId,
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        updatedAt: new Date(),
      })
      .where(eq(subscription.organizationId, orgId));
  } else {
    await db.insert(subscription).values({
      id: generateId(),
      organizationId: orgId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
      status: "active",
      planId,
      currentPeriodEnd: new Date(
        stripeSubscription.current_period_end * 1000
      ),
    });
  }

  await notifyOrgOwner(
    orgId,
    "Subscription activated",
    `Your organization has been upgraded to the ${planId} plan.`
  );
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = invoice.subscription as string | null;
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

    await notifyOrgOwner(
      sub.organizationId,
      "Payment successful",
      "Your subscription payment has been processed successfully."
    );
  }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = invoice.subscription as string | null;
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

    await notifyOrgOwner(
      sub.organizationId,
      "Payment failed",
      "Your subscription payment has failed. Please update your payment method."
    );
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
        stripeSubscription.current_period_end * 1000
      ),
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId));

  await notifyOrgOwner(
    orgId,
    "Subscription updated",
    `Your plan has been changed to ${planId}.`
  );
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

  await notifyOrgOwner(
    orgId,
    "Subscription cancelled",
    "Your subscription has been cancelled. You are now on the Free plan."
  );
}
