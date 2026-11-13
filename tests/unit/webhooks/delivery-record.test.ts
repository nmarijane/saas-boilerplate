import type { Transport } from "@/features/webhooks/outbound";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

// What the job does with an event it is given: it reads the endpoint, as it is now, and delivers with the
// network replaced (a resolver that answers a public address, a transport that answers what it is told to)
describe("delivering a webhook", () => {
  const SECRET = "the-secret-of-the-endpoint";
  const delivery = {
    endpointId: ENDPOINT,
    event: "project.created",
    payload: { event: "project.created", data: { id: "p1" } },
  };

  const network = (transport: Transport) => ({
    development: false,
    resolver: async () => [{ address: "93.184.216.34", family: 4 }],
    transport,
  });
  const answers = (status: number, body = "ok") => vi.fn<Transport>(async () => ({ status, body }));

  beforeEach(async () => {
    await testDb.delete(webhookDelivery);
    await testDb.delete(webhookEndpoint);
    await testDb.delete(organization);
    await seedOrg(ORG);
    await testDb
      .insert(webhookEndpoint)
      .values({ id: ENDPOINT, orgId: ORG, url: "https://hooks.example.com/in", secret: SECRET, events: ["*"] });
  });

  it("signs the body with the secret that the endpoint's row holds, and logs the delivery", async () => {
    const transport = answers(200);

    await expect(deliverWebhook(delivery, network(transport))).resolves.toBe("delivered");

    const [connection] = transport.mock.calls[0] ?? [];
    expect(connection?.url.href).toBe("https://hooks.example.com/in");
    expect(connection?.body).toBe(JSON.stringify(delivery.payload));
    expect(connection?.headers["X-Webhook-Signature"]).toBe(createHmac("sha256", SECRET).update(connection?.body ?? "").digest("hex"));
    expect(connection?.headers["X-Webhook-Event"]).toBe("project.created");
    expect(await testDb.select({ statusCode: webhookDelivery.statusCode }).from(webhookDelivery)).toEqual([{ statusCode: 200 }]);
  });

  // The secret and the address are not in what the job is given: the row is the only place they live
  it("takes the address from the row, as it is when the job runs", async () => {
    await testDb.update(webhookEndpoint).set({ url: "https://moved.example.com/in" }).where(eq(webhookEndpoint.id, ENDPOINT));
    const transport = answers(200);

    await deliverWebhook(delivery, network(transport));

    expect(transport.mock.calls[0]?.[0].url.href).toBe("https://moved.example.com/in");
  });

  it.each([
    ["deleted", async () => testDb.delete(webhookEndpoint).where(eq(webhookEndpoint.id, ENDPOINT))],
    ["switched off", async () => testDb.update(webhookEndpoint).set({ active: false }).where(eq(webhookEndpoint.id, ENDPOINT))],
  ])("delivers nothing to an endpoint that was %s since the event was queued, and does not ask to be run again", async (_, change) => {
    await change();
    const transport = answers(200);

    await expect(deliverWebhook(delivery, network(transport))).resolves.toBe("skipped");

    expect(transport).not.toHaveBeenCalled();
    expect(await testDb.select().from(webhookDelivery)).toEqual([]);
  });

  // A delivery that failed is a delivery to try again
  it("asks to be run again when the receiver refuses, and logs it", async () => {
    await expect(deliverWebhook(delivery, network(answers(503, "down")))).rejects.toThrow("HTTP 503");

    expect(await testDb.select({ statusCode: webhookDelivery.statusCode }).from(webhookDelivery)).toEqual([{ statusCode: 503 }]);
  });

  it("asks to be run again when the receiver redirects: a redirect is not followed, so nothing was delivered", async () => {
    await expect(deliverWebhook(delivery, network(answers(302, "")))).rejects.toThrow("HTTP 302");
  });

  // A resolver that is down for a moment is not a refusal: the job runs again, and the log says one thing
  it("asks to be run again when the resolver fails for a moment, and delivers when it answers", async () => {
    const transport = answers(200);
    let calls = 0;
    const resolver = async () => {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error("getaddrinfo EAI_AGAIN"), { code: "EAI_AGAIN" });
      }

      return [{ address: "93.184.216.34", family: 4 }];
    };

    await expect(deliverWebhook(delivery, { ...network(transport), resolver })).rejects.toThrow("Not delivered");
    expect(transport).not.toHaveBeenCalled();
    expect((await testDb.select().from(webhookDelivery))[0]?.responseBody).toBe("Not delivered");

    await expect(deliverWebhook(delivery, { ...network(transport), resolver })).resolves.toBe("delivered");
  });

  // The address is checked when the event is delivered, whatever it was when the endpoint was made: a name leads somewhere else tomorrow
  it("refuses an endpoint whose name now leads to a private address: it connects to nothing, logs why, and is not run again", async () => {
    const transport = answers(200);

    const outcome = await deliverWebhook(delivery, {
      ...network(transport),
      resolver: async () => [{ address: "169.254.169.254", family: 4 }],
    });

    expect(outcome).toBe("refused");
    expect(transport).not.toHaveBeenCalled();
    const [logged] = await testDb.select().from(webhookDelivery);
    expect(logged?.statusCode).toBeNull();
    expect(logged?.responseBody).toBe("Not delivered");
  });
});
