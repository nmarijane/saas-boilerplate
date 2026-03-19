import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitEvent } from "@/features/events/emitter";
import { plan, subscription } from "@/models";
import {
  seedOrg,
  seedOrgMember,
  seedPlan,
  seedSubscription,
  seedUser,
} from "../helpers/seed";
import { testDb } from "../setup";

// Mock Stripe SDK
const mockRetrieve = vi.fn();

vi.mock("@/features/billing/stripe", () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: {
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
    },
  }),
}));

const BILL_USER = "bill-user-1";
const BILL_ORG = "bill-org-1";
const STRIPE_SUB_ID = "sub_test_stripe";
const STRIPE_CUSTOMER_ID = "cus_test_stripe";
const PRICE_PRO = "price_pro";
const PERIOD_END = Math.floor(Date.now() / 1000) + 2592000;

function makeStripeSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: STRIPE_SUB_ID,
    items: { data: [{ price: { id: PRICE_PRO } }] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
    current_period_end: PERIOD_END,
    status: "active",
    metadata: { orgId: BILL_ORG },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("billing webhook handlers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clean up tables in reverse dependency order
    await testDb.delete(subscription);
    await testDb.delete(plan);

    // Seed base data
    await seedUser(BILL_USER);
    await seedOrg(BILL_ORG);
    await seedOrgMember(BILL_USER, BILL_ORG, "owner");
    await seedPlan("free", { name: "Free", price: 0, stripePriceId: "price_free" });
    await seedPlan("pro", { name: "Pro", price: 1999, stripePriceId: PRICE_PRO });

    // Default mock for Stripe subscription retrieve
    mockRetrieve.mockResolvedValue(makeStripeSubscription());
  });

  describe("handleCheckoutCompleted", () => {
    it("creates a new subscription when none exists", async () => {
      const { handleCheckoutCompleted } = await import(
        "@/features/billing/webhook-handlers"
      );

      const session = {
        metadata: { orgId: BILL_ORG },
        subscription: STRIPE_SUB_ID,
        customer: STRIPE_CUSTOMER_ID,
      } as unknown as Stripe.Checkout.Session;

      await handleCheckoutCompleted(session);

      const subs = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, BILL_ORG));

      expect(subs).toHaveLength(1);
      expect(subs[0].stripeSubscriptionId).toBe(STRIPE_SUB_ID);
      expect(subs[0].stripeCustomerId).toBe(STRIPE_CUSTOMER_ID);
      expect(subs[0].status).toBe("active");
      expect(subs[0].planId).toBe("pro");
      expect(emitEvent).toHaveBeenCalledWith(
        "subscription.created",
        expect.objectContaining({ orgId: BILL_ORG, metadata: { planId: "pro" } }),
      );
    });

    it("updates an existing subscription", async () => {
      await seedSubscription(BILL_ORG, {
        id: "sub-existing",
        stripeCustomerId: "cus_old",
        stripeSubscriptionId: "sub_old",
        status: "past_due",
        planId: "free",
      });

      const { handleCheckoutCompleted } = await import(
        "@/features/billing/webhook-handlers"
      );

      const session = {
        metadata: { orgId: BILL_ORG },
        subscription: STRIPE_SUB_ID,
        customer: STRIPE_CUSTOMER_ID,
      } as unknown as Stripe.Checkout.Session;

      await handleCheckoutCompleted(session);

      const subs = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, BILL_ORG));

      expect(subs).toHaveLength(1);
      expect(subs[0].stripeSubscriptionId).toBe(STRIPE_SUB_ID);
      expect(subs[0].status).toBe("active");
      expect(subs[0].planId).toBe("pro");
    });

    it("returns early when orgId is missing", async () => {
      const { handleCheckoutCompleted } = await import(
        "@/features/billing/webhook-handlers"
      );

      const session = {
        metadata: {},
        subscription: STRIPE_SUB_ID,
      } as unknown as Stripe.Checkout.Session;

      await handleCheckoutCompleted(session);

      const subs = await testDb.select().from(subscription);
      expect(subs).toHaveLength(0);
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it("returns early when subscription is missing", async () => {
      const { handleCheckoutCompleted } = await import(
        "@/features/billing/webhook-handlers"
      );

      const session = {
        metadata: { orgId: BILL_ORG },
        subscription: null,
      } as unknown as Stripe.Checkout.Session;

      await handleCheckoutCompleted(session);

      const subs = await testDb.select().from(subscription);
      expect(subs).toHaveLength(0);
      expect(emitEvent).not.toHaveBeenCalled();
    });
  });

  describe("handleInvoicePaid", () => {
    it("updates subscription status to active", async () => {
      await seedSubscription(BILL_ORG, {
        id: "sub-inv-paid",
        stripeSubscriptionId: STRIPE_SUB_ID,
        status: "past_due",
      });

      const { handleInvoicePaid } = await import(
        "@/features/billing/webhook-handlers"
      );

      const invoice = {
        subscription: STRIPE_SUB_ID,
      } as unknown as Stripe.Invoice;

      await handleInvoicePaid(invoice);

      const subs = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.stripeSubscriptionId, STRIPE_SUB_ID));

      expect(subs[0].status).toBe("active");
      expect(emitEvent).toHaveBeenCalledWith(
        "payment.succeeded",
        expect.objectContaining({
          orgId: BILL_ORG,
          resourceType: "subscription",
        }),
      );
    });

    it("does nothing when subscription ID is missing", async () => {
      const { handleInvoicePaid } = await import(
        "@/features/billing/webhook-handlers"
      );

      const invoice = {
        subscription: null,
      } as unknown as Stripe.Invoice;

      await handleInvoicePaid(invoice);
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it("does nothing when subscription not found in DB", async () => {
      const { handleInvoicePaid } = await import(
        "@/features/billing/webhook-handlers"
      );

      const invoice = {
        subscription: "sub_nonexistent",
      } as unknown as Stripe.Invoice;

      await handleInvoicePaid(invoice);
      expect(emitEvent).not.toHaveBeenCalled();
    });
  });

  describe("handleInvoicePaymentFailed", () => {
    it("updates subscription status to past_due", async () => {
      await seedSubscription(BILL_ORG, {
        id: "sub-inv-fail",
        stripeSubscriptionId: STRIPE_SUB_ID,
        status: "active",
      });

      const { handleInvoicePaymentFailed } = await import(
        "@/features/billing/webhook-handlers"
      );

      const invoice = {
        subscription: STRIPE_SUB_ID,
      } as unknown as Stripe.Invoice;

      await handleInvoicePaymentFailed(invoice);

      const subs = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.stripeSubscriptionId, STRIPE_SUB_ID));

      expect(subs[0].status).toBe("past_due");
      expect(emitEvent).toHaveBeenCalledWith(
        "payment.failed",
        expect.objectContaining({
          orgId: BILL_ORG,
          resourceType: "subscription",
        }),
      );
    });

    it("does nothing when subscription ID is missing", async () => {
      const { handleInvoicePaymentFailed } = await import(
        "@/features/billing/webhook-handlers"
      );

      const invoice = {
        subscription: null,
      } as unknown as Stripe.Invoice;

      await handleInvoicePaymentFailed(invoice);
      expect(emitEvent).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionUpdated", () => {
    it("updates plan and period", async () => {
      await seedSubscription(BILL_ORG, {
        id: "sub-upd",
        stripeSubscriptionId: STRIPE_SUB_ID,
        status: "active",
        planId: "free",
      });

      const { handleSubscriptionUpdated } = await import(
        "@/features/billing/webhook-handlers"
      );

      await handleSubscriptionUpdated(makeStripeSubscription());

      const subs = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, BILL_ORG));

      expect(subs[0].planId).toBe("pro");
      expect(subs[0].status).toBe("active");
      expect(subs[0].currentPeriodEnd).toEqual(new Date(PERIOD_END * 1000));
      expect(emitEvent).toHaveBeenCalledWith(
        "subscription.updated",
        expect.objectContaining({ orgId: BILL_ORG, metadata: { planId: "pro" } }),
      );
    });

    it("sets status to past_due when Stripe status is not active", async () => {
      await seedSubscription(BILL_ORG, {
        id: "sub-upd-past",
        stripeSubscriptionId: STRIPE_SUB_ID,
        status: "active",
      });

      const { handleSubscriptionUpdated } = await import(
        "@/features/billing/webhook-handlers"
      );

      await handleSubscriptionUpdated(
        makeStripeSubscription({ status: "past_due" }),
      );

      const subs = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, BILL_ORG));

      expect(subs[0].status).toBe("past_due");
    });

    it("returns early when orgId is missing from metadata", async () => {
      const { handleSubscriptionUpdated } = await import(
        "@/features/billing/webhook-handlers"
      );

      await handleSubscriptionUpdated(
        makeStripeSubscription({ metadata: {} }),
      );

      expect(emitEvent).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionDeleted", () => {
    it("sets status to canceled and planId to free", async () => {
      await seedSubscription(BILL_ORG, {
        id: "sub-del",
        stripeSubscriptionId: STRIPE_SUB_ID,
        status: "active",
        planId: "pro",
      });

      const { handleSubscriptionDeleted } = await import(
        "@/features/billing/webhook-handlers"
      );

      await handleSubscriptionDeleted(makeStripeSubscription());

      const subs = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, BILL_ORG));

      expect(subs[0].status).toBe("canceled");
      expect(subs[0].planId).toBe("free");
      expect(emitEvent).toHaveBeenCalledWith(
        "subscription.cancelled",
        expect.objectContaining({ orgId: BILL_ORG }),
      );
    });

    it("returns early when orgId is missing from metadata", async () => {
      const { handleSubscriptionDeleted } = await import(
        "@/features/billing/webhook-handlers"
      );

      await handleSubscriptionDeleted(
        makeStripeSubscription({ metadata: {} }),
      );

      expect(emitEvent).not.toHaveBeenCalled();
    });
  });
});
