import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliverWebhook, recordDeliveryAttempt } from "@/features/webhooks/service";
import { organization, webhookDelivery, webhookEndpoint } from "@/models";
import { seedOrg } from "../../helpers/seed";
import { testDb } from "../../setup";

const ORG = "delivery-org";
const ENDPOINT = "delivery-endpoint";

function attempt(endpointId = ENDPOINT) {
  return {
    endpointId,
    event: "organization.deleted",
    payload: { event: "organization.deleted" },
    statusCode: 200,
    responseBody: "ok",
    attemptNumber: 1,
  };
}

describe("recording an attempt to deliver a webhook", () => {
  beforeEach(async () => {
    await testDb.delete(webhookDelivery);
    await testDb.delete(webhookEndpoint);
    await testDb.delete(organization);
    await seedOrg(ORG);
    await testDb.insert(webhookEndpoint).values({ id: ENDPOINT, orgId: ORG, url: "https://hooks.example.com", secret: "secret", events: ["*"] });
  });

  it("keeps it in the log of its endpoint", async () => {
    await recordDeliveryAttempt(attempt());

    expect(await testDb.select({ event: webhookDelivery.event }).from(webhookDelivery)).toEqual([{ event: "organization.deleted" }]);
  });

  // The event that a workspace is deleted is queued while its endpoints exist, and
  // delivered once they are gone with it: the delivery happened, and nothing is
  // left to log it in. A job that failed for that would be run again, and the
  // receiver would get the same event once per retry.
  it("does not fail when the endpoint is gone with its workspace: the attempt happened, and is not repeated for that", async () => {
    await testDb.delete(organization).where(eq(organization.id, ORG));

    await expect(recordDeliveryAttempt(attempt())).resolves.toBeUndefined();
    expect(await testDb.select().from(webhookDelivery)).toEqual([]);
  });

  it("still fails for any other reason: the job is run again", async () => {
    await expect(recordDeliveryAttempt({ ...attempt(), event: null as unknown as string })).rejects.toThrow();
  });
});

// The job that delivers an event, with the network replaced
describe("delivering a webhook", () => {
  const delivery = {
    endpointId: ENDPOINT,
    url: "https://hooks.example.com",
    secret: "secret",
    event: "organization.deleted",
    payload: { event: "organization.deleted" },
  };

  beforeEach(async () => {
    await testDb.delete(webhookDelivery);
    await testDb.delete(webhookEndpoint);
    await testDb.delete(organization);
    await seedOrg(ORG);
    await testDb.insert(webhookEndpoint).values({ id: ENDPOINT, orgId: ORG, url: "https://hooks.example.com", secret: "secret", events: ["*"] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delivers to an endpoint that went with its workspace once, and does not ask to be run again", async () => {
    const fetch = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await testDb.delete(organization).where(eq(organization.id, ORG));

    await expect(deliverWebhook(delivery)).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledOnce();
    expect(await testDb.select().from(webhookDelivery)).toEqual([]);
  });

  it("logs a delivery to an endpoint that exists, signed", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await deliverWebhook(delivery);

    const [, init] = fetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("X-Webhook-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(await testDb.select({ statusCode: webhookDelivery.statusCode }).from(webhookDelivery)).toEqual([{ statusCode: 200 }]);
  });

  // A delivery that failed is a delivery to try again, whatever became of the endpoint
  it("asks to be run again when the receiver refuses, and logs it while it can", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));

    await expect(deliverWebhook(delivery)).rejects.toThrow("HTTP 503");
    expect(await testDb.select({ statusCode: webhookDelivery.statusCode }).from(webhookDelivery)).toEqual([{ statusCode: 503 }]);

    await testDb.delete(organization).where(eq(organization.id, ORG));
    await expect(deliverWebhook(delivery)).rejects.toThrow("HTTP 503");
  });
});
