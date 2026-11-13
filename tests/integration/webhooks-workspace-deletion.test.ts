import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOrganization } from "@/features/auth/organization/actions";
import { auditLog, organization, organizationMember, user, webhookEndpoint } from "@/models";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What the webhooks of a workspace are told when it is deleted: the event bus is
 * the real one. `organization.deleted` is delivered at once, to each endpoint that
 * listens for it, before the rows go: a job waiting in a queue would find its
 * endpoint gone (the delivery reads the endpoint's row when it runs, so that no
 * secret waits in the queue). The network is replaced below the checks: the name
 * resolves to a public address, and the connection records what it was asked to
 * send, and whether the workspace still existed at that moment. No feature holds
 * anything for the workspace here (the registry is empty).
 */

interface Sent {
  url: string;
  event: string | undefined;
  body: string;
  signature: string | undefined;
  timeoutMs: number;
  workspace: "kept" | "gone";
}
const { sent, queue, behaviour } = vi.hoisted(() => ({
  sent: [] as Sent[],
  queue: [] as unknown[],
  behaviour: { answer: async (): Promise<{ status: number; body: string }> => ({ status: 200, body: "ok" }) },
}));
vi.mock("@/features/registry", () => ({ FEATURES: [] }));
vi.mock("@/features/events/emitter", async (importOriginal) => importOriginal());
vi.mock("@/shared/lib/inngest/client", () => ({
  inngest: { send: async (message: unknown) => void queue.push(message) },
}));
vi.mock("@/features/webhooks/outbound", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/webhooks/outbound")>();
  const { testDb: db } = await import("../setup");
  const { organization: workspaces } = await import("@/models");
  const { eq: equals } = await import("drizzle-orm");

  return {
    ...original,
    postJson: (address: string, request: { headers: Record<string, string>; body: string }, options: object) =>
      original.postJson(address, request, {
        ...options,
        development: false,
        resolver: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async ({ url, headers, body, timeoutMs }) => {
          const kept = (await db.select().from(workspaces).where(equals(workspaces.id, "webhooks-deletion-org"))).length === 1;
          sent.push({ url: url.href, event: headers["X-Webhook-Event"], body, signature: headers["X-Webhook-Signature"], timeoutMs, workspace: kept ? "kept" : "gone" });
          return behaviour.answer();
        },
      }),
  };
});

const OWNER = "test-user-1"; // the person the mocked guard signs in
const ORG = "webhooks-deletion-org";

beforeEach(async () => {
  sent.length = 0;
  queue.length = 0;
  behaviour.answer = async () => ({ status: 200, body: "ok" });
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
    { id: "off", orgId: ORG, url: "https://hooks.example.com/off", secret: "secret-4", events: ["**"], active: false },
  ]);
});

describe("deleting a workspace that has webhooks", () => {
  it("delivers organization.deleted, signed, to each active endpoint that listens, while the workspace and its endpoints exist", async () => {
    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });

    expect(sent.map(({ url, event, workspace }) => ({ url, event, workspace })).sort((a, b) => a.url.localeCompare(b.url))).toEqual([
      { url: "https://hooks.example.com/all", event: "organization.deleted", workspace: "kept" },
      { url: "https://hooks.example.com/workspace", event: "organization.deleted", workspace: "kept" },
    ]);
    // Each is signed with the secret of its own endpoint
    const secrets: Record<string, string> = { "https://hooks.example.com/workspace": "secret-1", "https://hooks.example.com/all": "secret-2" };
    for (const delivery of sent) {
      expect(delivery.signature).toBe(createHmac("sha256", secrets[delivery.url] ?? "").update(delivery.body).digest("hex"));
      expect(JSON.parse(delivery.body)).toMatchObject({ event: "organization.deleted", data: { orgId: ORG } });
    }
    // The endpoints went with the workspace, once the deliveries were made
    expect(await testDb.select().from(webhookEndpoint).where(eq(webhookEndpoint.orgId, ORG))).toEqual([]);
  });

  // A queue holds the event: it is shown in the dashboard of the queue, and the secret has no business there
  it("queues nothing: no job waits with a secret for an endpoint that is about to go", async () => {
    await deleteOrganization({ orgId: ORG });

    expect(queue).toEqual([]);
  });

  it("gives a receiver a short time, and does not ask it twice", async () => {
    await deleteOrganization({ orgId: ORG });

    // The 5 seconds are a deadline for the whole call, so what the connection is left with is what remains of them
    for (const { timeoutMs } of sent) {
      expect(timeoutMs).toBeLessThanOrEqual(5000);
      expect(timeoutMs).toBeGreaterThan(4000);
    }
    expect(sent).toHaveLength(2);
    expect(new Set(sent.map(({ url }) => url)).size).toBe(sent.length);
  });

  it("deletes the workspace even when a receiver is down or refuses", async () => {
    behaviour.answer = async () => {
      throw new Error("connect ECONNREFUSED");
    };

    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });

    expect(sent).toHaveLength(2);
    expect(await testDb.select().from(organization).where(eq(organization.id, ORG))).toEqual([]);
  });
});
