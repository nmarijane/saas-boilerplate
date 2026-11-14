import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/stripe/webhook/route";
import { stripeEvent } from "@/models";
import { testDb } from "../setup";

/**
 * The signature of an event is the real one: the payload is signed with a test secret by the SDK's own helper and
 * checked by the real `constructEvent` (no account, no network). Only the handlers' provider is replaced.
 */

const SECRET = "fake-webhook-secret-for-signatures";
vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "fake-webhook-secret-for-signatures";
});
const stripe = new Stripe("fake-key");
vi.mock("@/features/billing/stripe", () => ({ getStripe: () => stripe }));

function call(payload: string, header: string | null) {
  return POST(new Request("http://localhost:3088/api/stripe/webhook", { method: "POST", headers: header ? { "stripe-signature": header } : {}, body: payload }));
}

const payload = JSON.stringify({ id: "evt_signed", object: "event", type: "customer.created", data: { object: {} } });

beforeEach(async () => {
  await testDb.delete(stripeEvent);
});

describe("the signature of a webhook", () => {
  it("is accepted when it is the secret's, over this body", async () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });

    expect((await call(payload, header)).status).toBe(200);
  });

  it.each([
    ["a body that was changed", () => [payload.replace("evt_signed", "evt_forged"), stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })]],
    ["another secret", () => [payload, stripe.webhooks.generateTestHeaderString({ payload, secret: "another-secret" })]],
    ["a signature that is too old", () => [payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 })]],
    ["a header that is no signature", () => [payload, "not-a-signature"]],
  ] as const)("is refused for %s, and nothing is recorded", async (_, make) => {
    const [body, header] = make();

    expect((await call(body, header)).status).toBe(400);
    expect(await testDb.select().from(stripeEvent)).toEqual([]);
  });
});
