import { beforeEach, describe, expect, it } from "vitest";
import { getAuditLogs } from "@/features/audit/queries";
import { auditLog } from "@/models/audit-log";
import { seedOrg, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const ORG_ID = "audit-org-1";
const USER_ID = "audit-user-1";

async function insertAuditLog(
  action: string,
  overrides: Record<string, unknown> = {},
) {
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await testDb.insert(auditLog).values({
    id,
    orgId: ORG_ID,
    actorId: USER_ID,
    action,
    resourceType: "test",
    resourceId: "res-1",
    ...overrides,
  });
  return id;
}

describe("audit queries", () => {
  beforeEach(async () => {
    await testDb.delete(auditLog);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  it("returns empty for fresh DB", async () => {
    const logs = await getAuditLogs();
    expect(logs).toHaveLength(0);
  });

  it("returns logs ordered by createdAt desc", async () => {
    // Insert with explicit timestamps to ensure ordering
    await insertAuditLog("action-old", {
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    await insertAuditLog("action-new", {
      createdAt: new Date("2025-06-01T00:00:00Z"),
    });

    const logs = await getAuditLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe("action-new");
    expect(logs[1].action).toBe("action-old");
  });

  it("respects limit parameter", async () => {
    await insertAuditLog("a1");
    await insertAuditLog("a2");
    await insertAuditLog("a3");

    const logs = await getAuditLogs(2);
    expect(logs).toHaveLength(2);
  });
});
