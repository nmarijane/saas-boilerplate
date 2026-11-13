import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlanById } from "@/features/billing/plans";
import { getWorkspacePlan, getWorkspacePlans } from "@/features/billing/queries";
import { organization, plan, subscription } from "@/models";
import { seedOrg, seedPlan, seedSubscription } from "../helpers/seed";
import { testDb } from "../setup";

// The Stripe client is built lazily and never reached here; the stub keeps the SDK out of the test.
vi.mock("@/features/billing/stripe", () => ({ getStripe: vi.fn() }));

const ORG = "bp-org-1";

describe("workspace plan", () => {
  beforeEach(async () => {
    await testDb.delete(subscription);
    await testDb.delete(plan);
    await testDb.delete(organization);
    await seedOrg(ORG, { slug: "bp-org" });
  });

  it("reads the plan of an active subscription", async () => {
    await seedPlan("pro");
    await seedSubscription(ORG, { planId: "pro", status: "active" });

    const summary = await getWorkspacePlan(ORG);

    expect(summary).toMatchObject({ id: "pro", name: "Pro", upgradeHref: "/settings/billing" });
    expect(summary.limits.projects).toBe(50);
  });

  it("reads the plan of a trial", async () => {
    await seedPlan("pro");
    await seedSubscription(ORG, { planId: "pro", status: "trialing" });

    expect(await getWorkspacePlan(ORG)).toMatchObject({ id: "pro", name: "Pro" });
  });

  it("falls back to the free plan without a live subscription", async () => {
    // Never subscribed.
    const never = await getWorkspacePlan(ORG);
    expect(never).toMatchObject({ id: "free", name: "Free", upgradeHref: "/settings/billing" });
    expect(never.limits.projects).toBe(3);

    // Canceled, or behind on payment: not live.
    await seedPlan("pro");
    for (const status of ["canceled", "past_due"]) {
      await testDb.delete(subscription);
      await seedSubscription(ORG, { planId: "pro", status });

      const summary = await getWorkspacePlan(ORG);

      expect(summary.id, `a ${status} subscription`).toBe("free");
      expect(summary.limits.projects, `a ${status} subscription`).toBe(3);
    }
  });

  it("falls back to the free plan for a plan the configuration does not know", async () => {
    await seedPlan("legacy", { name: "Legacy" });
    await seedSubscription(ORG, { planId: "legacy", status: "active" });

    expect(await getWorkspacePlan(ORG)).toMatchObject({ id: "free" });
  });

  // The billing page and its actions are an admin's: the shell offers the upgrade from that role up.
  it("names the lowest role that may change the plan: the one the billing actions ask", async () => {
    const { BILLING_MIN_ROLE } = await import("@/features/billing/permissions");

    expect(BILLING_MIN_ROLE).toBe("admin");
    expect(await getWorkspacePlan(ORG)).toMatchObject({ id: "free", upgradeMinRole: BILLING_MIN_ROLE });
  });

  it("offers no upgrade from the highest plan", async () => {
    await seedPlan("enterprise", { name: "Enterprise" });
    await seedSubscription(ORG, { planId: "enterprise", status: "active" });

    const summary = await getWorkspacePlan(ORG);

    expect(summary).toMatchObject({ id: "enterprise", name: "Enterprise", upgradeHref: null });
    // -1 is how the configuration says unlimited.
    expect(summary.limits.projects).toBe(-1);
  });

  it("takes the limits from the configuration, as a copy", async () => {
    await seedPlan("pro");
    await seedSubscription(ORG, { planId: "pro", status: "active" });

    const summary = await getWorkspacePlan(ORG);

    expect(summary.limits).toEqual(getPlanById("pro")?.limits);
    expect(summary.limits).not.toBe(getPlanById("pro")?.limits);
  });
});

// The shell reads the plan of every workspace of a person, on every page: one query, however many workspaces there are.
describe("the plans of many workspaces", () => {
  const ORGS = Array.from({ length: 40 }, (_, index) => `bp-many-${index}`);

  beforeEach(async () => {
    await testDb.delete(subscription);
    await testDb.delete(plan);
    await testDb.delete(organization);
    await seedPlan("pro");
    for (const id of ORGS) {
      await seedOrg(id, { slug: id });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** How many statements the database got while a call ran. */
  async function statementsOf(call: () => Promise<unknown>): Promise<number> {
    const query = vi.spyOn(testDb.$client, "query");
    await call();

    return query.mock.calls.length;
  }

  it.each([1, 4, 40])("reads the plans of %i workspaces with one statement", async (howMany) => {
    expect(await statementsOf(() => getWorkspacePlans(ORGS.slice(0, howMany)))).toBe(1);
  });

  it("reads nothing for no workspace", async () => {
    expect(await statementsOf(() => getWorkspacePlans([]))).toBe(0);
    expect((await getWorkspacePlans([])).size).toBe(0);
  });

  it("gives each workspace its own plan", async () => {
    await seedSubscription(ORGS[0]!, { planId: "pro", status: "active" });
    await seedSubscription(ORGS[1]!, { planId: "pro", status: "canceled" });
    await seedSubscription(ORGS[2]!, { planId: "pro", status: "trialing" });

    const plans = await getWorkspacePlans(ORGS.slice(0, 4));

    expect([...plans.keys()]).toEqual(ORGS.slice(0, 4));
    expect(ORGS.slice(0, 4).map((id) => plans.get(id)?.id)).toEqual(["pro", "free", "pro", "free"]);
  });

  it("gives, for a workspace, what the read of that workspace alone gives", async () => {
    await seedSubscription(ORGS[0]!, { planId: "pro", status: "active" });
    const plans = await getWorkspacePlans(ORGS.slice(0, 3));

    for (const id of ORGS.slice(0, 3)) {
      expect(plans.get(id), id).toEqual(await getWorkspacePlan(id));
    }
  });

  it("has a workspace named twice once, in the order it was first named", async () => {
    const plans = await getWorkspacePlans([ORGS[1]!, ORGS[0]!, ORGS[1]!]);

    expect([...plans.keys()]).toEqual([ORGS[1], ORGS[0]]);
  });
});
