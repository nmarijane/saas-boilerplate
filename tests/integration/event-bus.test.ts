import type { AppEvent } from "@/features/events/types";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuditLog } from "@/features/events/handlers/audit-log";
import { handleNotification } from "@/features/events/handlers/notification";
import { auditLog } from "@/models/audit-log";
import { notification } from "@/models/notification";
import { organization } from "@/models/organization";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const ORG_ID = "ev-org-1";
const USER_ID = "ev-user-1";
const OWNER_ID = "ev-owner-1";

function makeEvent(
  name: AppEvent["name"],
  overrides: Partial<AppEvent["payload"]> = {},
): AppEvent {
  return {
    name,
    payload: {
      orgId: ORG_ID,
      actorId: USER_ID,
      resourceType: "test",
      resourceId: "res-1",
      ...overrides,
    },
    timestamp: new Date(),
  };
}

describe("handleAuditLog", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(auditLog);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  it("inserts an audit log entry", async () => {
    await handleAuditLog(makeEvent("api_key.created"));

    const logs = await testDb.select().from(auditLog);
    expect(logs).toHaveLength(1);
  });

  it("audit log entry has correct fields", async () => {
    const event = makeEvent("webhook.created", {
      resourceType: "webhook_endpoint",
      resourceId: "wh-123",
      metadata: { url: "https://example.com" },
    });
    await handleAuditLog(event);

    const logs = await testDb.select().from(auditLog);
    expect(logs).toHaveLength(1);

    const log = logs[0];
    expect(log.action).toBe("webhook.created");
    expect(log.orgId).toBe(ORG_ID);
    expect(log.actorId).toBe(USER_ID);
    expect(log.resourceType).toBe("webhook_endpoint");
    expect(log.resourceId).toBe("wh-123");
    expect(log.metadata).toEqual({ url: "https://example.com" });
  });

  it("works with null actorId (system events)", async () => {
    const event = makeEvent("payment.failed", { actorId: undefined });
    await handleAuditLog(event);

    const logs = await testDb.select().from(auditLog);
    expect(logs).toHaveLength(1);
    expect(logs[0].actorId).toBeNull();
  });

  // The log of a workspace goes with it, as the deletion promises: the entry that
  // says it was deleted, and by whom, is the platform's, and outlives the cascade
  it("writes the deletion of a workspace as an entry of the platform, which outlives the workspace", async () => {
    await handleAuditLog(makeEvent("api_key.created"));
    await handleAuditLog(makeEvent("organization.deleted", {
      resourceType: "organization",
      resourceId: ORG_ID,
      metadata: { name: "Northwind" },
    }));

    await testDb.delete(organization).where(eq(organization.id, ORG_ID));

    expect(await testDb.select().from(auditLog)).toEqual([
      expect.objectContaining({
        orgId: null,
        action: "organization.deleted",
        actorId: USER_ID,
        resourceType: "organization",
        resourceId: ORG_ID,
        metadata: { name: "Northwind" },
      }),
    ]);
  });
});

describe("handleNotification", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(notification);
    await testDb.delete(auditLog);
    await seedUser(OWNER_ID, { email: "owner@test.com" });
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
    await seedOrgMember(OWNER_ID, ORG_ID, "owner");
  });

  // The words are drawn when the notification is read, in the reader's language,
  // from its type: what is stored is the event, its workspace and the values its
  // messages name, never English sentences.
  it("creates a notification for the owner of the workspace, as the event and the values its messages name", async () => {
    await handleNotification(makeEvent("payment.failed", { metadata: { planId: "pro", amount: 2900 } }));

    const notifications = await testDb.select().from(notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      userId: OWNER_ID,
      organizationId: ORG_ID,
      type: "payment.failed",
      title: null,
      body: null,
      values: { workspace: "Test Org", planId: "pro" },
    });
  });

  it("creates notification for member.invited event", async () => {
    await handleNotification(makeEvent("member.invited"));

    const notifications = await testDb.select().from(notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: "member.invited", organizationId: ORG_ID, title: null, body: null });
  });

  it("gives every event it notifies a message in both languages", async () => {
    const { NOTIFIED_EVENTS } = await import("@/features/events/handlers/notification");
    const { default: en } = await import("@/locales/en.json");
    const { default: fr } = await import("@/locales/fr.json");
    const messageOf = (messages: unknown, name: string) =>
      [...name.split("."), "title"].reduce<unknown>(
        (node, key) => (node as Record<string, unknown> | undefined)?.[key],
        (messages as { notifications: { events: unknown } }).notifications.events,
      );

    expect(NOTIFIED_EVENTS.length).toBeGreaterThan(0);
    for (const name of NOTIFIED_EVENTS) {
      expect(typeof messageOf(en, name), `${name} in English`).toBe("string");
      expect(typeof messageOf(fr, name), `${name} in French`).toBe("string");
    }
  });

  it("does NOT create a notification for unmapped events", async () => {
    const event = makeEvent("api_key.created");
    await handleNotification(event);

    const notifications = await testDb.select().from(notification);
    expect(notifications).toHaveLength(0);
  });

  it("does NOT create a notification if no org owner found", async () => {
    // Use an org with no members
    const lonelyOrgId = "ev-org-lonely";
    await seedOrg(lonelyOrgId);

    const event = makeEvent("payment.failed", { orgId: lonelyOrgId });
    await handleNotification(event);

    const notifications = await testDb.select().from(notification);
    expect(notifications).toHaveLength(0);
  });
});
