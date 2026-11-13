import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The page that resumes a payment cannot be clicked in Node, so what it hands to the flows is read from its source
const source = readFileSync(resolve(__dirname, "../../../src/features/billing/components/resume-checkout.tsx"), "utf8");

describe("resuming a payment", () => {
  it("replaces the page with the provider's own, so that going back does not start the payment again", () => {
    expect(source).toContain("window.location.replace(url)");
    expect(source).not.toContain("window.location.assign");
  });

  it("gives up a plan by going to the page with no plan in its address, never by refreshing the one it came by", () => {
    expect(source).toContain("chooseAnotherPlan(");
    expect(source).not.toContain("router.refresh");
  });
});

const dialog = readFileSync(resolve(__dirname, "../../../src/features/billing/components/change-plan-dialog.tsx"), "utf8");

describe("the dialog that changes the plan", () => {
  it("keeps the focus on Confirm while the cost is asked again: it loads, it is not disabled", () => {
    expect(dialog).toContain('loading={pending || preview === "loading"}');
    expect(dialog).not.toContain("disabled={!ready");
  });

  it("offers to ask the cost again where it says to try again", () => {
    expect(dialog).toMatch(/setRefresh\(\(n\) => n \+ 1\)\}>\s*\{t\("retry"\)\}/);
  });
});
