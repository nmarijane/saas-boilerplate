import type { FeatureShell } from "@/shared/shell/contract";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuditLogs, getWorkspaceActivity } from "@/features/audit/queries";
import { deleteOrganization } from "@/features/auth/organization/actions";
import { emitEvent } from "@/features/events/emitter";
import { auditLog, organization, organizationMember, user } from "@/models";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * Deleting a workspace, as the action orders it: the cleanups the features
 * declare (`onWorkspaceDelete`) run first, then `organization.deleted` is told
 * while the workspace is still there, then the rows go. The registry is
 * replaced by two features of this file, which record whether the workspace
 * still existed when they were asked: the cleanups of billing and upload are
 * tested in their own files (billing-workspace-deletion.test.ts,
 * upload-workspace-deletion.test.ts), which go with them, and so is what the
 * webhooks are told (webhooks-workspace-deletion.test.ts). The event bus is the
 * real one, watched. The guard is the mocked one (an owner); the real ones are
 * in server-action-guards.test.ts.
 */

const { features, bus } = vi.hoisted(() => ({
  features: { list: [] as FeatureShell[] },
  bus: { emit: null as null | ((...args: never[]) => Promise<void>) },
}));
vi.mock("@/features/registry", () => ({
  get FEATURES() {
    return features.list;
  },
}));
vi.mock("@/features/events/emitter", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/features/events/emitter")>();
  bus.emit = real.emitEvent as never;
  return { emitEvent: vi.fn(real.emitEvent) };
});

const OWNER = "test-user-1"; // the person the mocked guard signs in
const ORG = "deletion-org";

async function workspaceExists() {
  return (await testDb.select({ id: organization.id }).from(organization).where(eq(organization.id, ORG))).length === 1;
}

/** What happened, in order, and whether the workspace was still there each time. */
const steps: string[] = [];

async function record(step: string) {
  steps.push(`${step}:${(await workspaceExists()) ? "kept" : "gone"}`);
}

/** A feature that holds something for the workspace, and cleans it up. */
function holding(id: string, order: number, run: (orgId: string) => Promise<string | null> = async (orgId) => {
  await record(`${id}:${orgId}`);
  return `${id}.cleanedUp`;
}): FeatureShell {
  return { id, onWorkspaceDelete: { order, run, failureKey: `${id}.deleteWorkspaceFailed` } };
}

beforeEach(async () => {
  vi.clearAllMocks();
  steps.length = 0;
  features.list = [holding("files", 50), { id: "dashboard" }, holding("subscription", 10)];
  // The real bus, told after the step is recorded
  vi.mocked(emitEvent).mockImplementation(async (...args) => {
    await record(`event:${args[0]}`);
    await (bus.emit as typeof emitEvent)(...args);
  });

  await testDb.delete(auditLog);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(OWNER, { name: "Camille Laurent" });
  await seedOrg(ORG, { name: "Northwind" });
  await seedOrgMember(OWNER, ORG, "owner");
  // The workspace's own log, which goes with it
  await testDb.insert(auditLog).values({ id: "northwind-event", orgId: ORG, actorId: OWNER, action: "project.created", resourceType: "project", resourceId: "atlas" });
});

describe("deleting a workspace", () => {
  it("runs the cleanups of the features in their order, then tells, while the workspace is there, then deletes its rows", async () => {
    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });

    expect(steps).toEqual([`subscription:${ORG}:kept`, `files:${ORG}:kept`, "event:organization.deleted:kept"]);
    expect(await workspaceExists()).toBe(false);
    expect(await testDb.select().from(organizationMember)).toEqual([]);
  });

  it("tells who deleted which workspace, and waits for the webhooks to be queued while its endpoints exist", async () => {
    await deleteOrganization({ orgId: ORG });

    expect(emitEvent).toHaveBeenCalledExactlyOnceWith(
      "organization.deleted",
      { orgId: ORG, actorId: OWNER, resourceType: "organization", resourceId: ORG, metadata: { name: "Northwind" } },
      { awaitWebhooks: true },
    );
  });

  // The log of a workspace goes with it, as the zone promises; the entry that says
  // who deleted it is the platform's, and a platform admin reads it on the audit page
  it("keeps the deletion as an entry of the platform, once the workspace and its own log are gone", async () => {
    await deleteOrganization({ orgId: ORG });

    expect(await testDb.select().from(auditLog)).toEqual([
      expect.objectContaining({
        orgId: null,
        action: "organization.deleted",
        actorId: OWNER,
        resourceType: "organization",
        resourceId: ORG,
        metadata: { name: "Northwind" },
      }),
    ]);
    expect((await getAuditLogs()).map(({ action }) => action)).toEqual(["organization.deleted"]);
    // It is no workspace's: the home of none tells it
    expect(await getWorkspaceActivity(ORG)).toEqual([]);
  });

  it("keeps the workspace, tells nothing, and says why, when a cleanup fails: the ones after it do not run", async () => {
    features.list = [
      holding("subscription", 10, async () => {
        throw new Error("the provider did not answer");
      }),
      holding("files", 50),
    ];

    expect(await deleteOrganization({ orgId: ORG })).toEqual({
      success: true,
      data: { deleted: false, messageKey: "subscription.deleteWorkspaceFailed", done: [] },
    });

    expect(await workspaceExists()).toBe(true);
    expect(steps).toEqual([]);
    expect(emitEvent).not.toHaveBeenCalled();
    expect(await testDb.select().from(organizationMember)).toHaveLength(1);
    expect((await testDb.select({ id: auditLog.id }).from(auditLog))).toEqual([{ id: "northwind-event" }]);
  });

  it("tells what the cleanups before the one that failed already did", async () => {
    features.list = [
      holding("subscription", 10),
      holding("files", 50, async () => {
        throw new Error("the storage did not answer");
      }),
    ];

    expect(await deleteOrganization({ orgId: ORG })).toEqual({
      success: true,
      data: { deleted: false, messageKey: "files.deleteWorkspaceFailed", done: ["subscription.cleanedUp"] },
    });
    expect(await workspaceExists()).toBe(true);
  });

  it("deletes a workspace when no installed feature holds anything for it", async () => {
    features.list = [{ id: "dashboard" }];

    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });
    expect(await workspaceExists()).toBe(false);
  });

  // A feature that is removed takes its cleanup with it: its folder holds its
  // `shell.ts`, and the registry its line. The deletion itself names none.
  it("names no feature: the cleanups come from the registry", () => {
    const action = readFileSync(join(__dirname, "../../src/features/auth/organization/actions.ts"), "utf8");

    expect(action).not.toMatch(/@\/features\/(?!auth|email|events|plan-limits|registry)[\w-]+/);
  });
});
