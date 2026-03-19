import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitEvent } from "@/features/events/emitter";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "@/features/webhooks/actions";
import {
  getWebhookDeliveries,
  getWebhookEndpointsForOrg,
} from "@/features/webhooks/queries";
import { webhookDelivery, webhookEndpoint } from "@/models/webhook";
import { seedOrg, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const ORG_ID = "wh-org-1";
const USER_ID = "wh-user-1";

describe("webhook actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(webhookDelivery);
    await testDb.delete(webhookEndpoint);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  describe("createWebhookEndpointAction", () => {
    it("creates an endpoint and returns the secret", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, USER_ID, {
        url: "https://example.com/webhook",
        events: ["payment.succeeded"],
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("secret");
      expect(result.secret).toMatch(/^whsec_/);
    });

    it("persists the endpoint in the database", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, USER_ID, {
        url: "https://example.com/webhook",
        events: ["payment.succeeded"],
      });

      const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].id).toBe(result.id);
      expect(endpoints[0].url).toBe("https://example.com/webhook");
      expect(endpoints[0].active).toBe(true);
    });

    it("emits webhook.created event", async () => {
      await createWebhookEndpointAction(ORG_ID, USER_ID, {
        url: "https://example.com/hook",
        events: ["member.invited"],
      });

      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
        "webhook.created",
        expect.objectContaining({
          orgId: ORG_ID,
          actorId: USER_ID,
          resourceType: "webhook_endpoint",
        }),
      );
    });

    it("rejects invalid URL", async () => {
      await expect(
        createWebhookEndpointAction(ORG_ID, USER_ID, {
          url: "not-a-url",
          events: ["payment.succeeded"],
        }),
      ).rejects.toThrow();
    });

    it("rejects empty events array", async () => {
      await expect(
        createWebhookEndpointAction(ORG_ID, USER_ID, {
          url: "https://example.com/hook",
          events: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe("deleteWebhookEndpointAction", () => {
    it("removes the endpoint", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, USER_ID, {
        url: "https://example.com/delete-me",
        events: ["payment.succeeded"],
      });
      vi.clearAllMocks();

      await deleteWebhookEndpointAction(result.id, ORG_ID, USER_ID);

      const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoints).toHaveLength(0);
    });

    it("emits webhook.deleted event", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, USER_ID, {
        url: "https://example.com/delete-event",
        events: ["payment.succeeded"],
      });
      vi.clearAllMocks();

      await deleteWebhookEndpointAction(result.id, ORG_ID, USER_ID);

      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
        "webhook.deleted",
        expect.objectContaining({
          orgId: ORG_ID,
          actorId: USER_ID,
          resourceType: "webhook_endpoint",
          resourceId: result.id,
        }),
      );
    });
  });

  describe("toggleWebhookEndpointAction", () => {
    it("toggles active status to false", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, USER_ID, {
        url: "https://example.com/toggle",
        events: ["payment.succeeded"],
      });

      await toggleWebhookEndpointAction(result.id, false);

      const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoints[0].active).toBe(false);
    });

    it("toggles active status back to true", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, USER_ID, {
        url: "https://example.com/toggle-back",
        events: ["payment.succeeded"],
      });

      await toggleWebhookEndpointAction(result.id, false);
      await toggleWebhookEndpointAction(result.id, true);

      const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoints[0].active).toBe(true);
    });
  });
});

describe("webhook queries", () => {
  beforeEach(async () => {
    await testDb.delete(webhookDelivery);
    await testDb.delete(webhookEndpoint);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  it("getWebhookEndpointsForOrg returns endpoints for an org", async () => {
    await createWebhookEndpointAction(ORG_ID, USER_ID, {
      url: "https://example.com/a",
      events: ["payment.succeeded"],
    });
    await createWebhookEndpointAction(ORG_ID, USER_ID, {
      url: "https://example.com/b",
      events: ["member.invited"],
    });

    const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
    expect(endpoints).toHaveLength(2);
  });

  it("getWebhookDeliveries returns deliveries for an endpoint", async () => {
    const endpoint = await createWebhookEndpointAction(ORG_ID, USER_ID, {
      url: "https://example.com/deliveries",
      events: ["payment.succeeded"],
    });

    // Insert delivery records manually
    await testDb.insert(webhookDelivery).values({
      id: "wh-del-1",
      endpointId: endpoint.id,
      event: "payment.succeeded",
      payload: { test: true },
      statusCode: 200,
    });
    await testDb.insert(webhookDelivery).values({
      id: "wh-del-2",
      endpointId: endpoint.id,
      event: "payment.failed",
      payload: { test: false },
      statusCode: 500,
    });

    const deliveries = await getWebhookDeliveries(endpoint.id);
    expect(deliveries).toHaveLength(2);
  });

  it("getWebhookDeliveries respects limit", async () => {
    const endpoint = await createWebhookEndpointAction(ORG_ID, USER_ID, {
      url: "https://example.com/limit",
      events: ["payment.succeeded"],
    });

    for (let i = 0; i < 5; i++) {
      await testDb.insert(webhookDelivery).values({
        id: `wh-del-limit-${i}`,
        endpointId: endpoint.id,
        event: "payment.succeeded",
        payload: { i },
        statusCode: 200,
      });
    }

    const deliveries = await getWebhookDeliveries(endpoint.id, 3);
    expect(deliveries).toHaveLength(3);
  });
});
