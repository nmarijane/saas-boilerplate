import type { FeatureShell } from "@/shared/shell/contract";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOrganization } from "@/features/auth/organization/actions";
import { billingShell } from "@/features/billing/shell";
import { FEATURES } from "@/features/registry";
import { organization, organizationMember, plan, subscription, user } from "@/models";
import { seedOrg, seedOrgMember, seedPlan, seedSubscription, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What billing does when a workspace is deleted, with the features of the
 * registry: it cancels the subscription at the provider before the rows go,
 * and a cancel that fails keeps the workspace, so that nobody is left paying
 * for a workspace that is gone. The provider is faked at its adapter: each call
 * records whether the workspace still existed when it was made.
 */

const { stripe, cancel, retrieve, registry } = vi.hoisted(() => ({
  stripe: { unset: false },
  cancel: vi.fn(),
  retrieve: vi.fn(),
  registry: { list: null as FeatureShell[] | null },
}));
// The registry of the app, unless a case gives its own
vi.mock("@/features/registry", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/features/registry")>();
  return {
    get FEATURES() {
      return registry.list ?? real.FEATURES;
    },
  };
});
vi.mock("@/features/billing/stripe", () => ({
  getStripe: () => {
    if (stripe.unset) {
      throw new Error("STRIPE_SECRET_KEY is required. Set it in your .env file.");
    }
    return { subscriptions: { cancel, retrieve } };
  },
}));
// The registry reaches the client components of the features, and the navigation
// of next-intl they import is replaced (no Next router runs in a test)
vi.mock("@/shared/lib/i18n-navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
}));

const OWNER = "test-user-1"; // the person the mocked guard signs in
const ORG = "billing-deletion-org";

async function workspaceExists() {
  return (await testDb.select({ id: organization.id }).from(organization).where(eq(organization.id, ORG))).length === 1;
}

const cancelled: string[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
  cancelled.length = 0;
  stripe.unset = false;
  registry.list = null;
  cancel.mockImplementation(async (id: string) => {
    cancelled.push(`${id}:${(await workspaceExists()) ? "kept" : "gone"}`);
  });
  // Stripe reads the subscription live, unless a case says otherwise
  retrieve.mockReset().mockResolvedValue({ id: "sub_northwind", status: "active" });

  await testDb.delete(subscription);
  await testDb.delete(plan);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(OWNER);
  await seedOrg(ORG, { name: "Northwind" });
  await seedOrgMember(OWNER, ORG, "owner");
  await seedPlan("free", { name: "Free", price: 0 });
  await seedPlan("pro");
  await seedSubscription(ORG, { stripeSubscriptionId: "sub_northwind", status: "active" });
});

describe("deleting a workspace that has a subscription", () => {
  it("cancels the subscription at the provider while the workspace is still there, then deletes it", async () => {
    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });

    expect(cancelled).toEqual(["sub_northwind:kept"]);
    expect(await workspaceExists()).toBe(false);
  });

  it("keeps the workspace and its subscription when the provider cannot cancel it, and says why", async () => {
    cancel.mockRejectedValue(new Error("the provider did not answer"));

    expect(await deleteOrganization({ orgId: ORG })).toEqual({
      success: true,
      data: { deleted: false, messageKey: "billing.deleteWorkspaceFailed", done: [] },
    });

    expect(await workspaceExists()).toBe(true);
    expect(await testDb.select({ status: subscription.status }).from(subscription).where(eq(subscription.organizationId, ORG))).toEqual([{ status: "active" }]);
  });

  it("keeps a workspace whose subscription is live at the provider when Stripe is not set up: it could not be cancelled", async () => {
    stripe.unset = true;

    expect((await deleteOrganization({ orgId: ORG })).success).toBe(true);
    expect(await workspaceExists()).toBe(true);
  });

  it("takes a subscription the provider no longer has for one that is not live there", async () => {
    cancel.mockRejectedValue(Object.assign(new Error("No such subscription"), { code: "resource_missing" }));

    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });
    expect(await workspaceExists()).toBe(false);
  });

  // Cancelled in the Stripe dashboard, say, before its webhook came: Stripe
  // refuses to cancel it again, and the subscription reads cancelled there
  it("deletes a workspace whose subscription Stripe had cancelled already, though its row still said it was live", async () => {
    cancel.mockRejectedValue(Object.assign(new Error("The subscription cannot be cancelled"), { type: "StripeInvalidRequestError" }));
    retrieve.mockResolvedValue({ id: "sub_northwind", status: "canceled" });

    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });
    expect(await workspaceExists()).toBe(false);
  });

  it("asks nothing of the provider for a workspace with no subscription there, even with Stripe not set up", async () => {
    stripe.unset = true;
    for (const overrides of [null, { stripeSubscriptionId: null }, { status: "canceled" }]) {
      await testDb.delete(subscription);
      await seedOrg(ORG, { name: "Northwind" });
      if (overrides) {
        await seedSubscription(ORG, overrides);
      }

      expect(await deleteOrganization({ orgId: ORG }), JSON.stringify(overrides)).toEqual({ success: true, data: { deleted: true } });
      expect(await workspaceExists(), JSON.stringify(overrides)).toBe(false);
    }
    expect(cancel).not.toHaveBeenCalled();
  });

  // The subscription is marked cancelled as soon as Stripe has cancelled it, on
  // the free plan, as its webhook would: the workspace kept by a later step has
  // no paid credits left. Each try that a later step stops says the subscription
  // is cancelled, and none asks Stripe again, whatever its webhook or its answer
  // to a second cancel.
  it("marks the subscription cancelled at once, says so when a later step stops the deletion, and does not cancel it twice", async () => {
    let filesFail = true;
    registry.list = [
      billingShell,
      {
        id: "files",
        onWorkspaceDelete: {
          order: 50,
          run: async () => {
            if (filesFail) throw new Error("the storage did not answer");
            return null;
          },
          failureKey: "upload.deleteWorkspaceFailed",
        },
      },
    ];

    const stopped = {
      success: true,
      data: { deleted: false, messageKey: "upload.deleteWorkspaceFailed", done: ["billing.subscriptionCancelled"] },
    };
    expect(await deleteOrganization({ orgId: ORG })).toEqual(stopped);
    expect(await testDb.select({ status: subscription.status, planId: subscription.planId }).from(subscription).where(eq(subscription.organizationId, ORG))).toEqual([{ status: "canceled", planId: "free" }]);

    expect(await deleteOrganization({ orgId: ORG })).toEqual(stopped);

    filesFail = false;
    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });
    expect(cancel).toHaveBeenCalledOnce();
    expect(await workspaceExists()).toBe(false);
  });

  it("is billing's own cleanup, declared in its shell.ts: it goes with its line of the registry", () => {
    expect(billingShell.onWorkspaceDelete).toMatchObject({ order: 10, failureKey: "billing.deleteWorkspaceFailed" });
    expect(FEATURES).toContain(billingShell);
  });
});
