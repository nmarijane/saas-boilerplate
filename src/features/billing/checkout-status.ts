import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { requireRole } from "@/features/auth/guards";
import { subscription } from "@/models";
import { aiCreditLedger } from "@/models/ai";
import { db } from "@/shared/lib/DB";
import { env } from "@/shared/lib/env";
import { isLiveStatus } from "./plans";
import { getStripe } from "./stripe";
import { TRIAL_SPENT_REASON } from "./subscription";
import "server-only";

// Where a Checkout Session stands, for the page that shows it and the page that
// waits for its payment to reach the app. The session is read at the provider by
// its id, and only the members of the workspace it was opened for may read it:
// the id is in the address, and an address is not a secret.

/** A session as the pages of the shop need it: what it is for, and where it stands. */
export interface CheckoutSessionView {
  id: string;
  orgId: string;
  kind: "subscription" | "credit_pack";
  planId: string | null;
  interval: "monthly" | "yearly" | null;
  packId: string | null;
  status: "open" | "complete" | "expired";
  /** The secret of the embedded form; only an open session has one. */
  clientSecret: string | null;
  trialDays: number | null;
  /** The subscription the session made, once it is complete. */
  subscriptionId: string | null;
}

function viewOf(session: Stripe.Checkout.Session): CheckoutSessionView | null {
  const orgId = session.metadata?.orgId;
  const kind = session.metadata?.kind;
  if (!orgId || (kind !== "subscription" && kind !== "credit_pack")) {
    return null;
  }

  return {
    id: session.id,
    orgId,
    kind,
    planId: session.metadata?.planId ?? null,
    interval: session.metadata?.interval === "yearly" ? "yearly" : session.metadata?.interval === "monthly" ? "monthly" : null,
    packId: session.metadata?.packId ?? null,
    status: session.status ?? "open",
    clientSecret: session.status === "open" ? session.client_secret : null,
    trialDays: Number(session.metadata?.trialDays) > 0 ? Number(session.metadata?.trialDays) : null,
    subscriptionId: typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null),
  };
}

/**
 * The session, for a member of the workspace it was opened for; null for a
 * session that does not exist, is not the app's (no metadata of ours), or is
 * another workspace's. The caller is sent to the not-found page for any of them,
 * so that an address says nothing about which sessions exist.
 */
export async function getCheckoutSession(sessionId: string, minRole: "member" | "admin" = "admin"): Promise<CheckoutSessionView | null> {
  // With no key there is no provider to ask: no session exists, as far as this app can tell
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    unstable_rethrow(error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "resource_missing") {
      return null;
    }
    throw error;
  }

  const view = viewOf(session);
  if (!view) {
    return null;
  }

  // Sends away whoever does not belong to the workspace, or lacks the role
  await requireRole(view.orgId, minRole);

  return view;
}

interface CheckoutStatus {
  state: "open" | "expired" | "pending" | "ready" | "trial_spent";
  /** What the session was for: the return page says "Your plan is active" or "Credits added". */
  kind: "subscription" | "credit_pack" | null;
}

/**
 * What the return page waits for: `ready` once the app has the payment (the
 * subscription is live in its row, or the pack is in the ledger), `pending`
 * while the webhook has not run yet, `open` when the buyer left before paying,
 * `expired` when the session lapsed, `trial_spent` when the payment was a trial
 * that the buyer had already had: it was cancelled with nothing charged.
 */
export async function getCheckoutStatus(sessionId: string): Promise<CheckoutStatus> {
  const view = await getCheckoutSession(sessionId, "member");
  if (!view) {
    return { state: "expired", kind: null };
  }
  const { kind } = view;
  if (view.status === "open") {
    return { state: "open", kind };
  }
  if (view.status === "expired") {
    return { state: "expired", kind };
  }

  if (kind === "credit_pack") {
    const [credited] = await db
      .select({ id: aiCreditLedger.id })
      .from(aiCreditLedger)
      .where(and(eq(aiCreditLedger.reason, "credit_pack"), eq(aiCreditLedger.referenceId, view.id)))
      .limit(1);

    return { state: credited ? "ready" : "pending", kind };
  }

  const row = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, view.orgId) });
  const live = row?.stripeSubscriptionId !== null && row !== undefined && isLiveStatus(row.status) && row.planId === view.planId;

  if (live) {
    return { state: "ready", kind };
  }

  // A subscription that is not live may be one that was refused: the provider says so on the cancellation
  if (view.subscriptionId && (await wasRefusedForSpentTrial(view.subscriptionId))) {
    return { state: "trial_spent", kind };
  }

  return { state: "pending", kind };
}

async function wasRefusedForSpentTrial(subscriptionId: string): Promise<boolean> {
  try {
    const subscribed = await getStripe().subscriptions.retrieve(subscriptionId);
    return subscribed.status === "canceled" && subscribed.cancellation_details?.comment === TRIAL_SPENT_REASON;
  } catch (error) {
    unstable_rethrow(error);
    // The page asks again: a subscription that cannot be read now is not yet an answer
    return false;
  }
}
