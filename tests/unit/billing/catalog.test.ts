import { describe, expect, it } from "vitest";
import { planCatalog, portalDrift, portalFeatures, toMinorUnits } from "@/features/billing/catalog";

// The Stripe catalog is derived from `PLANS` and the packs: what the script creates is what the app sells.
describe("the Stripe catalog", () => {
  const catalog = planCatalog();
  const prices = catalog.flatMap((product) => product.prices);

  it("has a product per paid plan and per pack, none for the free plan", () => {
    expect(catalog.map((product) => product.id)).toEqual(["plan_pro", "plan_enterprise", "pack_credits-1000", "pack_credits-5000"]);
  });

  it("prices each plan monthly and yearly, in cents, with the amounts of PLANS", () => {
    expect(prices.filter((price) => price.lookupKey.startsWith("pro_"))).toEqual([
      { lookupKey: "pro_monthly", envVar: "STRIPE_PRICE_PRO_MONTHLY", unitAmount: 2900, recurring: "month" },
      { lookupKey: "pro_yearly", envVar: "STRIPE_PRICE_PRO_YEARLY", unitAmount: 29_000, recurring: "year" },
    ]);
  });

  it("sells the packs once, not as a subscription", () => {
    expect(prices.filter((price) => price.recurring === null).map((price) => [price.lookupKey, price.envVar, price.unitAmount])).toEqual([
      ["credits-1000", "STRIPE_PRICE_CREDITS_1000", 1000],
      ["credits-5000", "STRIPE_PRICE_CREDITS_5000", 4000],
    ]);
  });

  it("gives every price a lookup key and a variable of its own: the script is safe to run twice", () => {
    expect(new Set(prices.map((price) => price.lookupKey)).size).toBe(prices.length);
    expect(new Set(prices.map((price) => price.envVar)).size).toBe(prices.length);
  });

  it("configures a portal for the payment method and the invoices only: cancelling and changing plan are the app's, and the owner's", () => {
    const features = portalFeatures();

    expect(features.subscription_cancel).toEqual({ enabled: false });
    expect(features.subscription_update).toEqual({ enabled: false });
    expect(features.payment_method_update).toEqual({ enabled: true });
    expect(features.invoice_history).toEqual({ enabled: true });
  });

  // The script compares a portal it finds with this, and puts it right (in test mode) or says so: one that lets the customer
  // cancel or change plan from the portal would bypass the app's own rules
  describe("a portal that exists already", () => {
    const asCreated = () => structuredClone(portalFeatures()) as Parameters<typeof portalDrift>[0];

    it("is left alone when it is what the app asks for", () => {
      expect(portalDrift(asCreated())).toEqual([]);
    });

    it("is not told apart by what the provider adds to each feature, or by the order of the fields", () => {
      const found = { ...asCreated(), subscription_cancel: { enabled: false, mode: "at_period_end" }, customer_update: { enabled: true, allowed_updates: ["tax_id", "address", "name", "email"] } };

      expect(portalDrift(found)).toEqual([]);
    });

    it("names the features that offer what the app keeps for itself", () => {
      const found = { ...asCreated(), subscription_cancel: { enabled: true }, subscription_update: { enabled: true } };

      expect(portalDrift(found)).toEqual(["subscription_cancel", "subscription_update"]);
    });

    it("names a feature that is off when the app needs it, and a customer who may update less than expected", () => {
      const found = { ...asCreated(), invoice_history: { enabled: false }, customer_update: { enabled: true, allowed_updates: ["email"] } };

      expect(portalDrift(found)).toEqual(["invoice_history", "customer_update"]);
    });

    it("counts a feature the provider does not mention as off", () => {
      expect(portalDrift({})).toEqual(["payment_method_update", "invoice_history", "customer_update"]);
    });
  });

  it("turns an amount into cents without a float's dust", () => {
    expect(toMinorUnits(29.99)).toBe(2999);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });
});
