import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleWebhook } from "@/features/events/handlers/webhook";
import { organization, webhookEndpoint } from "@/models";
import { seedOrg } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What waits in the queue for the job that delivers an event: which endpoint and
 * what happened. The address and the signing secret of the endpoint are in its
 * row, and the job reads them there when it runs.
 */

const { queue } = vi.hoisted(() => ({ queue: [] as { name: string; data: Record<string, unknown> }[] }));
vi.mock("@/shared/lib/inngest/client", () => ({
  inngest: { send: async (message: { name: string; data: Record<string, unknown> }) => void queue.push(message) },
}));

const ORG = "queue-org";
const event = {
  name: "project.created" as const,
  payload: { orgId: ORG, resourceType: "project", resourceId: "p1" },
  timestamp: new Date("2026-01-02T03:04:05.000Z"),
};

beforeEach(async () => {
  queue.length = 0;
  await testDb.delete(webhookEndpoint);
  await testDb.delete(organization);
  await seedOrg(ORG);
  await testDb.insert(webhookEndpoint).values([
    { id: "listens", orgId: ORG, url: "https://hooks.example.com/a", secret: "sb_whsec_do-not-queue-me", events: ["project.*"] },
    { id: "deaf", orgId: ORG, url: "https://hooks.example.com/b", secret: "another-secret", events: ["payment.succeeded"] },
  ]);
});

describe("queueing the delivery of an event", () => {
  it("queues the endpoint's id, the event and its body", async () => {
    await handleWebhook(event);

    expect(queue).toEqual([
      {
        name: "webhook/deliver",
        data: {
          endpointId: "listens",
          event: "project.created",
          payload: { event: "project.created", data: event.payload, timestamp: "2026-01-02T03:04:05.000Z" },
        },
      },
    ]);
  });

  it("never puts the secret or the address of an endpoint in the queue", async () => {
    await handleWebhook(event);

    const queued = JSON.stringify(queue);
    expect(queued).not.toContain("sb_whsec_do-not-queue-me");
    expect(queued).not.toContain("hooks.example.com");
    expect(Object.keys(queue[0]?.data ?? {}).sort()).toEqual(["endpointId", "event", "payload"]);
  });
});
