import type Stripe from "stripe";
import type { BillingInterval } from "./plans";
import { eq } from "drizzle-orm";
import { organization, subscription, user } from "@/models";
import { ActionRefusal } from "@/shared/lib/action-refusal";
import { db } from "@/shared/lib/DB";
import { env } from "@/shared/lib/env";
import { generateId } from "@/shared/utils/helpers";
import { getCreditPack } from "./credit-packs";
import { ensurePlanRow } from "./plan-rows";
import { findFreePlan, getPlanById, isLiveStatus, isPaidPlan } from "./plans";
import { packPriceId, priceIdFor } from "./price-ids";
import { getStripe } from "./stripe";
import { getWorkspaceOwner } from "./subscription";
import "server-only";

// Opens a Checkout Session at the provider, for a subscription to a plan or for
// a pack of credits. The page that opens it is ours (`/checkout/<id>`, Stripe's
// embedded form in a card), or Stripe's own hosted page when the app has no
// publishable key. What the buyer pays is decided here, on the server: the
// browser names a plan and an interval, or a pack, never a price.

/** The codes of what refuses a checkout (`ActionRefusal`). */
export type CheckoutRefusal =
  | "not_configured" // no Stripe key: the shop is not set up
  | "price_missing" // the plan is not in the catalog (no `STRIPE_PRICE_*` for it)
  | "unknown_plan"
  | "already_subscribed"; // pay once: a subscribed workspace changes plan, it does not buy again

export interface CheckoutLaunch {
  /** `embedded`: our page `/checkout/<sessionId>`; `hosted`: Stripe's page at `url`. */
  kind: "embedded" | "hosted";
  sessionId: string;
  url: string | null;
}

interface CheckoutBuyer {
  orgId: string;
  userId: string;
  email: string;
  /** The language of the page that opens the checkout: the return comes back in it, and so do the e-mails. */
  locale: string;
}

function appUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

function requireStripeKey() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ActionRefusal("not_configured");
  }
}

/** Whether Checkout is shown in our page: it needs the publishable key of the browser. */
export function usesEmbeddedCheckout(): boolean {
  return env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY !== "";
}

/**
 * The Stripe customer of a workspace: created once, under a lock on the
 * workspace so that two checkouts opened together share it, and kept on the
 * subscription row (a workspace that never paid gets a row on the free plan to
 * hold it). The customer carries the workspace id, for whoever reads Stripe.
 */
export async function ensureStripeCustomer(buyer: CheckoutBuyer): Promise<string> {
  const stripe = getStripe();
  const [workspace] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, buyer.orgId))
    .limit(1);
  if (!workspace) {
    throw new ActionRefusal("unknown_workspace");
  }

  const known = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, buyer.orgId) });
  if (known?.stripeCustomerId) {
    return known.stripeCustomerId;
  }

  // One customer per workspace even if two calls race: Stripe gives the same
  // answer to the same key for a day, and the row below is written under a lock
  const customer = await stripe.customers.create(
    { name: workspace.name, email: buyer.email, metadata: { orgId: buyer.orgId } },
    { idempotencyKey: `customer-${buyer.orgId}-${encodeURIComponent(workspace.name).slice(0, 80)}` },
  );
  const free = findFreePlan();
  if (free) {
    await ensurePlanRow(free.id);
  }

  return db.transaction(async (tx) => {
    await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, buyer.orgId)).for("update");
    const row = await tx.query.subscription.findFirst({ where: eq(subscription.organizationId, buyer.orgId) });
    if (row?.stripeCustomerId) {
      return row.stripeCustomerId;
    }

    if (row) {
      await tx.update(subscription).set({ stripeCustomerId: customer.id, updatedAt: new Date() }).where(eq(subscription.id, row.id));
    } else {
      await tx.insert(subscription).values({
        id: generateId(),
        organizationId: buyer.orgId,
        stripeCustomerId: customer.id,
        status: "active",
        planId: free?.id ?? "free",
      });
    }

    return customer.id;
  });
}

/** Whether a free trial is offered: the plan has one and the person who owns the workspace has not used theirs. */
export async function isTrialAvailable(orgId: string, planId: string): Promise<boolean> {
  const plan = getPlanById(planId);
  if (!plan?.trialDays) {
    return false;
  }

  const owner = await getWorkspaceOwner(orgId);
  if (!owner) {
    return false;
  }

  const [row] = await db.select({ used: user.trialUsedAt }).from(user).where(eq(user.id, owner.id)).limit(1);
  return row !== undefined && row.used === null;
}

function taxParams(): Pick<Stripe.Checkout.SessionCreateParams, "automatic_tax" | "billing_address_collection" | "tax_id_collection" | "customer_update"> {
  if (env.STRIPE_TAX_ENABLED !== true) {
    return {};
  }

  return {
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
  };
}

/** The part of the session that says how the buyer comes back, by the kind of page. */
function returnParams(locale: string): Pick<Stripe.Checkout.SessionCreateParams, "ui_mode" | "return_url" | "redirect_on_completion" | "success_url" | "cancel_url"> {
  const back = `${appUrl()}/${locale}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
  if (usesEmbeddedCheckout()) {
    return { ui_mode: "embedded_page", return_url: back, redirect_on_completion: "always" };
  }

  // Stripe's own page: it comes back to the same return page, or to the prices on cancel, with no error
  return { ui_mode: "hosted_page", success_url: back, cancel_url: `${appUrl()}/${locale}/pricing` };
}

function launchOf(session: Stripe.Checkout.Session): CheckoutLaunch {
  return { kind: session.ui_mode === "embedded_page" ? "embedded" : "hosted", sessionId: session.id, url: session.url };
}

/** A key that makes a double click open one session, not two: the same request in the same minute. */
function idempotencyKey(...parts: string[]): string {
  return `checkout-${parts.join("-")}-${Math.floor(Date.now() / 60_000)}`;
}

/**
 * Opens the checkout of a subscription. A workspace that already has a live paid
 * subscription is refused (it changes plan, it does not subscribe again), and so
 * is a plan that is not sold. The trial is given once per owner, and only when
 * the plan has one; the card is asked at entry unless `BILLING_TRIAL_WITHOUT_CARD`.
 */
export async function createPlanCheckout(
  buyer: CheckoutBuyer,
  choice: { planId: string; interval: BillingInterval },
): Promise<CheckoutLaunch> {
  requireStripeKey();
  const plan = getPlanById(choice.planId);
  if (!plan || !isPaidPlan(plan)) {
    throw new ActionRefusal("unknown_plan");
  }
  const priceId = priceIdFor(plan.id, choice.interval);
  if (!priceId) {
    throw new ActionRefusal("price_missing");
  }

  const current = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, buyer.orgId),
  });
  if (current?.stripeSubscriptionId && isLiveStatus(current.status)) {
    throw new ActionRefusal("already_subscribed");
  }

  const customer = await ensureStripeCustomer(buyer);
  const trial = await isTrialAvailable(buyer.orgId, plan.id);
  const withoutCard = trial && env.BILLING_TRIAL_WITHOUT_CARD === true;

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "subscription",
      customer,
      client_reference_id: buyer.orgId,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(withoutCard ? { payment_method_collection: "if_required" as const } : {}),
      ...returnParams(buyer.locale),
      ...taxParams(),
      locale: buyer.locale === "fr" ? "fr" : "en",
      metadata: { orgId: buyer.orgId, userId: buyer.userId, kind: "subscription", planId: plan.id, interval: choice.interval, trialDays: String(trial ? plan.trialDays : 0) },
      subscription_data: {
        metadata: { orgId: buyer.orgId, planId: plan.id, locale: buyer.locale },
        ...(trial ? { trial_period_days: plan.trialDays } : {}),
        ...(withoutCard ? { trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } } } : {}),
      },
    },
    { idempotencyKey: idempotencyKey(buyer.orgId, buyer.userId, buyer.locale, plan.id, choice.interval, String(trial)) },
  );

  return launchOf(session);
}

/** Opens the checkout of a pack of credits: a one-off payment, credited when the provider says it is paid. */
export async function createPackCheckout(buyer: CheckoutBuyer, packId: string): Promise<CheckoutLaunch> {
  requireStripeKey();
  const pack = getCreditPack(packId);
  if (!pack) {
    throw new ActionRefusal("unknown_pack");
  }
  const priceId = packPriceId(pack.id);
  if (!priceId) {
    throw new ActionRefusal("price_missing");
  }

  const customer = await ensureStripeCustomer(buyer);
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer,
      client_reference_id: buyer.orgId,
      line_items: [{ price: priceId, quantity: 1 }],
      ...returnParams(buyer.locale),
      ...taxParams(),
      locale: buyer.locale === "fr" ? "fr" : "en",
      metadata: { orgId: buyer.orgId, userId: buyer.userId, kind: "credit_pack", packId: pack.id, credits: String(pack.credits) },
    },
    { idempotencyKey: idempotencyKey(buyer.orgId, buyer.userId, buyer.locale, pack.id) },
  );

  return launchOf(session);
}
