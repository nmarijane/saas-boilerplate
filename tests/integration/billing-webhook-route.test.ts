import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/stripe/webhook/route";
import { emitEvent } from "@/features/events/emitter";
import { auditLog, organization, plan, stripeEvent, subscription } from "@/models";
import { testDb } from "../setup";

// The route refuses to run without the secret that signs the events: the signature check itself is replaced below
vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "fake-webhook-secret";
});

/**
 * What the Stripe webhook answers for a workspace that is gone. Deleting a
 * workspace cancels its subscription first, and Stripe then tells about it (and
 * may still tell about a payment or a checkout): with no row left to change, the
 * handlers tell nothing and the route answers 200. An error would make Stripe
 * send the event again for days. The signature check is replaced: the event is
 * the one the test gives.
 */

const { next, cancel, retrieve } = vi.hoisted(() => ({
  next: { event: null as Stripe.Event | null },
  cancel: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("@/features/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (_body: string, signature: string) => {
        if (signature === "bad") {
          throw new Error("No signatures found matching the expected signature for payload");
        }
        return next.event;
      },
    },
    subscriptions: { cancel, retrieve },
  }),
}));

const GONE = { orgId: "gone-workspace" };
const subscriptionOfGone = {
  id: "sub_gone",
  status: "active",
  metadata: GONE,
  items: { data: [{ price: { id: "price_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
};
const invoiceOfGone = { parent: { subscription_details: { subscription: "sub_gone" } } };

function event(type: string, object: unknown, id = `evt_${type}`): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

async function deliver(stripeEvent: Stripe.Event, signature: string | null = "t=1,v1=signed") {
  next.event = stripeEvent;
  return POST(new Request("http://localhost:3088/api/stripe/webhook", {
    method: "POST",
    headers: signature === null ? {} : { "stripe-signature": signature },
    body: JSON.stringify(stripeEvent),
  }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  cancel.mockReset();
  // Stripe has the subscription, live, unless a case says otherwise
  retrieve.mockReset().mockResolvedValue(subscriptionOfGone);
  await testDb.delete(stripeEvent);
  await testDb.delete(auditLog);
  await testDb.delete(subscription);
  await testDb.delete(plan);
  await testDb.delete(organization);
});

describe("a Stripe webhook about a workspace that is gone", () => {
  it.each([
    ["customer.subscription.deleted", subscriptionOfGone],
    ["customer.subscription.updated", subscriptionOfGone],
    ["invoice.paid", invoiceOfGone],
    ["invoice.payment_failed", invoiceOfGone],
    ["checkout.session.completed", { mode: "subscription", metadata: GONE, subscription: "sub_gone", customer: "cus_gone" }],
  ])("answers 200 to %s, and tells nothing", async (type, object) => {
    const response = await deliver(event(type, object));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(emitEvent).not.toHaveBeenCalled();
    expect(await testDb.select().from(subscription)).toEqual([]);
  });
});

// A checkout opened before its workspace was deleted, and paid after: its
// subscription would renew every month, for a workspace that no longer exists,
// and nothing in the app could reach it. The app cancels it at once, only when
// the session carries the app's own metadata (the workspace it was opened for),
// and only for a workspace this app deleted (its log keeps the deletion): the
// Stripe account may also sell other things, or serve another copy of the app.
describe("a checkout paid for a workspace that was deleted", () => {
  async function deleted(orgId: string) {
    await testDb.insert(auditLog).values({ id: `deleted-${orgId}`, orgId: null, action: "organization.deleted", resourceType: "organization", resourceId: orgId, metadata: { name: "Northwind" } });
  }

  it("cancels its subscription at Stripe, tells nothing, and answers 200", async () => {
    await deleted("gone-workspace");

    const response = await deliver(event("checkout.session.completed", { mode: "subscription", metadata: GONE, subscription: "sub_gone", customer: "cus_gone" }));

    expect(response.status).toBe(200);
    expect(cancel).toHaveBeenCalledExactlyOnceWith("sub_gone");
    expect(emitEvent).not.toHaveBeenCalled();
    expect(await testDb.select().from(subscription)).toEqual([]);
  });

  it("never touches a subscription whose session lacks the app's metadata", async () => {
    await deleted("gone-workspace");

    for (const metadata of [{}, null, { order: "gone-workspace" }]) {
      const response = await deliver(event("checkout.session.completed", { mode: "subscription", metadata, subscription: "sub_other_product", customer: "cus_other" }));
      expect(response.status, JSON.stringify(metadata)).toBe(200);
    }

    expect(cancel).not.toHaveBeenCalled();
  });

  // Stripe delivers an event at least once. A second delivery of the checkout
  // finds its subscription cancelled, and Stripe refuses to cancel it again:
  // that refusal is the cancel done, and the route answers 200 again, not an
  // error that Stripe would send for days.
  it.each([
    ["Stripe no longer has the subscription", Object.assign(new Error("No such subscription: 'sub_gone'"), { type: "StripeInvalidRequestError", code: "resource_missing" })],
    ["Stripe refuses with another code, and reads the subscription cancelled", Object.assign(new Error("The subscription cannot be cancelled"), { type: "StripeInvalidRequestError" })],
  ])("answers 200 to the same checkout delivered twice: %s", async (_, refusal) => {
    await deleted("gone-workspace");
    cancel.mockResolvedValueOnce({ id: "sub_gone", status: "canceled" }).mockRejectedValueOnce(refusal);
    retrieve.mockResolvedValue({ ...subscriptionOfGone, status: "canceled" });
    const first = event("checkout.session.completed", { mode: "subscription", metadata: GONE, subscription: "sub_gone", customer: "cus_gone" }, "evt_first");
    const again = event("checkout.session.completed", { mode: "subscription", metadata: GONE, subscription: "sub_gone", customer: "cus_gone" }, "evt_again");

    expect((await deliver(first)).status).toBe(200);
    expect((await deliver(again)).status).toBe(200);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it("answers an error when Stripe cannot cancel a subscription that is still live: Stripe sends the event again", async () => {
    await deleted("gone-workspace");
    cancel.mockRejectedValueOnce(Object.assign(new Error("Could not connect to Stripe"), { type: "StripeConnectionError" }));

    const response = await deliver(event("checkout.session.completed", { mode: "subscription", metadata: GONE, subscription: "sub_gone", customer: "cus_gone" }));

    expect(response.status).toBe(500);
  });

  it("never touches the subscription of a workspace this app never had: another copy of the app on the same account", async () => {
    const response = await deliver(event("checkout.session.completed", { mode: "subscription", metadata: { orgId: "a-workspace-of-another-copy" }, subscription: "sub_elsewhere", customer: "cus_elsewhere" }));

    expect(response.status).toBe(200);
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("the signature and the claim of an event", () => {
  beforeEach(() => {
    retrieve.mockResolvedValue({ ...subscriptionOfGone, metadata: {} });
  });

  it("refuses a call with no signature, and one whose signature is wrong, before reading anything", async () => {
    const body = event("invoice.paid", invoiceOfGone);

    expect((await deliver(body, null)).status).toBe(400);
    const bad = await deliver(body, "bad");
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toContain("signature verification failed");
    expect(await testDb.select().from(stripeEvent)).toEqual([]);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("handles an event delivered twice once, and answers the second delivery as done", async () => {
    const paid = event("invoice.paid", invoiceOfGone, "evt_twice");

    expect(await (await deliver(paid)).json()).toEqual({ received: true });
    expect(await (await deliver(paid)).json()).toEqual({ received: true, duplicate: true });

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(await testDb.select().from(stripeEvent)).toMatchObject([{ id: "evt_twice", type: "invoice.paid", status: "done" }]);
  });

  it("lets go of the claim when the handler fails, so that the provider's next delivery is handled", async () => {
    const paid = event("invoice.paid", invoiceOfGone, "evt_retried");
    retrieve.mockRejectedValueOnce(new Error("Stripe is down"));

    expect((await deliver(paid)).status).toBe(500);
    expect(await testDb.select().from(stripeEvent)).toEqual([]);

    expect((await deliver(paid)).status).toBe(200);
    expect(await testDb.select().from(stripeEvent)).toMatchObject([{ id: "evt_retried", status: "done" }]);
  });

  it("answers an error to a delivery that arrives while another is handling the same event, and takes over a claim that was abandoned", async () => {
    const paid = event("invoice.paid", invoiceOfGone, "evt_busy");
    await testDb.insert(stripeEvent).values({ id: "evt_busy", type: "invoice.paid", status: "processing" });

    expect((await deliver(paid)).status).toBe(409);

    await testDb.update(stripeEvent).set({ updatedAt: new Date(Date.now() - 10 * 60_000) });
    expect((await deliver(paid)).status).toBe(200);
  });

  it("takes an event the app does not use, and records it", async () => {
    const response = await deliver(event("customer.created", {}, "evt_unused"));

    expect(response.status).toBe(200);
    expect(await testDb.select().from(stripeEvent)).toMatchObject([{ id: "evt_unused", status: "done" }]);
  });
});
