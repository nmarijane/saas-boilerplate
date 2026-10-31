"use server";

import { z } from "zod";
import { requireRole } from "@/features/auth/guards";
import { createCheckoutSession, createPortalSession, getSubscriptionForOrg } from "./helpers";
import { PLANS } from "./plans";

// Client-callable wrappers of ./helpers. They check the role first and only
// return what the UI needs: never the Stripe session or subscription records.

const priceIdSchema = z
  .string()
  .refine(
    (priceId) => PLANS.some((plan) => priceId !== "" && (plan.stripePriceId.monthly === priceId || plan.stripePriceId.yearly === priceId)),
    "Unknown price",
  );

export async function createCheckoutSessionAction(orgId: string, priceId: string) {
  await requireRole(orgId, "admin");
  const price = priceIdSchema.parse(priceId);

  const session = await createCheckoutSession(orgId, price);
  return { url: session.url };
}

export async function createPortalSessionAction(orgId: string) {
  await requireRole(orgId, "admin");

  const session = await createPortalSession(orgId);
  return { url: session.url };
}

export async function getSubscriptionAction(orgId: string) {
  await requireRole(orgId, "member");

  const { planId, status } = await getSubscriptionForOrg(orgId);
  return { planId, status };
}
