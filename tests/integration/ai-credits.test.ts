import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiCreditLedger, aiFreeCreditGrant, organization } from "@/models";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * The monthly credits of a workspace: granted lazily at the first use of the
 * month (UTC), once, never accumulated; the bought packs never expire and are
 * spent after the allocation. The plan the workspace is on is whatever the test
 * says.
 */

const { plan } = vi.hoisted(() => ({ plan: { aiCredits: 5000 as number | undefined, free: false } }));
vi.mock("@/features/plan-limits", () => ({
  getPlanSummary: vi.fn(async () => (plan.aiCredits === undefined ? null : { id: "x", name: "X", free: plan.free, limits: { aiCredits: plan.aiCredits }, upgradeHref: null })),
}));

const ORG = "credits-org";
const NOVEMBER = new Date("2026-11-15T10:00:00Z");
const DECEMBER = new Date("2026-12-01T00:00:01Z");

async function service() {
  return import("@/features/ai/service");
}

async function debit(cost: number, now = NOVEMBER) {
  const { debitCredits } = await service();
  return testDb.transaction((tx) => debitCredits(tx, ORG, cost, "ref", now));
}

beforeEach(async () => {
  plan.aiCredits = 5000;
  plan.free = false;
  await testDb.delete(aiFreeCreditGrant);
  await testDb.delete(aiCreditLedger);
  await testDb.delete(organization);
  await seedOrg(ORG);
});

describe("the monthly allocation", () => {
  it("is granted at the first use of the month, from the limit of the plan", async () => {
    const { ensureMonthlyAllocation } = await service();

    const state = await ensureMonthlyAllocation(ORG, NOVEMBER);

    expect(state).toEqual({ unlimited: false, monthly: 5000, allocation: 5000, packs: 0, total: 5000 });
    expect(await testDb.select().from(aiCreditLedger)).toMatchObject([{ amount: 5000, reason: "plan_allocation", bucket: "allocation", period: "2026-11" }]);
  });

  it("is granted once, however many times and at the same time it is asked", async () => {
    const { ensureMonthlyAllocation } = await service();

    await Promise.all([ensureMonthlyAllocation(ORG, NOVEMBER), ensureMonthlyAllocation(ORG, NOVEMBER), ensureMonthlyAllocation(ORG, NOVEMBER)]);
    await ensureMonthlyAllocation(ORG, NOVEMBER);

    expect(await testDb.select().from(aiCreditLedger)).toHaveLength(1);
  });

  it("does not accumulate: the next month starts at the allocation again, whatever was left", async () => {
    const { ensureMonthlyAllocation } = await service();
    await ensureMonthlyAllocation(ORG, NOVEMBER);
    await debit(1000);

    const state = await ensureMonthlyAllocation(ORG, DECEMBER);

    expect(state.allocation).toBe(5000);
    expect(state.total).toBe(5000);
  });

  it("is the credits of the plan the workspace is on: the free plan's when it never paid", async () => {
    plan.aiCredits = 100;
    const { ensureMonthlyAllocation } = await service();

    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(100);
  });

  it("falls back to a metered allowance when no plan says, so that the assistant is never free of limits", async () => {
    plan.aiCredits = undefined;
    const { ensureMonthlyAllocation } = await service();

    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(100);
  });

  it("is not counted for an unlimited plan: nothing is written", async () => {
    plan.aiCredits = -1;
    const { ensureMonthlyAllocation } = await service();

    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).unlimited).toBe(true);
    expect(await testDb.select().from(aiCreditLedger)).toEqual([]);
  });

  it("is topped up when the plan rises in the month, and never granted twice by a plan that goes up and down", async () => {
    const { ensureMonthlyAllocation } = await service();
    plan.aiCredits = 100;
    await ensureMonthlyAllocation(ORG, NOVEMBER);
    await debit(40);

    plan.aiCredits = 5000;
    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(4960);

    plan.aiCredits = 100;
    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(4960);

    plan.aiCredits = 5000;
    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(4960);
    expect((await testDb.select().from(aiCreditLedger)).filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0)).toBe(5000);
  });
});

// The free credits are the owner's, once a month: a workspace made after another was deleted gets none again
describe("the free allocation", () => {
  const OWNER = "credits-owner";

  beforeEach(async () => {
    plan.free = true;
    plan.aiCredits = 100;
    await seedUser(OWNER);
    await seedOrgMember(OWNER, ORG, "owner");
  });

  it("is granted once per owner and month, whatever the number of workspaces and whatever became of the first", async () => {
    const { ensureMonthlyAllocation } = await service();
    await seedOrg("credits-org-2");
    await seedOrgMember(OWNER, "credits-org-2", "owner");

    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(100);
    expect((await ensureMonthlyAllocation("credits-org-2", NOVEMBER)).allocation).toBe(0);

    // The first workspace is deleted, its ledger with it, and another one is made
    await testDb.delete(organization).where(eq(organization.id, ORG));
    await seedOrg("credits-org-3");
    await seedOrgMember(OWNER, "credits-org-3", "owner");
    expect((await ensureMonthlyAllocation("credits-org-3", NOVEMBER)).allocation).toBe(0);

    // The next month is another allowance
    expect((await ensureMonthlyAllocation("credits-org-3", DECEMBER)).allocation).toBe(100);
  });

  // No plan gives credits (the billing feature is not installed): the allowance of the fallback is no more a way to many
  it("is the owner's too when no plan says what it is, the fallback allowance", async () => {
    plan.aiCredits = undefined;
    const { ensureMonthlyAllocation } = await service();
    await seedOrg("credits-org-2");
    await seedOrgMember(OWNER, "credits-org-2", "owner");

    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(100);
    expect((await ensureMonthlyAllocation("credits-org-2", NOVEMBER)).allocation).toBe(0);

    await testDb.delete(organization).where(eq(organization.id, ORG));
    await seedOrg("credits-org-3");
    await seedOrgMember(OWNER, "credits-org-3", "owner");
    expect((await ensureMonthlyAllocation("credits-org-3", NOVEMBER)).allocation).toBe(0);
    expect((await ensureMonthlyAllocation("credits-org-3", DECEMBER)).allocation).toBe(100);
  });

  it("is granted again, not twice, to the workspace that has it", async () => {
    const { ensureMonthlyAllocation } = await service();

    await ensureMonthlyAllocation(ORG, NOVEMBER);
    await ensureMonthlyAllocation(ORG, NOVEMBER);

    expect(await testDb.select().from(aiCreditLedger)).toHaveLength(1);
  });

  it("does not limit a paid plan, whose allocation is its own", async () => {
    const { ensureMonthlyAllocation } = await service();
    await ensureMonthlyAllocation(ORG, NOVEMBER);
    await seedOrg("credits-paid");
    await seedOrgMember(OWNER, "credits-paid", "owner");
    plan.free = false;
    plan.aiCredits = 5000;

    expect((await ensureMonthlyAllocation("credits-paid", NOVEMBER)).allocation).toBe(5000);
  });
});

describe("spending credits", () => {
  it("takes from the allocation first, then from the packs, and never below zero", async () => {
    const { ensureMonthlyAllocation, addPackCredits } = await service();
    plan.aiCredits = 100;
    await ensureMonthlyAllocation(ORG, NOVEMBER);
    await addPackCredits(ORG, 50, "cs_1");

    expect(await debit(30)).toBe(30);
    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).allocation).toBe(70);

    expect(await debit(100)).toBe(100);
    expect(await ensureMonthlyAllocation(ORG, NOVEMBER)).toMatchObject({ allocation: 0, packs: 20, total: 20 });

    expect(await debit(500)).toBe(20);
    expect((await ensureMonthlyAllocation(ORG, NOVEMBER)).total).toBe(0);
    expect(await debit(5)).toBe(0);
  });

  it("keeps the packs from one month to the next, and spends them after the new allocation", async () => {
    const { ensureMonthlyAllocation, addPackCredits } = await service();
    plan.aiCredits = 100;
    await ensureMonthlyAllocation(ORG, NOVEMBER);
    await addPackCredits(ORG, 1000, "cs_1");
    await debit(100);

    const december = await ensureMonthlyAllocation(ORG, DECEMBER);

    expect(december).toMatchObject({ allocation: 100, packs: 1000, total: 1100 });
  });

  it("counts as used of the month only what came out of the allocation", async () => {
    const { ensureMonthlyAllocation, addPackCredits, allocationUsed } = await service();
    plan.aiCredits = 100;
    await ensureMonthlyAllocation(ORG, NOVEMBER);
    await addPackCredits(ORG, 1000, "cs_1");
    await debit(250);

    expect(await allocationUsed(ORG, NOVEMBER)).toBe(100);
    expect(await allocationUsed(ORG, DECEMBER)).toBe(0);
  });
});

describe("a pack", () => {
  it("is credited once per checkout session", async () => {
    const { addPackCredits } = await service();

    expect(await addPackCredits(ORG, 1000, "cs_1")).toBe(true);
    expect(await addPackCredits(ORG, 1000, "cs_1")).toBe(false);
    expect(await addPackCredits(ORG, 1000, "cs_2")).toBe(true);

    const rows = await testDb.select().from(aiCreditLedger).where(eq(aiCreditLedger.reason, "credit_pack"));
    expect(rows.map((row) => row.amount)).toEqual([1000, 1000]);
  });
});
