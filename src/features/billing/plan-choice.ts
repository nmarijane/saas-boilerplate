import type { BillingInterval } from "./plans";
import { DEV_APP_URL } from "@/shared/config/app";
import { parsePlanChoice } from "./plans";

// The plan a visitor picked on the pricing page, kept in a short-lived cookie
// until they have an account and a workspace to pay for: it survives the
// verification e-mail and a sign-in with a provider, where an address would not.
// The proxy writes it when a page of the sign-up path is opened with `?plan=` and
// `?interval=`; `/choose-plan` and the dashboard read it, and starting the checkout
// (or continuing on the free plan) clears it. It holds a plan id and an interval,
// both checked against `PLANS` whenever they are read: nothing in it is trusted.
// Plain module: the proxy imports it.

export const PLAN_CHOICE_COOKIE = "plan_choice";

/** An hour: long enough to verify an e-mail, short enough that a forgotten choice does not come back days later. */
const PLAN_CHOICE_MAX_AGE_SECONDS = 60 * 60;

/** The pages that remember a plan when they are opened with one in their address. */
export const PLAN_CHOICE_PATHS: readonly string[] = ["/sign-up", "/sign-in", "/choose-plan"];

interface PlanChoice {
  planId: string;
  interval: BillingInterval;
}

export function encodePlanChoice(choice: PlanChoice): string {
  return `${choice.planId}:${choice.interval}`;
}

/** The choice a cookie value holds, or null when it is no choice of this product (an old plan, a made-up value). */
export function decodePlanChoice(value: string | undefined | null): PlanChoice | null {
  if (!value) {
    return null;
  }
  const [planId, interval] = value.split(":");

  return parsePlanChoice(planId, interval);
}

/** The choice an address asks for (`?plan=pro&interval=yearly`); the interval is monthly when it says nothing. */
export function planChoiceFromSearch(search: URLSearchParams): PlanChoice | null {
  return parsePlanChoice(search.get("plan"), search.get("interval") ?? "monthly");
}

/** Whether the app is served over https, by the scheme of its own address: configuration, not a header (as `reset-token.ts` reads it). */
function servedOverHttps(): boolean {
  try {
    return new URL(process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || DEV_APP_URL).protocol === "https:";
  } catch {
    return false;
  }
}

export function planChoiceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: servedOverHttps(),
    path: "/",
    maxAge: PLAN_CHOICE_MAX_AGE_SECONDS,
  };
}
