import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiCreditLedger, organization, plan, subscription } from "@/models";
import { seedOrg, seedSubscription } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * Changing the plan of a subscription that exists, and cancelling it, against a
 * client of the provider that records what it is asked. During a trial nothing is
 * prorated; outside one, the change is invoiced at once on the date that was
 * previewed.
 */

const { subscriptions, invoices } = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn(), update: vi.fn() },
  invoices: { createPreview: vi.fn() },
}));
vi.mock("@/features/billing/stripe", () => ({ getStripe: () => ({ subscriptions, invoices }) }));
vi.mock("@/features/billing/price-ids", () => ({
  planForPriceId: (id: string | null | undefined) =>
    ({ price_pro_monthly: { planId: "pro", interval: "monthly" }, price_enterprise_monthly: { planId: "enterprise", interval: "monthly" } })[id ?? ""] ?? null,
  priceIdFor: (planId: string, interval: string) => (planId === "enterprise" && interval === "yearly" ? null : `price_${planId}_${interval}`),
}));

const ORG = "change-org";
// The date of a preview made a minute ago
const minuteAgo = Math.floor(Date.now() / 1000) - 60;
const RECENT = () => minuteAgo;

function live(overrides: Record<string, unknown> = {}, price = "price_pro_monthly"): Stripe.Subscription {
  return {
    id: "sub_live",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { orgId: ORG, planId: "pro" },
    items: { data: [{ id: "si_1", price: { id: price, recurring: { interval: "month" } }, current_period_start: Math.floor(Date.now() / 1000) - 86_400 * 10, current_period_end: Math.floor(Date.now() / 1000) + 86_400 * 20 }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

async function row() {
  return (await testDb.select().from(subscription).where(eq(subscription.organizationId, ORG)))[0];
}

beforeEach(async () => {
  vi.clearAllMocks();
  subscriptions.retrieve.mockReset().mockResolvedValue(live());
  subscriptions.update.mockReset();
  invoices.createPreview.mockReset();
  await testDb.delete(aiCreditLedger);
  await testDb.delete(subscription);
  await testDb.delete(plan);
  await testDb.delete(organization);
  await seedOrg(ORG);
  await testDb.insert(plan).values([{ id: "free", name: "Free", price: 0 }, { id: "pro", name: "Pro", price: 2900 }, { id: "enterprise", name: "Enterprise", price: 9900 }]);
  await seedSubscription(ORG, { planId: "pro", status: "active", stripeSubscriptionId: "sub_live", billingInterval: "month" });
});

describe("previewing a change of plan", () => {
  it("reads what the change costs at the provider, for a day it then charges on, and changes nothing", async () => {
    const { previewPlanChange } = await import("@/features/billing/plan-change");
    invoices.createPreview.mockResolvedValue({ amount_due: 4100, currency: "usd" });

    const preview = await previewPlanChange(ORG, "enterprise", "monthly");

    expect(preview).toMatchObject({ kind: "proration", dueNow: 4100, currency: "usd", prorationDate: expect.any(Number) });
    expect(invoices.createPreview).toHaveBeenCalledExactlyOnceWith({
      customer: "cus_1",
      subscription: "sub_live",
      subscription_details: { items: [{ id: "si_1", price: "price_enterprise_monthly" }], proration_behavior: "always_invoice", proration_date: preview.kind === "proration" ? preview.prorationDate : 0 },
    });
    expect(subscriptions.update).not.toHaveBeenCalled();
  });

  it("says nothing is charged during a trial, and when the new plan starts", async () => {
    const { previewPlanChange } = await import("@/features/billing/plan-change");
    const trialEnd = Math.floor(Date.now() / 1000) + 86_400 * 5;
    subscriptions.retrieve.mockResolvedValue(live({ status: "trialing", trial_end: trialEnd }));

    expect(await previewPlanChange(ORG, "enterprise", "monthly")).toEqual({ kind: "trial", startsAt: new Date(trialEnd * 1000) });
    expect(invoices.createPreview).not.toHaveBeenCalled();
  });

  it.each([
    ["the plan and the period are the ones it is on", "pro", "monthly", "same_plan"],
    ["the plan is free", "free", "monthly", "unknown_plan"],
    ["the catalog has no price for it", "enterprise", "yearly", "price_missing"],
  ])("is refused when %s", async (_, planId, interval, code) => {
    const { previewPlanChange } = await import("@/features/billing/plan-change");

    await expect(previewPlanChange(ORG, planId, interval as "monthly")).rejects.toMatchObject({ code });
  });

  it("is refused for a workspace with no live subscription", async () => {
    const { previewPlanChange } = await import("@/features/billing/plan-change");
    await testDb.update(subscription).set({ status: "canceled" });

    await expect(previewPlanChange(ORG, "enterprise", "monthly")).rejects.toMatchObject({ code: "no_subscription" });
  });
});

describe("changing the plan", () => {
  it("updates the subscription on the proration date that was shown, invoicing at once, and writes the row from the answer", async () => {
    const { changePlan } = await import("@/features/billing/plan-change");
    subscriptions.update.mockResolvedValue(live({ metadata: { orgId: ORG, planId: "enterprise" } }, "price_enterprise_monthly"));

    await changePlan(ORG, "enterprise", "monthly", RECENT());

    expect(subscriptions.update).toHaveBeenCalledExactlyOnceWith("sub_live", {
      items: [{ id: "si_1", price: "price_enterprise_monthly" }],
      metadata: { orgId: ORG, planId: "enterprise" },
      proration_behavior: "always_invoice",
      proration_date: RECENT(),
    });
    expect((await row())?.planId).toBe("enterprise");
  });

  it.each([
    ["older than fifteen minutes", () => Math.floor(Date.now() / 1000) - 16 * 60],
    ["in the future", () => Math.floor(Date.now() / 1000) + 600],
    ["before the period began", () => Math.floor(Date.now() / 1000) - 40 * 86_400],
  ])("refuses a proration date that is %s: the preview has to be asked again", async (_, date) => {
    const { changePlan } = await import("@/features/billing/plan-change");

    await expect(changePlan(ORG, "enterprise", "monthly", date())).rejects.toMatchObject({ code: "stale_preview" });
    expect(subscriptions.update).not.toHaveBeenCalled();
  });

  it("takes the date of a preview that is a few minutes old", async () => {
    const { changePlan } = await import("@/features/billing/plan-change");
    subscriptions.update.mockResolvedValue(live({ metadata: { orgId: ORG, planId: "enterprise" } }, "price_enterprise_monthly"));
    const date = Math.floor(Date.now() / 1000) - 5 * 60;

    await changePlan(ORG, "enterprise", "monthly", date);

    expect(subscriptions.update.mock.calls[0]![1]).toMatchObject({ proration_date: date });
  });

  it("prorates nothing during a trial: the plan that starts at its end is the one that changes", async () => {
    const { changePlan } = await import("@/features/billing/plan-change");
    subscriptions.retrieve.mockResolvedValue(live({ status: "trialing", trial_end: Math.floor(Date.now() / 1000) + 86_400 }));
    subscriptions.update.mockResolvedValue(live({ status: "trialing", metadata: { orgId: ORG, planId: "enterprise" } }, "price_enterprise_monthly"));

    await changePlan(ORG, "enterprise", "monthly", RECENT());

    const [, params] = subscriptions.update.mock.calls[0]!;
    expect(params.proration_behavior).toBe("none");
    expect(params).not.toHaveProperty("proration_date");
  });

  it("leaves the row alone when the provider refuses", async () => {
    const { changePlan } = await import("@/features/billing/plan-change");
    subscriptions.update.mockRejectedValue(new Error("card declined"));

    await expect(changePlan(ORG, "enterprise", "monthly")).rejects.toThrow("card declined");
    expect((await row())?.planId).toBe("pro");
  });
});

describe("cancelling", () => {
  it("is for the end of the period that is paid for: the plan stays until then", async () => {
    const { setCancelAtPeriodEnd } = await import("@/features/billing/plan-change");
    subscriptions.update.mockResolvedValue(live({ cancel_at_period_end: true }));

    await setCancelAtPeriodEnd(ORG, true);

    expect(subscriptions.update).toHaveBeenCalledExactlyOnceWith("sub_live", { cancel_at_period_end: true });
    expect(await row()).toMatchObject({ planId: "pro", status: "active", cancelAtPeriodEnd: true });
  });

  it("can be taken back", async () => {
    const { setCancelAtPeriodEnd } = await import("@/features/billing/plan-change");
    await testDb.update(subscription).set({ cancelAtPeriodEnd: true });
    subscriptions.update.mockResolvedValue(live({ cancel_at_period_end: false }));

    await setCancelAtPeriodEnd(ORG, false);

    expect((await row())?.cancelAtPeriodEnd).toBe(false);
  });

  it("is refused when there is nothing to cancel", async () => {
    const { setCancelAtPeriodEnd } = await import("@/features/billing/plan-change");
    await testDb.delete(subscription);

    await expect(setCancelAtPeriodEnd(ORG, true)).rejects.toMatchObject({ code: "no_subscription" });
  });
});
