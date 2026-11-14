import { beforeEach, describe, expect, it, vi } from "vitest";
import { organization, plan, subscription } from "@/models";
import {
  seedOrg,
  seedPlan,
  seedSubscription,
} from "../helpers/seed";
import { testDb } from "../setup";

const portal = vi.hoisted(() => ({ configuration: "" }));
vi.mock("@/shared/lib/env", async (importOriginal) => {
  const { env } = await importOriginal<typeof import("@/shared/lib/env")>();
  return { env: new Proxy(env, { get: (target, key) => (key === "STRIPE_PORTAL_CONFIGURATION_ID" ? portal.configuration : Reflect.get(target, key)) }) };
});

// Mock Stripe SDK
const mockPortalCreate = vi.fn();

vi.mock("@/features/billing/stripe", () => ({
  getStripe: vi.fn().mockReturnValue({
    billingPortal: { sessions: { create: (...args: unknown[]) => mockPortalCreate(...args) } },
  }),
}));

const TEST_ORG = "billing-org-1";
const STRIPE_CUSTOMER_ID = "cus_billing_test";

describe("billing helpers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(subscription);
    await testDb.delete(plan);
    await testDb.delete(organization);

    await seedOrg(TEST_ORG, { slug: "billing-org" });
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

    it("opens the configuration of the app when one is set: the portal that has no cancellation in it", async () => {
      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedSubscription(TEST_ORG, { id: "sub-portal-2", stripeCustomerId: STRIPE_CUSTOMER_ID, planId: "pro" });
      mockPortalCreate.mockResolvedValue({ id: "bps_2", url: "https://billing.stripe.com/2" });
      const { createPortalSession } = await import("@/features/billing/helpers");

      portal.configuration = "bpc_app";
      await createPortalSession(TEST_ORG);
      expect(mockPortalCreate.mock.calls[0]![0]).toMatchObject({ configuration: "bpc_app" });

      portal.configuration = "";
      mockPortalCreate.mockClear();
      await createPortalSession(TEST_ORG);
      expect(mockPortalCreate.mock.calls[0]![0]).not.toHaveProperty("configuration");
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
