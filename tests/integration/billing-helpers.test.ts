import { beforeEach, describe, expect, it, vi } from "vitest";
import { organization, plan, subscription } from "@/models";
import {
  seedOrg,
  seedPlan,
  seedSubscription,
} from "../helpers/seed";
import { testDb } from "../setup";

// Mock Stripe SDK
const mockCheckoutCreate = vi.fn();
const mockPortalCreate = vi.fn();
const mockCustomerCreate = vi.fn();

vi.mock("@/features/billing/stripe", () => ({
  getStripe: vi.fn().mockReturnValue({
    checkout: { sessions: { create: (...args: unknown[]) => mockCheckoutCreate(...args) } },
    billingPortal: { sessions: { create: (...args: unknown[]) => mockPortalCreate(...args) } },
    customers: { create: (...args: unknown[]) => mockCustomerCreate(...args) },
  }),
}));

const TEST_ORG = "billing-org-1";
const STRIPE_CUSTOMER_ID = "cus_billing_test";
const STRIPE_PRICE_ID = "price_pro_monthly";

describe("billing helpers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(subscription);
    await testDb.delete(plan);
    await testDb.delete(organization);

    await seedOrg(TEST_ORG, { slug: "billing-org" });
  });

  describe("createCheckoutSession", () => {
    it("uses existing customer ID when subscription exists", async () => {
      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedSubscription(TEST_ORG, {
        id: "sub-existing",
        stripeCustomerId: STRIPE_CUSTOMER_ID,
        planId: "pro",
      });

      const mockSession = { id: "cs_test_123", url: "https://checkout.stripe.com/123" };
      mockCheckoutCreate.mockResolvedValue(mockSession);

      const { createCheckoutSession } = await import(
        "@/features/billing/helpers"
      );

      const result = await createCheckoutSession(TEST_ORG, STRIPE_PRICE_ID);

      expect(mockCustomerCreate).not.toHaveBeenCalled();
      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: STRIPE_CUSTOMER_ID,
          mode: "subscription",
          line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
          metadata: { orgId: TEST_ORG },
        }),
      );
      expect(result).toEqual(mockSession);
    });

    it("creates a new Stripe customer when no subscription exists", async () => {
      mockCustomerCreate.mockResolvedValue({ id: "cus_new_123" });
      const mockSession = { id: "cs_test_456", url: "https://checkout.stripe.com/456" };
      mockCheckoutCreate.mockResolvedValue(mockSession);

      const { createCheckoutSession } = await import(
        "@/features/billing/helpers"
      );

      const result = await createCheckoutSession(TEST_ORG, STRIPE_PRICE_ID);

      expect(mockCustomerCreate).toHaveBeenCalledWith({
        metadata: { orgId: TEST_ORG },
      });
      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_new_123",
        }),
      );
      expect(result).toEqual(mockSession);
    });

    it("uses custom success and cancel URLs when provided", async () => {
      mockCustomerCreate.mockResolvedValue({ id: "cus_url_test" });
      mockCheckoutCreate.mockResolvedValue({ id: "cs_test_url" });

      const { createCheckoutSession } = await import(
        "@/features/billing/helpers"
      );

      await createCheckoutSession(
        TEST_ORG,
        STRIPE_PRICE_ID,
        "https://example.com/success",
        "https://example.com/cancel",
      );

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel",
        }),
      );
    });

    it("uses default URLs when no custom URLs are provided", async () => {
      mockCustomerCreate.mockResolvedValue({ id: "cus_default_url" });
      mockCheckoutCreate.mockResolvedValue({ id: "cs_default_url" });

      const { createCheckoutSession } = await import(
        "@/features/billing/helpers"
      );

      await createCheckoutSession(TEST_ORG, STRIPE_PRICE_ID);

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: expect.stringContaining("/settings/billing?success=true"),
          cancel_url: expect.stringContaining("/settings/billing?canceled=true"),
        }),
      );
    });
  });

  describe("createPortalSession", () => {
    it("creates a portal session with valid subscription", async () => {
      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedSubscription(TEST_ORG, {
        id: "sub-portal",
        stripeCustomerId: STRIPE_CUSTOMER_ID,
        planId: "pro",
      });

      const mockSession = { id: "bps_test_123", url: "https://billing.stripe.com/123" };
      mockPortalCreate.mockResolvedValue(mockSession);

      const { createPortalSession } = await import(
        "@/features/billing/helpers"
      );

      const result = await createPortalSession(TEST_ORG);

      expect(mockPortalCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: STRIPE_CUSTOMER_ID,
          return_url: expect.stringContaining("/settings/billing"),
        }),
      );
      expect(result).toEqual(mockSession);
    });

    it("throws when no subscription exists for the organization", async () => {
      const { createPortalSession } = await import(
        "@/features/billing/helpers"
      );

      await expect(createPortalSession(TEST_ORG)).rejects.toThrow(
        "No Stripe customer found for this organization",
      );
      expect(mockPortalCreate).not.toHaveBeenCalled();
    });

    it("throws when subscription exists but has no Stripe customer ID", async () => {
      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedSubscription(TEST_ORG, {
        id: "sub-no-cust",
        stripeCustomerId: null,
        planId: "pro",
      });

      const { createPortalSession } = await import(
        "@/features/billing/helpers"
      );

      await expect(createPortalSession(TEST_ORG)).rejects.toThrow(
        "No Stripe customer found for this organization",
      );
      expect(mockPortalCreate).not.toHaveBeenCalled();
    });
  });

  describe("checkPlanLimit", () => {
    it("returns free plan defaults when no subscription exists", async () => {
      const { checkPlanLimit } = await import("@/features/billing/helpers");

      const result = await checkPlanLimit(TEST_ORG, "members");

      // Free plan: members = 1
      expect(result).toEqual({ allowed: true, limit: 1 });
    });

    it("returns allowed false with limit 0 for missing feature on free plan", async () => {
      const { checkPlanLimit } = await import("@/features/billing/helpers");

      const result = await checkPlanLimit(TEST_ORG, "nonExistentFeature");

      expect(result).toEqual({ allowed: false, limit: 0 });
    });

    it("returns the limit from a paid plan in the database", async () => {
      await seedPlan("pro", {
        name: "Pro",
        price: 2900,
        limits: { members: 10, projects: 50, storage: 10000 },
      });
      await seedSubscription(TEST_ORG, {
        id: "sub-limits",
        planId: "pro",
        status: "active",
      });

      const { checkPlanLimit } = await import("@/features/billing/helpers");

      const result = await checkPlanLimit(TEST_ORG, "members");

      expect(result).toEqual({ allowed: true, limit: 10 });
    });

    it("handles unlimited (-1) limits", async () => {
      await seedPlan("enterprise", {
        name: "Enterprise",
        price: 9900,
        limits: { members: -1, projects: -1, storage: -1 },
      });
      await seedSubscription(TEST_ORG, {
        id: "sub-unlimited",
        planId: "enterprise",
        status: "active",
      });

      const { checkPlanLimit } = await import("@/features/billing/helpers");

      const result = await checkPlanLimit(TEST_ORG, "members");

      expect(result).toEqual({ allowed: true, limit: -1 });
    });

    it("returns not allowed when plan has 0 for the feature", async () => {
      await seedPlan("basic", {
        name: "Basic",
        price: 500,
        limits: { members: 5, apiCalls: 0 },
      });
      await seedSubscription(TEST_ORG, {
        id: "sub-zero",
        planId: "basic",
        status: "active",
      });

      const { checkPlanLimit } = await import("@/features/billing/helpers");

      const result = await checkPlanLimit(TEST_ORG, "apiCalls");

      expect(result).toEqual({ allowed: false, limit: 0 });
    });

    it("returns not allowed when plan has null limits", async () => {
      await seedPlan("minimal", { name: "Minimal", price: 100, limits: null });
      await seedSubscription(TEST_ORG, {
        id: "sub-minimal",
        planId: "minimal",
        status: "active",
      });

      const { checkPlanLimit } = await import("@/features/billing/helpers");

      const result = await checkPlanLimit(TEST_ORG, "members");

      expect(result).toEqual({ allowed: false, limit: 0 });
    });

    it("returns not allowed for unknown feature on a paid plan", async () => {
      await seedPlan("pro", {
        name: "Pro",
        price: 2900,
        limits: { members: 10 },
      });
      await seedSubscription(TEST_ORG, {
        id: "sub-unknown-feat",
        planId: "pro",
        status: "active",
      });

      const { checkPlanLimit } = await import("@/features/billing/helpers");

      const result = await checkPlanLimit(TEST_ORG, "unknownFeature");

      expect(result).toEqual({ allowed: false, limit: 0 });
    });
  });

  describe("getSubscriptionForOrg", () => {
    it("returns free plan defaults when no subscription exists", async () => {
      const { getSubscriptionForOrg } = await import(
        "@/features/billing/helpers"
      );

      const result = await getSubscriptionForOrg(TEST_ORG);

      expect(result).toEqual({
        planId: "free",
        status: "active",
        subscription: null,
      });
    });

    it("returns the subscription data when one exists", async () => {
      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedSubscription(TEST_ORG, {
        id: "sub-get",
        planId: "pro",
        status: "active",
        stripeCustomerId: STRIPE_CUSTOMER_ID,
        stripeSubscriptionId: "sub_stripe_get",
      });

      const { getSubscriptionForOrg } = await import(
        "@/features/billing/helpers"
      );

      const result = await getSubscriptionForOrg(TEST_ORG);

      expect(result.planId).toBe("pro");
      expect(result.status).toBe("active");
      expect(result.subscription).not.toBeNull();
      expect(result.subscription?.id).toBe("sub-get");
      expect(result.subscription?.stripeCustomerId).toBe(STRIPE_CUSTOMER_ID);
    });

    it("returns correct status for a canceled subscription", async () => {
      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedSubscription(TEST_ORG, {
        id: "sub-canceled",
        planId: "pro",
        status: "canceled",
      });

      const { getSubscriptionForOrg } = await import(
        "@/features/billing/helpers"
      );

      const result = await getSubscriptionForOrg(TEST_ORG);

      expect(result.planId).toBe("pro");
      expect(result.status).toBe("canceled");
      expect(result.subscription).not.toBeNull();
    });
  });
});
