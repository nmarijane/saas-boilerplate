import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitEvent } from "@/features/events/emitter";
import { aiCreditLedger, auditLog, organization, plan, subscription, user } from "@/models";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What the events of the payment provider do to the row of a workspace. The
 * provider is replaced by a client that holds one subscription; its price ids are
 * the catalog's. Every handler is called more than once and in the wrong order on
 * purpose: events come twice, late, and out of order.
 */

const { retrieve, cancel, update, mail } = vi.hoisted(() => ({ retrieve: vi.fn(), cancel: vi.fn(), update: vi.fn(), mail: vi.fn() }));
vi.mock("@/features/billing/stripe", () => ({
  getStripe: () => ({ subscriptions: { retrieve, cancel, update } }),
}));
vi.mock("@/features/billing/price-ids", () => ({
  planForPriceId: (id: string | null | undefined) =>
    ({ price_pro_monthly: { planId: "pro", interval: "monthly" }, price_pro_yearly: { planId: "pro", interval: "yearly" }, price_ent_monthly: { planId: "enterprise", interval: "monthly" } })[id ?? ""] ?? null,
  priceIdFor: (planId: string, interval: string) => `price_${planId}_${interval}`,
  packPriceId: (id: string) => `price_${id}`,
}));
vi.mock("@/features/billing/mail", () => ({ mailWorkspaceOwner: mail }));

const ORG = "sync-org";
const OWNER = "sync-owner";
const PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 86_400;

function stripeSubscription(overrides: Partial<Record<string, unknown>> & { price?: string } = {}): Stripe.Subscription {
  const { price = "price_pro_monthly", ...rest } = overrides;
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { orgId: ORG, planId: "pro", locale: "fr" },
    items: { data: [{ id: "si_1", price: { id: price, recurring: { interval: price.endsWith("yearly") ? "year" : "month" } }, current_period_end: PERIOD_END }] },
    ...rest,
  } as unknown as Stripe.Subscription;
}

async function row() {
  return (await testDb.select().from(subscription).where(eq(subscription.organizationId, ORG)))[0];
}

beforeEach(async () => {
  vi.clearAllMocks();
  retrieve.mockReset();
  cancel.mockReset();
  update.mockReset();
  await testDb.delete(aiCreditLedger);
  await testDb.delete(auditLog);
  await testDb.delete(subscription);
  await testDb.delete(plan); // no plan rows at all: the app writes the ones it needs
  await testDb.delete(organization);
  await testDb.update(user).set({ trialUsedAt: null });
  await seedUser(OWNER);
  await seedOrg(ORG);
  await seedOrgMember(OWNER, ORG, "owner");
});

describe("applySubscription", () => {
  it("writes the row of a first subscription, plan rows included", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");

    expect(await applySubscription(stripeSubscription())).toBe("applied");

    expect(await row()).toMatchObject({
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      status: "active",
      planId: "pro",
      billingInterval: "month",
      cancelAtPeriodEnd: false,
      trialEnd: null,
      locale: "fr",
    });
    expect((await testDb.select().from(plan)).map(({ id }) => id)).toContain("pro");
    expect(emitEvent).toHaveBeenCalledExactlyOnceWith("subscription.created", expect.objectContaining({ orgId: ORG, metadata: { planId: "pro" } }));
  });

  it("changes nothing, and says nothing, the second time: an event delivered twice", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");

    await applySubscription(stripeSubscription());
    await applySubscription(stripeSubscription());

    expect(await testDb.select().from(subscription)).toHaveLength(1);
    expect(emitEvent).toHaveBeenCalledTimes(1);
  });

  it("reads the plan of the yearly price of the catalog, which the old single stored price never matched", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");

    await applySubscription(stripeSubscription({ price: "price_pro_yearly" }));

    expect(await row()).toMatchObject({ planId: "pro", billingInterval: "year" });
  });

  it("moves to the plan the subscription is now on, and says it was updated", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");

    await applySubscription(stripeSubscription());
    await applySubscription(stripeSubscription({ price: "price_ent_monthly", metadata: { orgId: ORG, planId: "enterprise" } }));

    expect((await row())?.planId).toBe("enterprise");
    expect(emitEvent).toHaveBeenLastCalledWith("subscription.updated", expect.objectContaining({ metadata: { planId: "enterprise" } }));
  });

  it("keeps a trial and a scheduled cancellation, with their dates", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    const trialEnd = Math.floor(Date.now() / 1000) + 14 * 86_400;

    await applySubscription(stripeSubscription({ status: "trialing", trial_end: trialEnd, cancel_at_period_end: true }));

    const written = await row();
    expect(written).toMatchObject({ status: "trialing", cancelAtPeriodEnd: true });
    expect(written?.trialEnd?.getTime()).toBe(trialEnd * 1000);
  });

  it("falls back to the free plan, whose row it creates, when the subscription is over", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");

    await applySubscription(stripeSubscription());
    expect((await testDb.select().from(plan)).map(({ id }) => id)).not.toContain("free");
    await applySubscription(stripeSubscription({ status: "canceled" }));

    expect((await testDb.select().from(plan)).map(({ id }) => id)).toContain("free");
    expect(await row()).toMatchObject({ status: "canceled", planId: "free", billingInterval: null, cancelAtPeriodEnd: false });
    expect(emitEvent).toHaveBeenLastCalledWith("subscription.cancelled", expect.objectContaining({ orgId: ORG }));
  });

  it("ignores the late end of a subscription that was replaced by a newer live one", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");

    await applySubscription(stripeSubscription({ id: "sub_new" }));
    const outcome = await applySubscription(stripeSubscription({ id: "sub_old", status: "canceled" }));

    expect(outcome).toBe("ignored");
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_new", status: "active", planId: "pro" });
  });

  it("does not guess a plan for a price that is not in the catalog", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await applySubscription(stripeSubscription({ price: "price_unknown", metadata: { orgId: ORG } }));

    expect(outcome).toBe("ignored");
    expect(await testDb.select().from(subscription)).toEqual([]);
    errors.mockRestore();
  });

  it("leaves alone a subscription that is not the app's: no workspace in its metadata", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");

    expect(await applySubscription(stripeSubscription({ metadata: {} }))).toBe("ignored");
    expect(await testDb.select().from(subscription)).toEqual([]);
  });
});

describe("syncSubscription", () => {
  it("reads the subscription at the provider: whichever event came, the row is what the provider says now", async () => {
    const { syncSubscription } = await import("@/features/billing/subscription");
    retrieve.mockResolvedValue(stripeSubscription({ price: "price_ent_monthly", metadata: { orgId: ORG, planId: "enterprise" } }));

    await syncSubscription("sub_1");

    expect((await row())?.planId).toBe("enterprise");
  });

  it("marks a subscription the provider no longer has as over", async () => {
    const { applySubscription, syncSubscription } = await import("@/features/billing/subscription");
    await applySubscription(stripeSubscription());
    retrieve.mockRejectedValue(Object.assign(new Error("No such subscription"), { code: "resource_missing" }));

    await syncSubscription("sub_1");

    expect(await row()).toMatchObject({ status: "canceled", planId: "free" });
  });
});

describe("the trial", () => {
  it("is spent once, whatever the number of checkouts that complete at the same time", async () => {
    const { claimTrial } = await import("@/features/billing/subscription");

    const claims = await Promise.all([claimTrial(OWNER, "sub_a"), claimTrial(OWNER, "sub_b"), claimTrial(OWNER, "sub_c")]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    const [owner] = await testDb.select().from(user).where(eq(user.id, OWNER));
    expect(owner?.trialUsedAt).toBeInstanceOf(Date);
  });

  it("is spent for the owner of the workspace when a trialing checkout completes", async () => {
    const { handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");
    retrieve.mockResolvedValue(stripeSubscription({ status: "trialing", trial_end: PERIOD_END }));

    await handleCheckoutCompleted({ mode: "subscription", metadata: { orgId: ORG }, subscription: "sub_1", customer: "cus_1" } as unknown as Stripe.Checkout.Session);

    const [owner] = await testDb.select().from(user).where(eq(user.id, OWNER));
    expect(owner?.trialUsedAt).toBeInstanceOf(Date);
    expect((await row())?.status).toBe("trialing");
  });

  it("is spent once when two checkouts of the same workspace complete one after the other: the second subscription is cancelled, and holds no second trial", async () => {
    const { handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");
    retrieve.mockImplementation(async (id: string) => stripeSubscription({ id, status: "trialing", trial_end: PERIOD_END }));
    cancel.mockResolvedValue({ status: "canceled" });
    const completed = (id: string) => ({ mode: "subscription", metadata: { orgId: ORG }, subscription: id, customer: "cus_1" }) as unknown as Stripe.Checkout.Session;

    await handleCheckoutCompleted(completed("sub_a"));
    await handleCheckoutCompleted(completed("sub_b"));

    expect(cancel).toHaveBeenCalledExactlyOnceWith("sub_b");
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_a", status: "trialing" });
    expect(await testDb.select().from(subscription)).toHaveLength(1);
  });

  // The buyer was shown a trial: nothing is charged when it is the second one. The subscription is cancelled before it begins to bill
  it("is spent once per owner, across workspaces: the second workspace's subscription is cancelled with nothing charged, and it stays on the free plan", async () => {
    const { handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");
    await seedOrg("sync-org-2");
    await seedOrgMember(OWNER, "sync-org-2", "owner");
    const trialing = (id: string, orgId: string) => stripeSubscription({ id, status: "trialing", trial_end: PERIOD_END, metadata: { orgId, planId: "pro" } });
    retrieve.mockImplementation(async (id: string) => (cancel.mock.calls.some(([cancelled]) => cancelled === id) ? { ...trialing(id, "sync-org-2"), status: "canceled", trial_end: null } : trialing(id, id === "sub_one" ? ORG : "sync-org-2")));
    cancel.mockResolvedValue({ status: "canceled" });
    const completed = (id: string, orgId: string) => ({ mode: "subscription", metadata: { orgId }, subscription: id, customer: "cus_1" }) as unknown as Stripe.Checkout.Session;

    await handleCheckoutCompleted(completed("sub_one", ORG));
    await handleCheckoutCompleted(completed("sub_two", "sync-org-2"));
    // The first one delivered again is the same trial, not a second one
    await handleCheckoutCompleted(completed("sub_one", ORG));

    expect(cancel).toHaveBeenCalledExactlyOnceWith("sub_two", { cancellation_details: { comment: "trial_already_used" } });
    // Ending the trial at once would have charged the price in full
    expect(update).not.toHaveBeenCalled();
    expect(await row()).toMatchObject({ status: "trialing" });
    const [second] = await testDb.select().from(subscription).where(eq(subscription.organizationId, "sync-org-2"));
    expect(second).toMatchObject({ status: "canceled", planId: "free" });
    expect(emitEvent).toHaveBeenCalledWith("subscription.updated", expect.objectContaining({ orgId: "sync-org-2", metadata: { trialAlreadyUsed: "sub_two" } }));
  });

  it("gives back only the trial that the cancelled duplicate had taken", async () => {
    const { claimTrial, releaseTrial } = await import("@/features/billing/subscription");
    await claimTrial(OWNER, "sub_first");

    await releaseTrial(OWNER, "sub_duplicate");
    expect((await testDb.select().from(user).where(eq(user.id, OWNER)))[0]).toMatchObject({ trialSubscriptionId: "sub_first" });
    expect((await testDb.select().from(user).where(eq(user.id, OWNER)))[0]?.trialUsedAt).toBeInstanceOf(Date);

    await releaseTrial(OWNER, "sub_first");
    expect((await testDb.select().from(user).where(eq(user.id, OWNER)))[0]).toMatchObject({ trialUsedAt: null, trialSubscriptionId: null });
  });

  it("writes nothing for a trial that is refused, even when the event of the subscription came first", async () => {
    const { handleCheckoutCompleted, handleSubscriptionChanged } = await import("@/features/billing/webhook-handlers");
    await seedOrg("sync-org-2");
    await seedOrgMember(OWNER, "sync-org-2", "owner");
    await testDb.update(user).set({ trialUsedAt: new Date(), trialSubscriptionId: "sub_earlier" }).where(eq(user.id, OWNER));
    const trialing = stripeSubscription({ id: "sub_two", status: "trialing", trial_end: PERIOD_END, metadata: { orgId: "sync-org-2", planId: "pro" } });
    retrieve.mockImplementation(async () => (cancel.mock.calls.length > 0 ? { ...trialing, status: "canceled", trial_end: null } : trialing));
    cancel.mockResolvedValue({ status: "canceled" });

    await handleSubscriptionChanged(trialing);
    await handleCheckoutCompleted({ mode: "subscription", metadata: { orgId: "sync-org-2" }, subscription: "sub_two", customer: "cus_1" } as unknown as Stripe.Checkout.Session);

    const [second] = await testDb.select().from(subscription).where(eq(subscription.organizationId, "sync-org-2"));
    expect(second).toMatchObject({ status: "canceled", planId: "free" });
  });

  it("is not spent by a checkout that pays at once", async () => {
    const { handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");
    retrieve.mockResolvedValue(stripeSubscription());

    await handleCheckoutCompleted({ mode: "subscription", metadata: { orgId: ORG }, subscription: "sub_1", customer: "cus_1" } as unknown as Stripe.Checkout.Session);

    const [owner] = await testDb.select().from(user).where(eq(user.id, OWNER));
    expect(owner?.trialUsedAt).toBeNull();
  });
});

describe("the events, in any order", () => {
  it("writes the subscription from an update that comes before the checkout completed", async () => {
    const { handleSubscriptionChanged, handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");
    retrieve.mockResolvedValue(stripeSubscription());

    await handleSubscriptionChanged(stripeSubscription());
    await handleCheckoutCompleted({ mode: "subscription", metadata: { orgId: ORG }, subscription: "sub_1", customer: "cus_1" } as unknown as Stripe.Checkout.Session);

    expect(await testDb.select().from(subscription)).toHaveLength(1);
    expect((await row())?.planId).toBe("pro");
  });

  it("does not let a paid invoice that comes first invent a subscription", async () => {
    const { handleInvoicePaid } = await import("@/features/billing/webhook-handlers");
    retrieve.mockRejectedValue(Object.assign(new Error("No such subscription"), { code: "resource_missing" }));

    await handleInvoicePaid({ amount_paid: 2900, currency: "usd", parent: { subscription_details: { subscription: "sub_1" } } } as unknown as Stripe.Invoice);

    expect(await testDb.select().from(subscription)).toEqual([]);
    expect(mail).not.toHaveBeenCalled();
  });

  it("mails the payment once it is in, and not the invoice of a trial, which is for nothing", async () => {
    const { handleInvoicePaid } = await import("@/features/billing/webhook-handlers");
    retrieve.mockResolvedValue(stripeSubscription());
    const invoice = (paid: number) => ({ amount_paid: paid, currency: "usd", parent: { subscription_details: { subscription: "sub_1" } } }) as unknown as Stripe.Invoice;

    await handleInvoicePaid(invoice(0));
    expect(mail).not.toHaveBeenCalled();

    await handleInvoicePaid(invoice(2900));
    expect(mail).toHaveBeenCalledExactlyOnceWith(ORG, { kind: "paymentSuccess", planName: "Pro", amount: { minor: 2900, currency: "usd" } }, "fr");
    expect(emitEvent).toHaveBeenCalledWith("payment.succeeded", expect.objectContaining({ orgId: ORG }));
  });

  it("keeps the plan while a payment is retried, and tells the owner", async () => {
    const { handleInvoicePaymentFailed } = await import("@/features/billing/webhook-handlers");
    retrieve.mockResolvedValue(stripeSubscription({ status: "past_due" }));

    await handleInvoicePaymentFailed({ parent: { subscription_details: { subscription: "sub_1" } } } as unknown as Stripe.Invoice);

    expect(await row()).toMatchObject({ status: "past_due", planId: "pro" });
    expect(mail).toHaveBeenCalledExactlyOnceWith(ORG, { kind: "paymentFailed", planName: "Pro" }, "fr");
  });

  it("tells the owner once that a subscription that was live is over", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    const { handleSubscriptionChanged } = await import("@/features/billing/webhook-handlers");
    await applySubscription(stripeSubscription());
    retrieve.mockResolvedValue(stripeSubscription({ status: "canceled" }));

    await handleSubscriptionChanged(stripeSubscription({ status: "canceled" }));
    await handleSubscriptionChanged(stripeSubscription({ status: "canceled" }));

    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail).toHaveBeenCalledWith(ORG, expect.objectContaining({ kind: "subscriptionCancelled", planName: "Pro" }), "fr");
  });

  it("warns the owner three days before a trial ends", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    const { handleTrialWillEnd } = await import("@/features/billing/webhook-handlers");
    await applySubscription(stripeSubscription({ status: "trialing", trial_end: PERIOD_END }));

    await handleTrialWillEnd(stripeSubscription({ status: "trialing", trial_end: PERIOD_END }));

    expect(mail).toHaveBeenCalledExactlyOnceWith(ORG, { kind: "trialEnding", planName: "Pro", endsAt: new Date(PERIOD_END * 1000) }, "fr");
  });
});

describe("a second subscription for a workspace that pays", () => {
  it("is cancelled at the provider, whichever event of it comes first, and the row keeps the first", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    const { handleSubscriptionChanged, handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");
    cancel.mockResolvedValue({ status: "canceled" });
    await applySubscription(stripeSubscription({ id: "sub_a" }));
    retrieve.mockResolvedValue(stripeSubscription({ id: "sub_b", status: "trialing", trial_end: PERIOD_END }));

    // The event of the subscription comes before the completion of its checkout: the usual order of a trial
    await handleSubscriptionChanged(stripeSubscription({ id: "sub_b" }));
    await handleCheckoutCompleted({ mode: "subscription", metadata: { orgId: ORG }, subscription: "sub_b", customer: "cus_1" } as unknown as Stripe.Checkout.Session);

    expect(cancel).toHaveBeenCalledWith("sub_b");
    expect(cancel).not.toHaveBeenCalledWith("sub_a");
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_a", status: "active" });
    expect(emitEvent).toHaveBeenCalledWith("subscription.updated", expect.objectContaining({ metadata: expect.objectContaining({ duplicate: "sub_b" }) }));
    // The trial of the duplicate was not spent
    const [owner] = await testDb.select().from(user).where(eq(user.id, OWNER));
    expect(owner?.trialUsedAt).toBeNull();
  });

  it("is cancelled when two of them are written at the same time", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    cancel.mockResolvedValue({ status: "canceled" });
    retrieve.mockImplementation(async (id: string) => stripeSubscription({ id }));

    await Promise.all([applySubscription(stripeSubscription({ id: "sub_x" })), applySubscription(stripeSubscription({ id: "sub_y" }))]);

    expect(await testDb.select().from(subscription)).toHaveLength(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe("a second subscription, when the one in place has ended at the provider", () => {
  // The row still says live: the event that ends it has not reached the app. Cancelling the new one would leave the person paying for nothing
  it.each(["canceled", "incomplete_expired", "unpaid"])("takes its place when the provider reads the one in place as %s, and is not cancelled", async (status) => {
    const { applySubscription } = await import("@/features/billing/subscription");
    await applySubscription(stripeSubscription({ id: "sub_a" }));
    retrieve.mockImplementation(async (id: string) => (id === "sub_a" ? stripeSubscription({ id: "sub_a", status }) : stripeSubscription({ id })));

    expect(await applySubscription(stripeSubscription({ id: "sub_b" }))).toBe("applied");

    expect(cancel).not.toHaveBeenCalled();
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_b", status: "active", planId: "pro" });
    expect(await testDb.select().from(subscription)).toHaveLength(1);
  });

  // The one in place may no longer carry the workspace in its metadata: it is found by its id, and the call does not go round
  it("takes its place when the one in place ended and its metadata do not name the workspace", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    await applySubscription(stripeSubscription({ id: "sub_a" }));
    retrieve.mockImplementation(async (id: string) => (id === "sub_a" ? stripeSubscription({ id: "sub_a", status: "canceled", metadata: {} }) : stripeSubscription({ id })));

    expect(await applySubscription(stripeSubscription({ id: "sub_b" }))).toBe("applied");

    expect(cancel).not.toHaveBeenCalled();
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_b", status: "active" });
  });

  it("changes nothing, and throws, when the one in place cannot be read for another reason than being gone", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    await applySubscription(stripeSubscription({ id: "sub_a" }));
    retrieve.mockRejectedValue(Object.assign(new Error("Stripe is down"), { code: "api_error" }));

    await expect(applySubscription(stripeSubscription({ id: "sub_b" }))).rejects.toThrow("Stripe is down");

    expect(cancel).not.toHaveBeenCalled();
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_a", status: "active" });
  });

  it("takes its place when the provider no longer has the one in place", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    await applySubscription(stripeSubscription({ id: "sub_a" }));
    retrieve.mockImplementation(async (id: string) => {
      if (id === "sub_a") {
        throw Object.assign(new Error("No such subscription"), { code: "resource_missing" });
      }
      return stripeSubscription({ id });
    });

    expect(await applySubscription(stripeSubscription({ id: "sub_b" }))).toBe("applied");

    expect(cancel).not.toHaveBeenCalled();
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_b", status: "active" });
  });

  it("is still cancelled when the provider reads the one in place as live", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    cancel.mockResolvedValue({ status: "canceled" });
    await applySubscription(stripeSubscription({ id: "sub_a" }));
    retrieve.mockImplementation(async (id: string) => stripeSubscription({ id }));

    expect(await applySubscription(stripeSubscription({ id: "sub_b" }))).toBe("duplicate");

    expect(cancel).toHaveBeenCalledExactlyOnceWith("sub_b");
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_a" });
  });
});

describe("a pack of credits", () => {
  const session = (overrides: Partial<Stripe.Checkout.Session> = {}) =>
    ({ id: "cs_pack", mode: "payment", payment_status: "paid", metadata: { orgId: ORG, kind: "credit_pack", packId: "credits-1000", credits: "999999" }, ...overrides }) as unknown as Stripe.Checkout.Session;

  async function packCredits() {
    const rows = await testDb.select().from(aiCreditLedger).where(and(eq(aiCreditLedger.organizationId, ORG), eq(aiCreditLedger.reason, "credit_pack")));
    return rows.reduce((sum, { amount }) => sum + amount, 0);
  }

  it("is credited once, from the catalog and not from what the metadata claims, however often the event comes", async () => {
    const { handleCheckoutCompleted, handleCheckoutAsyncPaymentSucceeded } = await import("@/features/billing/webhook-handlers");

    await handleCheckoutCompleted(session());
    await handleCheckoutCompleted(session());
    await handleCheckoutAsyncPaymentSucceeded(session());

    expect(await packCredits()).toBe(1000);
  });

  it("is not credited before the payment is paid, and is when it settles", async () => {
    const { handleCheckoutCompleted, handleCheckoutAsyncPaymentSucceeded } = await import("@/features/billing/webhook-handlers");

    await handleCheckoutCompleted(session({ payment_status: "unpaid" }));
    expect(await packCredits()).toBe(0);

    await handleCheckoutAsyncPaymentSucceeded(session());
    expect(await packCredits()).toBe(1000);
  });

  it("is not credited for a pack the app does not sell, or a session that is not a pack", async () => {
    const { handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");

    await handleCheckoutCompleted(session({ metadata: { orgId: ORG, kind: "credit_pack", packId: "credits-999999" } }));
    await handleCheckoutCompleted(session({ metadata: { orgId: ORG, kind: "something_else", packId: "credits-1000" } }));

    expect(await packCredits()).toBe(0);
  });
});

describe("a checkout paid for a workspace that was deleted", () => {
  it("cancels its subscription at the provider only when the app deleted that workspace itself", async () => {
    const { handleCheckoutCompleted } = await import("@/features/billing/webhook-handlers");
    const gone = { mode: "subscription", metadata: { orgId: "gone" }, subscription: "sub_gone", customer: "cus_gone" } as unknown as Stripe.Checkout.Session;

    await handleCheckoutCompleted(gone);
    expect(cancel).not.toHaveBeenCalled();

    await testDb.insert(auditLog).values({ id: "deleted-gone", orgId: null, action: "organization.deleted", resourceType: "organization", resourceId: "gone", metadata: {} });
    await handleCheckoutCompleted(gone);
    expect(cancel).toHaveBeenCalledExactlyOnceWith("sub_gone");
  });
});
