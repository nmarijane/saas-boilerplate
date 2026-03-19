import type { AppEvent } from "@/features/events/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuditLog } from "@/features/events/handlers/audit-log";
import { handleNotification } from "@/features/events/handlers/notification";
import { auditLog } from "@/models/audit-log";
import { notification } from "@/models/notification";
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

  it("creates a notification for org owner when event is in NOTIFICATION_MAP", async () => {
    const event = makeEvent("payment.failed");
    await handleNotification(event);

    const notifications = await testDb.select().from(notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(OWNER_ID);
    expect(notifications[0].title).toBe("Payment failed");
    expect(notifications[0].type).toBe("billing");
  });

  it("creates notification for member.invited event", async () => {
    const event = makeEvent("member.invited");
    await handleNotification(event);

    const notifications = await testDb.select().from(notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("New member invited");
    expect(notifications[0].type).toBe("info");
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
