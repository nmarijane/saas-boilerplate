import { describe, expect, it, vi } from "vitest";
import { openBillingPage } from "@/features/billing/billing-flows";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// What the buttons of the billing page do with the answer of the server, as a
// plain function: the server and the page are given, so that a test calls it
// with a server that refuses (the interface cannot, in Node: it has no DOM to
// click in).
function deps(open: () => Promise<{ url: string | null }>) {
  return { open, go: vi.fn(), fail: vi.fn(), report: vi.fn() };
}

describe("opening a page of the payment provider", () => {
  it("goes to the address the server gives, and says nothing", async () => {
    const page = deps(async () => ({ url: "https://billing.example/session" }));

    expect(await openBillingPage(page)).toBe(true);
    expect(page.go).toHaveBeenCalledExactlyOnceWith("https://billing.example/session");
    expect(page.fail).not.toHaveBeenCalled();
    expect(page.report).not.toHaveBeenCalled();
  });

  // The catch used to be empty: a refusal of the server left the button as it was, with no word.
  it("tells a refusal of the server, and reports it, instead of swallowing it", async () => {
    const refusal = new Error("No Stripe customer found for this organization");
    const page = deps(async () => {
      throw refusal;
    });

    expect(await openBillingPage(page)).toBe(false);
    expect(page.go).not.toHaveBeenCalled();
    expect(page.fail).toHaveBeenCalledOnce();
    expect(page.report).toHaveBeenCalledExactlyOnceWith(refusal);
  });

  it("tells an answer that leads nowhere: the person would see nothing happen", async () => {
    const page = deps(async () => ({ url: null }));

    expect(await openBillingPage(page)).toBe(false);
    expect(page.go).not.toHaveBeenCalled();
    expect(page.fail).toHaveBeenCalledOnce();
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone, the role is too low): the button must not say that the page did not open for a person who is on their way
// to sign in, nor report it.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  it("is handed on by the button that opens a page of the payment provider", async () => {
    const page = deps(async () => {
      throw framework;
    });

    expect(await outcomeOf(openBillingPage(page))).toBe(framework);
    expect(page.fail).not.toHaveBeenCalled();
    expect(page.report).not.toHaveBeenCalled();
    expect(page.go).not.toHaveBeenCalled();
  });
});
