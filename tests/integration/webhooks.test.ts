import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "@/features/webhooks/actions";
import { AVAILABLE_EVENTS } from "@/features/webhooks/available-events";
import {
  getWebhookDeliveries,
  getWebhookEndpointsForOrg,
} from "@/features/webhooks/queries";
import { webhookDelivery, webhookEndpoint } from "@/models/webhook";
import { seedOrg, seedUser } from "../helpers/seed";
import { fakeRoleGrant } from "../helpers/session";
import { testDb } from "../setup";

const ORG_ID = "wh-org-1";
const USER_ID = "wh-user-1";

describe("webhook actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(fakeRoleGrant(USER_ID, "admin"));
    await testDb.delete(webhookDelivery);
    await testDb.delete(webhookEndpoint);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  describe("createWebhookEndpointAction", () => {
    it("creates an endpoint and returns the secret", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, {
        url: "https://example.com/webhook",
        events: ["payment.succeeded"],
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("secret");
      expect(result.secret).toMatch(/^whsec_/);
    });

    it("persists the endpoint in the database", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, {
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
      await createWebhookEndpointAction(ORG_ID, {
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
        createWebhookEndpointAction(ORG_ID, {
          url: "not-a-url",
          events: ["payment.succeeded"],
        }),
      ).rejects.toThrow();
    });

    it("rejects empty events array", async () => {
      await expect(
        createWebhookEndpointAction(ORG_ID, {
          url: "https://example.com/hook",
          events: [],
        }),
      ).rejects.toThrow();
    });
  });

  // The dialog offers the events of `AVAILABLE_EVENTS` and nothing else, and the server takes the same list: a
  // request does not have to come from the dialog, and an endpoint asks only for events the app delivers.
  describe("the events of an endpoint", () => {
    const create = (events: string[]) =>
      createWebhookEndpointAction(ORG_ID, { url: "https://example.com/hook", events: events as never });

    it.each([
      ["a name that is no event", ["payment.refunded"]],
      ["a known event with a typo", ["payment.succeded"]],
      // The matcher that delivers (`matchEvent`) reads patterns, and an endpoint that holds one goes on working;
      // the action makes none, as the dialog offers names only
      ["a segment wildcard", ["subscription.*"]],
      ["the match-all pattern", ["**"]],
      ["an empty name", [""]],
      ["a name with the case changed", ["Payment.Succeeded"]],
      ["one unknown among known ones", ["payment.succeeded", "made.up"]],
    ])("refuses %s, and writes nothing", async (_, events) => {
      await expect(create(events)).rejects.toThrow();

      expect(await getWebhookEndpointsForOrg(ORG_ID)).toHaveLength(0);
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });

    it("takes every event the dialog offers, all at once", async () => {
      const { id } = await create(AVAILABLE_EVENTS);

      const [endpoint] = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoint?.id).toBe(id);
      expect(endpoint?.events).toEqual(AVAILABLE_EVENTS);
    });

    it("takes one event, whichever it is", async () => {
      for (const event of AVAILABLE_EVENTS) {
        await expect(create([event])).resolves.toHaveProperty("id");
      }

      expect(await getWebhookEndpointsForOrg(ORG_ID)).toHaveLength(AVAILABLE_EVENTS.length);
    });

    // A known event, repeated without end, is a list as long as a request can be: nothing needs more than one of each
    it("refuses a list longer than the list of events there are, one more than there are events included", async () => {
      await expect(create(Array.from({ length: AVAILABLE_EVENTS.length + 1 }, () => "payment.succeeded"))).rejects.toThrow();
      await expect(create([...AVAILABLE_EVENTS, "payment.succeeded"])).rejects.toThrow();
      await expect(create(Array.from({ length: 10_000 }, () => "payment.succeeded"))).rejects.toThrow();

      expect(await getWebhookEndpointsForOrg(ORG_ID)).toHaveLength(0);
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });

    it("takes a list as long as the list of events there are, however it is made up", async () => {
      await expect(create(Array.from({ length: AVAILABLE_EVENTS.length }, () => "payment.succeeded"))).resolves.toHaveProperty("id");
    });

    // An endpoint is delivered an event once, however many times it asked for it: the list is kept without repeats,
    // in the order each event was first given
    it("writes an event once, however many times it was asked for", async () => {
      await create(["payment.succeeded", "member.invited", "payment.succeeded", "member.invited", "payment.succeeded"]);

      const [endpoint] = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoint?.events).toEqual(["payment.succeeded", "member.invited"]);
    });

    it("writes one event, once, for a list that is the same event as long as the list can be", async () => {
      await create(Array.from({ length: AVAILABLE_EVENTS.length }, () => "payment.succeeded"));

      const [endpoint] = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoint?.events).toEqual(["payment.succeeded"]);
    });

    it("refuses a list with no event at all", async () => {
      await expect(create([])).rejects.toThrow();
    });
  });

  describe("deleteWebhookEndpointAction", () => {
    it("removes the endpoint", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, {
        url: "https://example.com/delete-me",
        events: ["payment.succeeded"],
      });
      vi.clearAllMocks();

      await deleteWebhookEndpointAction(result.id, ORG_ID);

      const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoints).toHaveLength(0);
    });

    it("emits webhook.deleted event", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, {
        url: "https://example.com/delete-event",
        events: ["payment.succeeded"],
      });
      vi.clearAllMocks();

      await deleteWebhookEndpointAction(result.id, ORG_ID);

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
      const result = await createWebhookEndpointAction(ORG_ID, {
        url: "https://example.com/toggle",
        events: ["payment.succeeded"],
      });

      await toggleWebhookEndpointAction(result.id, ORG_ID, false);

      const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoints[0].active).toBe(false);
    });

    it("toggles active status back to true", async () => {
      const result = await createWebhookEndpointAction(ORG_ID, {
        url: "https://example.com/toggle-back",
        events: ["payment.succeeded"],
      });

      await toggleWebhookEndpointAction(result.id, ORG_ID, false);
      await toggleWebhookEndpointAction(result.id, ORG_ID, true);

      const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
      expect(endpoints[0].active).toBe(true);
    });
  });
});

describe("webhook queries", () => {
  beforeEach(async () => {
    vi.mocked(requireRole).mockResolvedValue(fakeRoleGrant(USER_ID, "admin"));
    await testDb.delete(webhookDelivery);
    await testDb.delete(webhookEndpoint);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  it("getWebhookEndpointsForOrg returns endpoints for an org", async () => {
    await createWebhookEndpointAction(ORG_ID, {
      url: "https://example.com/a",
      events: ["payment.succeeded"],
    });
    await createWebhookEndpointAction(ORG_ID, {
      url: "https://example.com/b",
      events: ["member.invited"],
    });

    const endpoints = await getWebhookEndpointsForOrg(ORG_ID);
    expect(endpoints).toHaveLength(2);
  });

  it("getWebhookDeliveries returns deliveries for an endpoint", async () => {
    const endpoint = await createWebhookEndpointAction(ORG_ID, {
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
    const endpoint = await createWebhookEndpointAction(ORG_ID, {
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
