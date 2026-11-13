import type { BillingInterval } from "./plans";
import { env } from "@/shared/lib/env";
import { getCreditPack } from "./credit-packs";
import { PLANS } from "./plans";
import "server-only";

// The Stripe price ids of the catalog, read from the environment: the one place
// that knows them. The browser never sends a price id (it sends a plan and an
// interval, or a pack), so a price that is not one of ours cannot be asked for;
// and a price id that arrives from Stripe is turned back into a plan here.

// Read when asked, not when the module loads: the environment is validated first
function planPrices(): Record<string, Record<BillingInterval, string>> {
  return {
    pro: { monthly: env.STRIPE_PRICE_PRO_MONTHLY, yearly: env.STRIPE_PRICE_PRO_YEARLY },
    enterprise: { monthly: env.STRIPE_PRICE_ENTERPRISE_MONTHLY, yearly: env.STRIPE_PRICE_ENTERPRISE_YEARLY },
  };
}

function packPrices(): Record<string, string> {
  return {
    "credits-1000": env.STRIPE_PRICE_CREDITS_1000,
    "credits-5000": env.STRIPE_PRICE_CREDITS_5000,
  };
}

/** The Stripe price of a plan at an interval; null when the catalog was not set up for it. */
export function priceIdFor(planId: string, interval: BillingInterval): string | null {
  return planPrices()[planId]?.[interval] || null;
}

/** The Stripe price of a credit pack; null when it is not set up. */
export function packPriceId(packId: string): string | null {
  return getCreditPack(packId) ? packPrices()[packId] || null : null;
}

/** The plan and interval a Stripe price stands for, or null for a price that is not the catalog's. */
export function planForPriceId(priceId: string | undefined | null): { planId: string; interval: BillingInterval } | null {
  if (!priceId) {
    return null;
  }

  const prices = planPrices();
  for (const plan of PLANS) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (prices[plan.id]?.[interval] === priceId) {
        return { planId: plan.id, interval };
      }
    }
  }

  return null;
}
