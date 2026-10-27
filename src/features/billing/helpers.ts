"use server";

import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { requireOrgRole } from "@/features/auth/guards";
import { subscription } from "@/models";
import { organizationMember } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { env } from "@/shared/lib/env";
import { getFreePlan, getPlanById } from "./plans";
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

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

// Plans are defined in code (plans.ts); the DB only stores which plan an org is on.
async function getEffectivePlan(orgId: string) {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });
  const paid = sub && PAID_STATUSES.has(sub.status) ? getPlanById(sub.planId) : undefined;
  return paid ?? getFreePlan();
}

export async function checkPlanLimit(
  orgId: string,
  feature: string,
  current = 0,
): Promise<{ allowed: boolean; limit: number; current: number }> {
  await requireOrgRole(orgId, "member");
  const limit = (await getEffectivePlan(orgId)).limits[feature] ?? 0;
  // -1 means unlimited
  return { allowed: limit === -1 || current < limit, limit, current };
}

export async function assertCanAddMember(orgId: string) {
  await requireOrgRole(orgId, "admin");
  const [row] = await db
    .select({ n: count() })
    .from(organizationMember)
    .where(eq(organizationMember.organizationId, orgId));
  const result = await checkPlanLimit(orgId, "members", row?.n ?? 0);
  if (!result.allowed) {
    throw new Error("Member limit reached for your plan. Upgrade to add more.");
  }
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
