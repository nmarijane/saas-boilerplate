import { CREDIT_PACKS } from "./credit-packs";
import { BILLING_INTERVALS, isPaidPlan, PLANS } from "./plans";

// What the Stripe catalog holds, derived from `PLANS` and the credit packs: the
// products and prices that `scripts/stripe-catalog.ts` creates in a test account
// (and only checks in a live one), the lookup key of each (what makes the script
// safe to run twice), and the variable of the environment that holds the id of
// each price. Plain module, so that a test reads it without Stripe.

interface CatalogPrice {
  /** The Stripe lookup key: stable, so that running the script again finds the price it made. */
  lookupKey: string;
  /** The environment variable that holds the id of the price (`.env.example`). */
  envVar: string;
  /** In the minor unit of the currency (cents). */
  unitAmount: number;
  /** A recurring price, or a one-off one (a pack of credits). */
  recurring: "month" | "year" | null;
}

interface CatalogProduct {
  /** The id the product is made with at Stripe: the same on every run. */
  id: string;
  name: string;
  /** The plan or the pack it stands for, kept in its metadata. */
  metadata: Record<string, string>;
  prices: CatalogPrice[];
}

/** The amount of a price in minor units: the major unit of the plans, times a hundred, without a float's dust. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * What the customer portal offers: the payment method and the invoices. Cancelling
 * and changing plan are done in the app, where the role of the person is checked
 * (only the owner cancels), so the portal offers neither.
 */
export function portalFeatures() {
  return {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["email", "name", "address", "tax_id"] as ("email" | "name" | "address" | "tax_id")[] },
    subscription_cancel: { enabled: false },
    subscription_update: { enabled: false },
  };
}

/** What a portal configuration holds of what the app asks of it: the part of `features` that is compared. */
interface PortalFeaturesRead {
  [feature: string]: { enabled?: boolean; allowed_updates?: string[] | null } | undefined;
}

/**
 * The features of an existing portal configuration that differ from `portalFeatures()`: the ones switched on or off the
 * other way, and the fields the customer may update. Empty when the portal is what the app expects (cancelling and
 * changing plan are the app's, so a portal that offers them is one to put right).
 */
export function portalDrift(found: PortalFeaturesRead): string[] {
  const expected = portalFeatures() as Record<string, { enabled: boolean; allowed_updates?: string[] }>;

  return Object.entries(expected)
    .filter(([name, wanted]) => {
      const actual = found[name];
      if ((actual?.enabled ?? false) !== wanted.enabled) {
        return true;
      }

      return wanted.enabled && [...(actual?.allowed_updates ?? [])].sort().join() !== [...(wanted.allowed_updates ?? [])].sort().join();
    })
    .map(([name]) => name);
}

export function planCatalog(): CatalogProduct[] {
  const plans = PLANS.filter(isPaidPlan).map((plan): CatalogProduct => ({
    id: `plan_${plan.id}`,
    name: plan.name,
    metadata: { catalog: "plan", planId: plan.id },
    prices: BILLING_INTERVALS.map((interval) => ({
      lookupKey: `${plan.id}_${interval}`,
      envVar: `STRIPE_PRICE_${plan.id.toUpperCase()}_${interval.toUpperCase()}`,
      unitAmount: toMinorUnits(plan.price[interval]),
      recurring: interval === "monthly" ? "month" : "year",
    })),
  }));

  const packs = CREDIT_PACKS.map((pack): CatalogProduct => ({
    id: `pack_${pack.id}`,
    name: `${pack.credits} AI credits`,
    metadata: { catalog: "credit_pack", packId: pack.id },
    prices: [
      {
        lookupKey: pack.id,
        envVar: `STRIPE_PRICE_${pack.id.replace(/-/g, "_").toUpperCase()}`,
        unitAmount: toMinorUnits(pack.price),
        recurring: null,
      },
    ],
  }));

  return [...plans, ...packs];
}
