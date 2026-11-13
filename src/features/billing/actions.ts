"use server";

import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireAuth, requireRole } from "@/features/auth/guards";
import { safeAction } from "@/shared/lib/safe-action";
import { createPackCheckout, createPlanCheckout } from "./checkout";
import { getCheckoutStatus } from "./checkout-status";
import { createPortalSession, getSubscriptionForOrg } from "./helpers";
import { BILLING_MIN_ROLE, SUBSCRIPTION_OWNER_ROLE } from "./permissions";
import { changePlan, previewPlanChange, setCancelAtPeriodEnd } from "./plan-change";
import { PLAN_CHOICE_COOKIE } from "./plan-choice";
import { BILLING_INTERVALS } from "./plans";

// Client-callable wrappers of the billing operations. Each one asks the role of
// the caller first, from the session and the membership (never from what the
// browser says), and only returns what the interface needs: never the Stripe
// session or subscription records. The browser names a plan and an interval, or
// a pack, never a price. A refusal that is an answer (a plan that is not sold, a
// subscription that does not exist) comes back as its code.

const orgSchema = z.object({ orgId: z.string().min(1) });
const choiceSchema = orgSchema.extend({
  planId: z.string().min(1).max(64),
  interval: z.enum(BILLING_INTERVALS),
});
const packSchema = orgSchema.extend({ packId: z.string().min(1).max(64) });

/** Where the person goes to pay: our page for an embedded session, the provider's own for a hosted one. */
export interface CheckoutDestination {
  kind: "embedded" | "hosted";
  /** `/checkout/<id>` (a path of the app) or the address of the hosted page. */
  href: string;
}

function destinationOf(launch: { kind: "embedded" | "hosted"; sessionId: string; url: string | null }): CheckoutDestination {
  if (launch.kind === "hosted" && launch.url) {
    return { kind: "hosted", href: launch.url };
  }

  return { kind: "embedded", href: `/checkout/${encodeURIComponent(launch.sessionId)}` };
}

/** Starts the payment of a plan: the workspace is the person's, the role is admin at least. */
export async function startCheckoutAction(input: z.infer<typeof choiceSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = choiceSchema.parse(input);
    const { session } = await requireRole(parsed.orgId, BILLING_MIN_ROLE);

    const launch = await createPlanCheckout(
      { orgId: parsed.orgId, userId: session.user.id, email: session.user.email, locale: await getLocale() },
      { planId: parsed.planId, interval: parsed.interval },
    );
    // The choice made before signing up is spent
    (await cookies()).delete(PLAN_CHOICE_COOKIE);

    return destinationOf(launch);
  }, "Failed to open the checkout");
}

/** Starts the payment of a pack of credits. */
export async function startPackCheckoutAction(input: z.infer<typeof packSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = packSchema.parse(input);
    const { session } = await requireRole(parsed.orgId, BILLING_MIN_ROLE);

    const launch = await createPackCheckout(
      { orgId: parsed.orgId, userId: session.user.id, email: session.user.email, locale: await getLocale() },
      parsed.packId,
    );

    return destinationOf(launch);
  }, "Failed to open the checkout");
}

/** What a change of plan would cost, shown before it is confirmed. Nothing is changed. */
export async function previewPlanChangeAction(input: z.infer<typeof choiceSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = choiceSchema.parse(input);
    await requireRole(parsed.orgId, BILLING_MIN_ROLE);

    const preview = await previewPlanChange(parsed.orgId, parsed.planId, parsed.interval);

    // Dates cross to the browser as text
    return preview.kind === "trial"
      ? { kind: "trial" as const, startsAt: preview.startsAt.toISOString() }
      : {
          kind: "proration" as const,
          dueNow: preview.dueNow,
          currency: preview.currency,
          prorationDate: preview.prorationDate,
          nextRenewal: preview.nextRenewal?.toISOString() ?? null,
        };
  }, "Failed to preview the change");
}

const changeSchema = choiceSchema.extend({ prorationDate: z.number().int().positive().optional() });

/** Moves the subscription to another plan or interval, on the proration that was shown. */
export async function changePlanAction(input: z.infer<typeof changeSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = changeSchema.parse(input);
    await requireRole(parsed.orgId, BILLING_MIN_ROLE);

    await changePlan(parsed.orgId, parsed.planId, parsed.interval, parsed.prorationDate);
  }, "Failed to change the plan");
}

/** Cancels the subscription at the end of the period paid for. Only the owner of the workspace may. */
export async function cancelSubscriptionAction(input: z.infer<typeof orgSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = orgSchema.parse(input);
    await requireRole(parsed.orgId, SUBSCRIPTION_OWNER_ROLE);

    await setCancelAtPeriodEnd(parsed.orgId, true);
  }, "Failed to cancel the subscription");
}

/** Takes the cancellation back while the plan is still paid for. Only the owner of the workspace may. */
export async function resumeSubscriptionAction(input: z.infer<typeof orgSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = orgSchema.parse(input);
    await requireRole(parsed.orgId, SUBSCRIPTION_OWNER_ROLE);

    await setCancelAtPeriodEnd(parsed.orgId, false);
  }, "Failed to resume the subscription");
}

/** Gives up the plan chosen before signing up, and stays on the free plan. */
export async function continueOnFreeAction() {
  return safeAction(async () => {
    await requireAuth();

    (await cookies()).delete(PLAN_CHOICE_COOKIE);
  }, "Failed to continue");
}

// Only what the provider calls a checkout session: any other id is not asked for
const statusSchema = z.object({ sessionId: z.string().min(1).max(200).startsWith("cs_") });

/** Whether the payment of a checkout has reached the app (the return page polls until it has). */
export async function getCheckoutStatusAction(input: z.infer<typeof statusSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = statusSchema.parse(input);

    return getCheckoutStatus(parsed.sessionId);
  }, "Failed to read the checkout");
}

// The billing portal opens a page of the provider, and the page that asks hears
// a refusal as a rejection (`openBillingPage`): it keeps the shape it has.
export async function createPortalSessionAction(orgId: string) {
  await requireRole(orgId, BILLING_MIN_ROLE);

  const session = await createPortalSession(orgId);
  return { url: session.url };
}

export async function getSubscriptionAction(orgId: string) {
  await requireRole(orgId, "member");

  const { planId, status } = await getSubscriptionForOrg(orgId);
  return { planId, status };
}
