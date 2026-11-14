import { describe, expect, it, vi } from "vitest";
import { chooseAnotherPlan, goToCheckout, waitForCheckout } from "@/features/billing/checkout-flows";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

function start(answer: unknown) {
  return {
    start: vi.fn(async () => answer as never),
    push: vi.fn(),
    assign: vi.fn(),
    fail: vi.fn(),
    report: vi.fn(),
  };
}

describe("starting a payment", () => {
  it("goes to our checkout page for an embedded session", async () => {
    const page = start({ success: true, data: { kind: "embedded", href: "/checkout/cs_1" } });

    expect(await goToCheckout(page)).toBe(true);
    expect(page.push).toHaveBeenCalledExactlyOnceWith("/checkout/cs_1");
    expect(page.assign).not.toHaveBeenCalled();
  });

  it("goes nowhere when the person said no while the server was answering", async () => {
    const page = { ...start({ success: true, data: { kind: "embedded", href: "/checkout/cs_1" } }), cancelled: () => true };

    expect(await goToCheckout(page)).toBe(false);
    expect(page.push).not.toHaveBeenCalled();
    expect(page.assign).not.toHaveBeenCalled();
    expect(page.fail).not.toHaveBeenCalled();
  });

  it("leaves the app for the provider's own page when there is no publishable key", async () => {
    const page = start({ success: true, data: { kind: "hosted", href: "https://pay.example/cs_1" } });

    expect(await goToCheckout(page)).toBe(true);
    expect(page.assign).toHaveBeenCalledExactlyOnceWith("https://pay.example/cs_1");
    expect(page.push).not.toHaveBeenCalled();
  });

  it.each(["not_configured", "price_missing", "unknown_plan", "unknown_pack", "already_subscribed"])("tells the refusal %s, and stays where it is", async (code) => {
    const page = start({ success: false, error: code });

    expect(await goToCheckout(page)).toBe(false);
    expect(page.fail).toHaveBeenCalledExactlyOnceWith(code);
    expect(page.push).not.toHaveBeenCalled();
  });

  it("tells any other refusal as a failure to try again, never in the server's words", async () => {
    const page = start({ success: false, error: "Validation failed" });

    expect(await goToCheckout(page)).toBe(false);
    expect(page.fail).toHaveBeenCalledExactlyOnceWith("failed");
  });

  it("reports a call that fails outright, and tells it", async () => {
    const down = new Error("network");
    const page = { ...start(null), start: vi.fn().mockRejectedValue(down) };

    expect(await goToCheckout(page)).toBe(false);
    expect(page.report).toHaveBeenCalledExactlyOnceWith(down);
    expect(page.fail).toHaveBeenCalledExactlyOnceWith("failed");
  });

  describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
    it("is handed on: the person is on their way elsewhere", async () => {
      const page = { ...start(null), start: vi.fn().mockRejectedValue(framework) };

      expect(await outcomeOf(goToCheckout(page))).toBe(framework);
      expect(page.fail).not.toHaveBeenCalled();
      expect(page.report).not.toHaveBeenCalled();
    });
  });
});

function waiting(states: { state: string; kind?: string | null }[]) {
  const answers = [...states];
  return {
    status: vi.fn(async () => (answers.shift() ?? { state: "pending" }) as never),
    wait: vi.fn().mockResolvedValue(undefined),
    pollMs: 1,
    attempts: 5,
    go: vi.fn(),
    late: vi.fn(),
    trialSpent: vi.fn(),
    report: vi.fn(),
    sessionId: "cs_1",
  };
}

describe("waiting for the payment to reach the app", () => {
  // The trial that was sold was the buyer's second: nothing was charged, and the page says so instead of waiting for a plan
  it("says that the trial was already used, and goes nowhere", async () => {
    const page = waiting([{ state: "pending" }, { state: "trial_spent", kind: "subscription" }]);

    await waitForCheckout(page);

    expect(page.trialSpent).toHaveBeenCalledOnce();
    expect(page.go).not.toHaveBeenCalled();
    expect(page.late).not.toHaveBeenCalled();
    expect(page.status).toHaveBeenCalledTimes(2);
  });

  it("polls until the webhook has run, then goes to billing with the news", async () => {
    const page = waiting([{ state: "pending" }, { state: "pending" }, { state: "ready", kind: "subscription" }]);

    await waitForCheckout(page);

    expect(page.status).toHaveBeenCalledTimes(3);
    expect(page.go).toHaveBeenCalledExactlyOnceWith("/settings/billing?checkout=success");
    expect(page.late).not.toHaveBeenCalled();
  });

  it("says credits were added for a pack", async () => {
    const page = waiting([{ state: "ready", kind: "credit_pack" }]);

    await waitForCheckout(page);

    expect(page.go).toHaveBeenCalledExactlyOnceWith("/settings/billing?checkout=credits");
  });

  it("goes back to the payment when the buyer left before paying, and to the prices, with no error, when the session lapsed", async () => {
    const open = waiting([{ state: "open" }]);
    await waitForCheckout(open);
    expect(open.go).toHaveBeenCalledExactlyOnceWith("/checkout/cs_1");

    const lapsed = waiting([{ state: "expired" }]);
    await waitForCheckout(lapsed);
    expect(lapsed.go).toHaveBeenCalledExactlyOnceWith("/pricing");
  });

  it("asks again after a question that failed, and says it is late after the last", async () => {
    const page = waiting([]);
    page.status.mockRejectedValueOnce(new Error("offline"));

    await waitForCheckout(page);

    expect(page.report).toHaveBeenCalledTimes(1);
    expect(page.status).toHaveBeenCalledTimes(5);
    expect(page.late).toHaveBeenCalledOnce();
    expect(page.go).not.toHaveBeenCalled();
  });
});

// "Choose another plan" must not come back to the payment it refused: a refresh of an address that still carries the plan
// would have the proxy remember it again, so the person goes to the bare page, once the remembered choice is cleared
describe("choosing another plan", () => {
  it("clears the remembered choice, then goes to the page with no plan in its address", async () => {
    const order: string[] = [];
    const page = {
      clear: vi.fn(async () => {
        order.push("clear");
        return { success: true, data: undefined } as never;
      }),
      go: vi.fn((path: string) => order.push(`go ${path}`)),
      report: vi.fn(),
    };

    await chooseAnotherPlan(page);

    expect(order).toEqual(["clear", "go /choose-plan"]);
  });

  it("stays where it is, and says so, when the choice could not be cleared (it would resume the same payment)", async () => {
    const page = { clear: vi.fn(async () => ({ success: false, error: "Failed to continue" }) as never), go: vi.fn(), report: vi.fn() };

    await chooseAnotherPlan(page);

    expect(page.go).not.toHaveBeenCalled();
    expect(page.report).toHaveBeenCalledOnce();
  });

  it("reports a call that fails outright, and goes nowhere", async () => {
    const page = { clear: vi.fn(async () => Promise.reject(new Error("offline"))), go: vi.fn(), report: vi.fn() };

    await chooseAnotherPlan(page);

    expect(page.go).not.toHaveBeenCalled();
    expect(page.report).toHaveBeenCalledOnce();
  });

  describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
    it("is handed on, not reported", async () => {
      const page = { clear: vi.fn().mockRejectedValue(framework), go: vi.fn(), report: vi.fn() };

      expect(await outcomeOf(chooseAnotherPlan(page))).toBe(framework);
      expect(page.report).not.toHaveBeenCalled();
    });
  });
});
