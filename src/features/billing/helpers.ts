"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireOrgRole } from "@/features/auth/guards";
import { plan, subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { env } from "@/shared/lib/env";
import { getPlanById } from "./plans";
import { getStripe } from "./stripe";

export async function createCheckoutSession(
  orgId: string,
  planId: string,
  interval: "monthly" | "yearly" = "monthly",
) {
  const parsed = z
    .object({
      orgId: z.string().min(1),
      planId: z.string().min(1),
      interval: z.enum(["monthly", "yearly"]),
    })
    .parse({ orgId, planId, interval });
  await requireOrgRole(parsed.orgId, "admin");

  const selectedPlan = getPlanById(parsed.planId);
  const priceId = selectedPlan?.stripePriceId[parsed.interval];
  if (!selectedPlan || selectedPlan.id === "free" || !priceId) {
    throw new Error("This plan is not available for checkout");
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      metadata: { orgId: parsed.orgId },
    });
    customerId = customer.id;
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?success=true`,
    cancel_url: `${appUrl}/settings/billing?canceled=true`,
    metadata: {
      orgId: parsed.orgId,
      planId: selectedPlan.id,
      interval: parsed.interval,
    },
    subscription_data: {
      metadata: { orgId: parsed.orgId },
    },
  });

  return session;
}

export async function createPortalSession(orgId: string) {
  await requireOrgRole(orgId, "admin");
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
  await requireOrgRole(orgId, "member");
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
  await requireOrgRole(orgId, "member");
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
