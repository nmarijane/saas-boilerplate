import { describe, expect, it } from "vitest";
import { CREDIT_PACKS } from "@/features/billing/credit-packs";
import { planOfSubscription } from "@/features/billing/plan-summary";
import {
  bestYearlySavingsPercent,
  effectivePlan,
  findFreePlan,
  getFreePlan,
  getRecommendedPlan,
  isLiveStatus,
  parsePlanChoice,
  planRowOf,
  PLANS,
  yearlySavingsPercent,
} from "@/features/billing/plans";

// `PLANS` is the one source of prices, limits and trials: what the pages say is
// derived from it, never written again.

describe("the plans", () => {
  it("have one free plan first, a recommended one, and a limit of AI credits each (the monthly credits)", () => {
    expect(findFreePlan()?.price).toEqual({ monthly: 0, yearly: 0 });
    expect(getRecommendedPlan()?.id).toBe("pro");
    for (const plan of PLANS) {
      expect(plan.limits.aiCredits, plan.id).toBeDefined();
    }
  });

  it("price the year at two months free, and the discount the toggle announces is read from it", () => {
    const pro = PLANS.find((plan) => plan.id === "pro")!;

    expect(pro.price).toEqual({ monthly: 29, yearly: 290 });
    expect(yearlySavingsPercent(pro)).toBe(17);
    expect(yearlySavingsPercent(findFreePlan()!)).toBe(0);
    expect(bestYearlySavingsPercent()).toBe(17);
  });

  it("give a trial to the recommended plan only, 14 days", () => {
    expect(PLANS.filter((plan) => plan.trialDays).map((plan) => [plan.id, plan.trialDays])).toEqual([["pro", 14]]);
  });

  it("have packs of credits priced in the same unit", () => {
    expect(CREDIT_PACKS.map((pack) => pack.credits)).toEqual([1000, 5000]);
  });

  it("make the row of the plan table from the plan: the price in cents", () => {
    expect(planRowOf(PLANS.find((plan) => plan.id === "pro")!)).toMatchObject({ id: "pro", price: 2900, limits: { projects: 50 } });
  });
});

describe("what a subscription gives", () => {
  it.each(["active", "trialing", "past_due"])("keeps the paid plan while it is %s", (status) => {
    expect(isLiveStatus(status)).toBe(true);
    expect(effectivePlan("pro", status).id).toBe("pro");
  });

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "something-new"])("falls back to the free plan when it is %s", (status) => {
    expect(isLiveStatus(status)).toBe(false);
    expect(effectivePlan("pro", status).id).toBe("free");
  });

  it("falls back to the free plan for a plan the configuration no longer knows", () => {
    expect(effectivePlan("legacy", "active")).toBe(getFreePlan());
  });

  it("tells the shell the plan, its limits, the plans above it, and no upgrade from the highest", () => {
    const free = planOfSubscription("free", "active");
    expect(free).toMatchObject({ id: "free", free: true, upgradeHref: "/settings/billing", limits: { members: 1 } });
    expect(free.higher?.map((plan) => plan.name)).toEqual(["Pro", "Enterprise"]);

    const top = planOfSubscription("enterprise", "active");
    expect(top).toMatchObject({ free: false, upgradeHref: null, higher: [] });
  });
});

describe("a plan read from an address or a cookie", () => {
  it.each([
    ["pro", "monthly", { planId: "pro", interval: "monthly" }],
    ["enterprise", "yearly", { planId: "enterprise", interval: "yearly" }],
  ])("is taken when it is one of ours: %s %s", (plan, interval, expected) => {
    expect(parsePlanChoice(plan, interval)).toEqual(expected);
  });

  it.each([
    ["free", "monthly"],
    ["pro", "weekly"],
    ["../../etc", "monthly"],
    [undefined, "monthly"],
    ["pro", undefined],
    [42, "monthly"],
  ])("is refused when it is not: %s %s", (plan, interval) => {
    expect(parsePlanChoice(plan, interval)).toBeNull();
  });
});
