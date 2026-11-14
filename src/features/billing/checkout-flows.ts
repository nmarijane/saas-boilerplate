import type { CheckoutDestination } from "./actions";
import type { ActionResult } from "@/shared/lib/safe-action";
import { unstable_rethrow } from "next/navigation";

// What the buttons that start a payment do with the answer of the server, as a
// plain function (the server and the page are given, so that a test calls it with
// a server that refuses: the interface cannot, in Node, click). The server's
// refusals are codes (`checkoutErrors.<code>` in the messages); one it does not
// know, and a call that fails outright, are told as a failure to try again.

/** The codes the server refuses a checkout with, that the messages tell. */
type CheckoutErrorCode = "not_configured" | "price_missing" | "unknown_plan" | "unknown_pack" | "already_subscribed" | "failed";

const KNOWN: readonly string[] = ["not_configured", "price_missing", "unknown_plan", "unknown_pack", "already_subscribed"];

function codeOf(error: string): CheckoutErrorCode {
  return KNOWN.includes(error) ? (error as CheckoutErrorCode) : "failed";
}

interface GoToCheckoutDeps {
  /** Asks the server where to pay: a start-checkout action. */
  start: () => Promise<ActionResult<CheckoutDestination>>;
  /** Goes to a page of the app (our checkout page). */
  push: (path: string) => void;
  /** Leaves the app for the provider's own page. */
  assign: (url: string) => void;
  /** Tells the person why nothing opened. */
  fail: (code: CheckoutErrorCode) => void;
  /** Hears an error that was handled: handled is not hidden. */
  report: (error: unknown) => void;
  /** The person gave up while the server was answering: nothing is opened, nothing is told. */
  cancelled?: () => boolean;
}

/** Opens the page where a payment is made, and says whether it did: a refusal or a failure leaves the person where they are, and is told. */
export async function goToCheckout({ start, push, assign, fail, report, cancelled }: GoToCheckoutDeps): Promise<boolean> {
  let result: ActionResult<CheckoutDestination>;
  try {
    result = await start();
  } catch (error) {
    unstable_rethrow(error);
    report(error);
    fail("failed");
    return false;
  }

  if (cancelled?.()) {
    return false;
  }

  if (!result.success) {
    fail(codeOf(result.error));
    return false;
  }

  if (result.data.kind === "hosted") {
    assign(result.data.href);
  } else {
    push(result.data.href);
  }

  return true;
}

/** What the server says of a checkout, or that it could not say. */
interface Waited {
  state: "open" | "expired" | "pending" | "ready" | "trial_spent" | "failed";
  kind?: "subscription" | "credit_pack" | null;
}

interface WaitForCheckoutDeps {
  /** Asks the server where the checkout stands. */
  status: () => Promise<Waited>;
  /** Waits between two questions. */
  wait: (ms: number) => Promise<void>;
  pollMs: number;
  /** How many times to ask before telling the person it is late. */
  attempts: number;
  /** Goes to a page of the app, replacing this one. */
  go: (path: string) => void;
  /** The payment has still not reached the app: say so. */
  late: () => void;
  /** The trial that was sold was the buyer's second: nothing was charged, and the plans are theirs to choose from. */
  trialSpent: () => void;
  report: (error: unknown) => void;
  sessionId: string;
}

/**
 * Waits for the app to have a payment, and goes where the answer says: `ready`
 * to the billing page with the news (the page tells it with a toast and takes it
 * off the address), `open` back to the payment, `expired` to the prices with no
 * word of an error. A question that fails is asked again, like one that is not
 * answered yet: the webhook is what is awaited. After `attempts` questions the
 * person is told it is late.
 */
export async function waitForCheckout(deps: WaitForCheckoutDeps): Promise<void> {
  for (let attempt = 0; attempt < deps.attempts; attempt++) {
    let answer: Waited;
    try {
      answer = await deps.status();
    } catch (error) {
      unstable_rethrow(error);
      deps.report(error);
      answer = { state: "failed" };
    }
    const { state, kind } = answer;

    if (state === "ready") {
      deps.go(kind === "credit_pack" ? "/settings/billing?checkout=credits" : "/settings/billing?checkout=success");
      return;
    }
    if (state === "open") {
      deps.go(`/checkout/${encodeURIComponent(deps.sessionId)}`);
      return;
    }
    if (state === "expired") {
      deps.go("/pricing");
      return;
    }
    if (state === "trial_spent") {
      deps.trialSpent();
      return;
    }

    await deps.wait(deps.pollMs);
  }

  deps.late();
}

interface ChooseAnotherPlanDeps {
  /** Forgets the plan that was remembered: a clear-the-choice action. */
  clear: () => Promise<ActionResult<void>>;
  /** Goes to a page of the app, replacing this one. */
  go: (path: string) => void;
  report: (error: unknown) => void;
}

/**
 * Gives up the plan that was about to be paid for. The remembered choice is cleared, then the person goes to the page
 * with no plan in its address: refreshing the address they came by would have it remembered, and paid for, again. When
 * the choice could not be cleared they stay, since the page would resume the same payment.
 */
export async function chooseAnotherPlan({ clear, go, report }: ChooseAnotherPlanDeps): Promise<void> {
  try {
    const result = await clear();

    if (!result.success) {
      report(new Error(result.error));
      return;
    }
  } catch (error) {
    unstable_rethrow(error);
    report(error);
    return;
  }

  go("/choose-plan");
}
