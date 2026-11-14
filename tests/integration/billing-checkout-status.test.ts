import { beforeEach, describe, expect, it, vi } from "vitest";
import { organization, plan, subscription } from "@/models";
import { seedOrg, seedPlan, seedSubscription } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What the page that waits for a payment is told. The provider is a client that answers with the session and the
 * subscription it made; the guard of the role is not what is asked here (server-action-guards.test.ts asks it).
 */

const { sessions, subscriptions } = vi.hoisted(() => ({ sessions: { retrieve: vi.fn() }, subscriptions: { retrieve: vi.fn() } }));
vi.mock("@/features/billing/stripe", () => ({ getStripe: () => ({ checkout: { sessions }, subscriptions }) }));
vi.mock("@/features/auth/guards", async (importOriginal) => ({ ...(await importOriginal<object>()), requireRole: vi.fn() }));
vi.mock("@/shared/lib/env", () => ({ env: { STRIPE_SECRET_KEY: "fake-secret-key" } }));

const ORG = "status-org";

const session = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_1",
  status: "complete",
  client_secret: null,
  subscription: "sub_1",
  metadata: { orgId: ORG, kind: "subscription", planId: "pro", interval: "monthly", trialDays: "14" },
  ...overrides,
});

beforeEach(async () => {
  vi.clearAllMocks();
  sessions.retrieve.mockReset().mockResolvedValue(session());
  subscriptions.retrieve.mockReset();
  await testDb.delete(subscription);
  await testDb.delete(plan);
  await testDb.delete(organization);
  await seedOrg(ORG);
});

describe("the state of a checkout that was paid", () => {
  it("is ready once the subscription is live in the row", async () => {
    const { getCheckoutStatus } = await import("@/features/billing/checkout-status");
    await seedPlan("pro");
    await seedSubscription(ORG, { planId: "pro", status: "trialing", stripeSubscriptionId: "sub_1" });

    expect(await getCheckoutStatus("cs_1")).toEqual({ state: "ready", kind: "subscription" });
  });

  it("is pending while the webhook has not run, and asks nothing of the subscription that is not refused", async () => {
    const { getCheckoutStatus } = await import("@/features/billing/checkout-status");
    subscriptions.retrieve.mockResolvedValue({ status: "trialing", cancellation_details: null });

    expect(await getCheckoutStatus("cs_1")).toEqual({ state: "pending", kind: "subscription" });
  });

  it("says that the trial was already used when the subscription was cancelled for it", async () => {
    const { getCheckoutStatus } = await import("@/features/billing/checkout-status");
    subscriptions.retrieve.mockResolvedValue({ status: "canceled", cancellation_details: { comment: "trial_already_used" } });

    expect(await getCheckoutStatus("cs_1")).toEqual({ state: "trial_spent", kind: "subscription" });
  });

  it("does not say it of a subscription that was cancelled for another reason", async () => {
    const { getCheckoutStatus } = await import("@/features/billing/checkout-status");
    subscriptions.retrieve.mockResolvedValue({ status: "canceled", cancellation_details: { comment: "too expensive" } });

    expect(await getCheckoutStatus("cs_1")).toEqual({ state: "pending", kind: "subscription" });
  });

  it("stays pending when the subscription cannot be read now", async () => {
    const { getCheckoutStatus } = await import("@/features/billing/checkout-status");
    subscriptions.retrieve.mockRejectedValue(new Error("offline"));

    expect(await getCheckoutStatus("cs_1")).toEqual({ state: "pending", kind: "subscription" });
  });
});
