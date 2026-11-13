import { describe, expect, it } from "vitest";
import { overLimits } from "@/features/billing/over-limits";
import { PLANS } from "@/features/billing/plans";

const free = PLANS.find((plan) => plan.id === "free")!;
const enterprise = PLANS.find((plan) => plan.id === "enterprise")!;

describe("what a workspace would hold over the limits of a plan", () => {
  it("lists the limits it is over, with how much it holds and what is allowed", () => {
    expect(overLimits(free, { members: 4, projects: 3, storage: 250 })).toEqual([
      { key: "members", used: 4, limit: 1 },
      { key: "storage", used: 250, limit: 100 },
    ]);
  });

  it("is over nothing at the limit, nor on an unlimited plan, nor for a figure it has no count of", () => {
    expect(overLimits(free, { members: 1, projects: 3 })).toEqual([]);
    expect(overLimits(enterprise, { members: 9999, projects: 9999 })).toEqual([]);
    expect(overLimits(free, {})).toEqual([]);
  });
});
