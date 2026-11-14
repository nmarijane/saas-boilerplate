import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe } from "@/features/billing/stripe";
import { claimEvent, completeEvent, releaseEvent } from "@/features/billing/webhook-events";
import {
  handleCheckoutAsyncPaymentSucceeded,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionChanged,
  handleTrialWillEnd,
} from "@/features/billing/webhook-handlers";
import { env } from "@/shared/lib/env";

/** Runs what an event of the provider means for the app. An event the app does not use is taken and ignored. */
async function dispatch(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object);
    case "checkout.session.async_payment_succeeded":
      return handleCheckoutAsyncPaymentSucceeded(event.data.object);
    case "invoice.paid":
      return handleInvoicePaid(event.data.object);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionChanged(event.data.object);
    case "customer.subscription.trial_will_end":
      return handleTrialWillEnd(event.data.object);
    default:
      return undefined;
  }
}

// The route of the payment provider: the signature is verified on the raw body
// before anything is read; the event is claimed before it is handled (delivered
// twice, it is handled once); a handler that fails lets its claim go and answers
// 500, so that the provider sends it again.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhooks are not configured" }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const claim = await claimEvent(event.id, event.type);
  if (claim === "done") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim === "busy") {
    return NextResponse.json({ error: "Event is being handled" }, { status: 409 });
  }

  try {
    await dispatch(event);
    await completeEvent(event.id);
  } catch (err) {
    await releaseEvent(event.id);
    // Kept in the log of the app; the provider is told no more than that it failed (it sends the event again)
    console.error(`Billing: the handler of ${event.type} (${event.id}) failed`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
