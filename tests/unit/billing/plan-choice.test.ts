import { describe, expect, it } from "vitest";
import { decodePlanChoice, encodePlanChoice, planChoiceCookieOptions, planChoiceFromSearch } from "@/features/billing/plan-choice";

describe("the plan chosen before signing up", () => {
  it("goes through the cookie and comes back the same", () => {
    expect(decodePlanChoice(encodePlanChoice({ planId: "pro", interval: "yearly" }))).toEqual({ planId: "pro", interval: "yearly" });
  });

  it.each([undefined, null, "", "pro", "pro:weekly", "free:monthly", "nope:monthly", "<script>:monthly", ":"])("trusts nothing in a cookie that holds %s: it is no plan of the product", (value) => {
    expect(decodePlanChoice(value)).toBeNull();
  });

  it("is read from an address, monthly when it names no period", () => {
    expect(planChoiceFromSearch(new URLSearchParams("plan=pro"))).toEqual({ planId: "pro", interval: "monthly" });
    expect(planChoiceFromSearch(new URLSearchParams("plan=pro&interval=yearly"))).toEqual({ planId: "pro", interval: "yearly" });
    expect(planChoiceFromSearch(new URLSearchParams("plan=nope"))).toBeNull();
    expect(planChoiceFromSearch(new URLSearchParams(""))).toBeNull();
  });

  it("lives an hour, for the server only, and is sent along a link from another site", () => {
    expect(planChoiceCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 });
  });
});
