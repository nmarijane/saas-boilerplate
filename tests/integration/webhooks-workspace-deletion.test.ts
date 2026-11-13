import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOrganization } from "@/features/auth/organization/actions";
import { auditLog, organization, organizationMember, user, webhookEndpoint } from "@/models";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What the webhooks of a workspace are told when it is deleted: the event bus
 * is the real one, and queues the delivery of `organization.deleted` to each
 * endpoint that listens for it before the rows go, while the endpoints still
 * exist (the cascade deletes them). The queue is faked: each event it is sent
 * records whether the workspace still existed. No feature holds anything for
 * the workspace here (the registry is empty).
 */

const { queued } = vi.hoisted(() => ({ queued: [] as { endpointId: string; url: string; event: string; workspace: "kept" | "gone" }[] }));
vi.mock("@/features/registry", () => ({ FEATURES: [] }));
vi.mock("@/features/events/emitter", async (importOriginal) => importOriginal());
vi.mock("@/shared/lib/inngest/client", async () => {
  const { testDb: db } = await import("../setup");
  const { organization: workspaces } = await import("@/models");
  const { eq: equals } = await import("drizzle-orm");
  return {
    inngest: {
      send: async ({ data }: { data: { endpointId: string; url: string; event: string } }) => {
        const kept = (await db.select().from(workspaces).where(equals(workspaces.id, "webhooks-deletion-org"))).length === 1;
        queued.push({ endpointId: data.endpointId, url: data.url, event: data.event, workspace: kept ? "kept" : "gone" });
      },
    },
  };
});

const OWNER = "test-user-1"; // the person the mocked guard signs in
const ORG = "webhooks-deletion-org";

beforeEach(async () => {
  queued.length = 0;
  await testDb.delete(auditLog);
  await testDb.delete(webhookEndpoint);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(OWNER);
  await seedOrg(ORG, { name: "Northwind" });
  await seedOrgMember(OWNER, ORG, "owner");
  await testDb.insert(webhookEndpoint).values([
    { id: "listens", orgId: ORG, url: "https://hooks.example.com/workspace", secret: "secret-1", events: ["organization.deleted"] },
    { id: "listens-to-all", orgId: ORG, url: "https://hooks.example.com/all", secret: "secret-2", events: ["**"] },
    { id: "deaf", orgId: ORG, url: "https://hooks.example.com/projects", secret: "secret-3", events: ["project.created"] },
  ]);
});

describe("deleting a workspace that has webhooks", () => {
  it("queues organization.deleted for each endpoint that listens, while the workspace and its endpoints exist", async () => {
    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });

    expect(queued.sort((a, b) => a.endpointId.localeCompare(b.endpointId))).toEqual([
      { endpointId: "listens", url: "https://hooks.example.com/workspace", event: "organization.deleted", workspace: "kept" },
      { endpointId: "listens-to-all", url: "https://hooks.example.com/all", event: "organization.deleted", workspace: "kept" },
    ]);
    // The endpoints went with the workspace, once the deliveries were queued
    expect(await testDb.select().from(webhookEndpoint).where(eq(webhookEndpoint.orgId, ORG))).toEqual([]);
  });
});
