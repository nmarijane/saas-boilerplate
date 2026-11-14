import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { organization, plan, subscription, user } from "@/models";
import { seedOrg, seedOrgMember, seedSubscription, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What the app asks the payment provider for when someone pays. The provider is
 * a client that records the call: nothing here ran against Stripe. The browser
 * never names a price, so what is checked is what the server builds.
 */

const { sessions, customers, settings } = vi.hoisted(() => ({
  sessions: { create: vi.fn() },
  customers: { create: vi.fn() },
  settings: { key: "fake-secret-key", publishable: "fake-publishable-key", tax: false, trialWithoutCard: false },
}));
vi.mock("@/features/billing/stripe", () => ({ getStripe: () => ({ checkout: { sessions }, customers }) }));
vi.mock("@/features/billing/price-ids", () => ({
  priceIdFor: (planId: string, interval: string) => (planId === "enterprise" && interval === "yearly" ? null : `price_${planId}_${interval}`),
  packPriceId: (id: string) => (id === "credits-5000" ? null : `price_${id}`),
}));
vi.mock("@/shared/lib/env", () => ({
  env: {
    get STRIPE_SECRET_KEY() {
      return settings.key;
    },
    get NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY() {
      return settings.publishable;
    },
    get STRIPE_TAX_ENABLED() {
      return settings.tax;
    },
    get BILLING_TRIAL_WITHOUT_CARD() {
      return settings.trialWithoutCard;
    },
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
  },
}));

const ORG = "pay-org";
const OWNER = "pay-owner";
const ADMIN = "pay-admin";
const buyer = { orgId: ORG, userId: ADMIN, email: "admin@example.test", locale: "fr" };

async function checkout() {
  return import("@/features/billing/checkout");
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(settings, { key: "fake-secret-key", publishable: "fake-publishable-key", tax: false, trialWithoutCard: false });
  sessions.create.mockReset().mockImplementation(async (params: { ui_mode: string }) => ({ id: "cs_1", ui_mode: params.ui_mode, url: params.ui_mode === "hosted_page" ? "https://pay.example/cs_1" : null }));
  customers.create.mockReset().mockResolvedValue({ id: "cus_new" });
  await testDb.delete(subscription);
  await testDb.delete(plan);
  await testDb.delete(organization);
  await testDb.update(user).set({ trialUsedAt: null });
  await seedUser(OWNER);
  await seedUser(ADMIN);
  await seedOrg(ORG);
  await seedOrgMember(OWNER, ORG, "owner");
  await seedOrgMember(ADMIN, ORG, "admin");
});

describe("the checkout of a plan", () => {
  it("opens an embedded session for the plan and the period, with the app's own metadata, and a trial", async () => {
    const { createPlanCheckout } = await checkout();

    const launch = await createPlanCheckout(buyer, { planId: "pro", interval: "yearly" });

    expect(launch).toEqual({ kind: "embedded", sessionId: "cs_1", url: null });
    const [params, options] = sessions.create.mock.calls[0]!;
    expect(params).toMatchObject({
      mode: "subscription",
      customer: "cus_new",
      client_reference_id: ORG,
      line_items: [{ price: "price_pro_yearly", quantity: 1 }],
      ui_mode: "embedded_page",
      return_url: "https://app.example.test/fr/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      redirect_on_completion: "always",
      locale: "fr",
      metadata: { orgId: ORG, userId: ADMIN, kind: "subscription", planId: "pro", interval: "yearly", trialDays: "14" },
      subscription_data: { metadata: { orgId: ORG, planId: "pro", locale: "fr" }, trial_period_days: 14 },
    });
    expect(params).not.toHaveProperty("payment_method_collection");
    expect(params).not.toHaveProperty("automatic_tax");
    expect(options).toEqual({ idempotencyKey: expect.stringMatching(/^checkout-/) });
  });

  it("keeps the customer on the workspace, once: a second checkout reuses it", async () => {
    const { createPlanCheckout } = await checkout();

    await createPlanCheckout(buyer, { planId: "pro", interval: "monthly" });
    await createPlanCheckout(buyer, { planId: "pro", interval: "yearly" });

    expect(customers.create).toHaveBeenCalledTimes(1);
    expect(customers.create.mock.calls[0]![0]).toMatchObject({ metadata: { orgId: ORG }, email: "admin@example.test" });
    expect(customers.create.mock.calls[0]![1]).toEqual({ idempotencyKey: `customer-${ORG}-Test%20Org` });
    const rows = await testDb.select().from(subscription).where(eq(subscription.organizationId, ORG));
    expect(rows).toMatchObject([{ stripeCustomerId: "cus_new", planId: "free", status: "active", stripeSubscriptionId: null }]);
  });

  it("gives the trial once per owner: not when the owner used it already, for any workspace", async () => {
    const { createPlanCheckout } = await checkout();
    await testDb.update(user).set({ trialUsedAt: new Date() }).where(eq(user.id, OWNER));

    await createPlanCheckout(buyer, { planId: "pro", interval: "monthly" });

    const [params] = sessions.create.mock.calls[0]!;
    expect(params.subscription_data).not.toHaveProperty("trial_period_days");
    expect(params.metadata.trialDays).toBe("0");
  });

  it("does not give the trial of an admin who paid for a workspace that is not theirs: it is the owner's", async () => {
    const { isTrialAvailable } = await checkout();
    await testDb.update(user).set({ trialUsedAt: new Date() }).where(eq(user.id, ADMIN));

    expect(await isTrialAvailable(ORG, "pro")).toBe(true);
    expect(await isTrialAvailable(ORG, "enterprise")).toBe(false); // no trial on that plan
  });

  it("asks for no card during the trial when the product allows it, and cancels at its end without one", async () => {
    settings.trialWithoutCard = true;
    const { createPlanCheckout } = await checkout();

    await createPlanCheckout(buyer, { planId: "pro", interval: "monthly" });

    const [params] = sessions.create.mock.calls[0]!;
    expect(params.payment_method_collection).toBe("if_required");
    expect(params.subscription_data.trial_settings).toEqual({ end_behavior: { missing_payment_method: "cancel" } });
  });

  it("falls back on the provider's hosted page without a publishable key, and cancels back to the prices", async () => {
    settings.publishable = "";
    const { createPlanCheckout } = await checkout();

    const launch = await createPlanCheckout(buyer, { planId: "pro", interval: "monthly" });

    expect(launch).toEqual({ kind: "hosted", sessionId: "cs_1", url: "https://pay.example/cs_1" });
    const [params] = sessions.create.mock.calls[0]!;
    expect(params).toMatchObject({
      ui_mode: "hosted_page",
      success_url: "https://app.example.test/fr/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://app.example.test/fr/pricing",
    });
    expect(params).not.toHaveProperty("return_url");
  });

  it("computes the VAT and asks for the address and the VAT number when Stripe Tax is on", async () => {
    settings.tax = true;
    const { createPlanCheckout } = await checkout();

    await createPlanCheckout(buyer, { planId: "pro", interval: "monthly" });

    expect(sessions.create.mock.calls[0]![0]).toMatchObject({
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
    });
  });

  it.each([
    ["no Stripe key is set", () => { settings.key = ""; }, { planId: "pro", interval: "monthly" as const }, "not_configured"],
    ["the plan is free", () => {}, { planId: "free", interval: "monthly" as const }, "unknown_plan"],
    ["the plan does not exist", () => {}, { planId: "gold", interval: "monthly" as const }, "unknown_plan"],
    ["the catalog has no price for it", () => {}, { planId: "enterprise", interval: "yearly" as const }, "price_missing"],
  ])("is refused when %s", async (_, arrange, choice, code) => {
    arrange();
    const { createPlanCheckout } = await checkout();

    await expect(createPlanCheckout(buyer, choice)).rejects.toMatchObject({ code });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it("is refused for a workspace that already pays: it changes plan, it does not subscribe again", async () => {
    await testDb.insert(plan).values({ id: "pro", name: "Pro", price: 2900 });
    await seedSubscription(ORG, { planId: "pro", status: "active", stripeSubscriptionId: "sub_live" });
    const { createPlanCheckout } = await checkout();

    await expect(createPlanCheckout(buyer, { planId: "enterprise", interval: "monthly" })).rejects.toMatchObject({ code: "already_subscribed" });
  });

  it("is allowed again once the subscription is over", async () => {
    await testDb.insert(plan).values({ id: "pro", name: "Pro", price: 2900 });
    await seedSubscription(ORG, { planId: "pro", status: "canceled", stripeSubscriptionId: "sub_dead" });
    const { createPlanCheckout } = await checkout();

    await expect(createPlanCheckout(buyer, { planId: "pro", interval: "monthly" })).resolves.toMatchObject({ kind: "embedded" });
  });

  it("is refused for a workspace that does not exist", async () => {
    const { createPlanCheckout } = await checkout();

    await expect(createPlanCheckout({ ...buyer, orgId: "nowhere" }, { planId: "pro", interval: "monthly" })).rejects.toMatchObject({ code: "unknown_workspace" });
  });
});

describe("the checkout of a pack of credits", () => {
  it("is a one-off payment, with what is credited kept in the metadata for the webhook to check against the catalog", async () => {
    const { createPackCheckout } = await checkout();

    await createPackCheckout(buyer, "credits-1000");

    expect(sessions.create.mock.calls[0]![0]).toMatchObject({
      mode: "payment",
      line_items: [{ price: "price_credits-1000", quantity: 1 }],
      metadata: { orgId: ORG, userId: ADMIN, kind: "credit_pack", packId: "credits-1000", credits: "1000" },
    });
    expect(sessions.create.mock.calls[0]![0]).not.toHaveProperty("subscription_data");
  });

  it.each([
    ["a pack the app does not sell", "credits-1", "unknown_pack"],
    ["a pack with no price in the catalog", "credits-5000", "price_missing"],
  ])("is refused for %s", async (_, packId, code) => {
    const { createPackCheckout } = await checkout();

    await expect(createPackCheckout(buyer, packId)).rejects.toMatchObject({ code });
  });
});
