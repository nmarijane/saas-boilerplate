import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "@/features/projects/actions";
import { invitation, organization, organizationMember, plan, project, subscription, upload } from "@/models";
import { seedOrg, seedOrgMember, seedProject, seedSubscription, seedUpload, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * The limits of the plan, enforced on the server: an action that creates
 * something is refused with a typed `limit_reached` error, whatever the page
 * showed, and what a workspace holds above a limit after a downgrade stays where
 * it is. The registry is replaced by the features whose limits are read here.
 */

vi.mock("@/features/registry", async () => {
  const { getWorkspacePlans } = await import("@/features/billing/queries");
  const { countProjectsFresh } = await import("@/features/projects/queries");
  const { countSeats } = await import("@/features/auth/organization/queries");
  const { getStorageUsedMb } = await import("@/features/upload/queries");

  return {
    FEATURES: [
      { id: "billing", plans: getWorkspacePlans },
      { id: "projects", limits: [{ limitKey: "projects", used: countProjectsFresh }] },
      { id: "organization", limits: [{ limitKey: "members", used: countSeats }] },
      { id: "upload", limits: [{ limitKey: "storage", used: getStorageUsedMb }] },
    ],
  };
});

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/upload/storage/adapter", () => ({
  getStorageAdapter: vi.fn().mockResolvedValue({
    put: (...args: unknown[]) => mockPut(...args),
    get: vi.fn(),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
}));

const ORG = "limits-org";
const USER = "test-user-1";

async function setPlan(planId: "free" | "pro" | "enterprise") {
  await testDb.delete(subscription);
  if (planId !== "free") {
    await seedSubscription(ORG, { planId });
  }
}

const newProject = (name: string) => createProject({ organizationId: ORG, name, description: "" });

beforeEach(async () => {
  vi.clearAllMocks();
  await testDb.delete(upload);
  await testDb.delete(project);
  await testDb.delete(invitation);
  await testDb.delete(subscription);
  await testDb.delete(plan);
  await testDb.delete(organization);
  await seedUser(USER);
  await seedOrg(ORG);
  await seedOrgMember(USER, ORG, "owner");
  for (const id of ["free", "pro", "enterprise"]) {
    await testDb.insert(plan).values({ id, name: id, price: 0 }).onConflictDoNothing();
  }
});

describe("projects", () => {
  it("are refused past the limit of the free plan, with the typed error and what it says", async () => {
    for (const name of ["a", "b", "c"]) {
      expect(await newProject(name)).toMatchObject({ success: true });
    }

    const refused = await newProject("d");

    expect(refused).toMatchObject({
      success: false,
      error: "limit_reached",
      limit: { key: "projects", limit: 3, used: 3, planId: "free", planName: "Free", includedIn: "Pro", upgradeHref: "/settings/billing" },
    });
    expect(await testDb.select().from(project)).toHaveLength(3);
  });

  it("are allowed up to the limit of the plan that was bought, and always on an unlimited one", async () => {
    await setPlan("pro");
    for (let index = 0; index < 4; index++) {
      await seedProject(ORG);
    }
    expect(await newProject("fifth")).toMatchObject({ success: true });

    await setPlan("enterprise");
    for (let index = 0; index < 60; index++) {
      await seedProject(ORG);
    }
    expect(await newProject("many")).toMatchObject({ success: true });
  });

  it("are counted one after the other when two are created at once: the last one that fits is the last one allowed", async () => {
    await seedProject(ORG);
    await seedProject(ORG);

    const answers = await Promise.all([newProject("one"), newProject("two"), newProject("three")]);

    expect(answers.filter((answer) => answer.success)).toHaveLength(1);
    expect(answers.filter((answer) => !answer.success && answer.error === "limit_reached")).toHaveLength(2);
    expect(await testDb.select().from(project)).toHaveLength(3);
  });

  it("that a workspace holds above the limit after a downgrade stay, and nothing more can be added", async () => {
    await setPlan("pro");
    for (let index = 0; index < 5; index++) {
      await seedProject(ORG);
    }
    await setPlan("free");

    expect(await newProject("more")).toMatchObject({ success: false, error: "limit_reached", limit: { used: 5, limit: 3 } });
    expect(await testDb.select().from(project)).toHaveLength(5);

    // Back under the limit, creating works again
    const [first, second, third] = await testDb.select().from(project);
    await testDb.delete(project).where(eq(project.id, first!.id));
    await testDb.delete(project).where(eq(project.id, second!.id));
    await testDb.delete(project).where(eq(project.id, third!.id));
    expect(await newProject("again")).toMatchObject({ success: true });
  });
});

describe("members", () => {
  it("count the invitations that wait: a seat is held by the person invited", async () => {
    const { assertWithinPlan } = await import("@/features/plan-limits");
    await setPlan("pro");

    await expect(assertWithinPlan(ORG, "members")).resolves.toBeUndefined();

    for (let index = 0; index < 9; index++) {
      await testDb.insert(invitation).values({ id: `inv-${index}`, organizationId: ORG, email: `p${index}@test.com`, status: "pending", expiresAt: new Date(Date.now() + 86_400_000), inviterId: USER });
    }
    await expect(assertWithinPlan(ORG, "members")).rejects.toMatchObject({ code: "limit_reached", limit: { key: "members", limit: 10, used: 10 } });
  });

  it("do not count an invitation that expired, or was answered", async () => {
    const { assertWithinPlan } = await import("@/features/plan-limits");
    await setPlan("pro");
    for (let index = 0; index < 9; index++) {
      await testDb.insert(invitation).values({ id: `old-${index}`, organizationId: ORG, email: `o${index}@test.com`, status: index % 2 ? "accepted" : "pending", expiresAt: new Date(index % 2 ? Date.now() + 86_400_000 : Date.now() - 1000), inviterId: USER });
    }

    await expect(assertWithinPlan(ORG, "members")).resolves.toBeUndefined();
  });

  it("are counted without the invitation that is being accepted, which holds its seat already", async () => {
    const { assertWithinPlan } = await import("@/features/plan-limits");
    // Free: one member, the owner. A person invited before a downgrade cannot join now
    await expect(assertWithinPlan(ORG, "members", 1, async () => 1)).rejects.toMatchObject({ code: "limit_reached" });
    await setPlan("pro");
    await expect(assertWithinPlan(ORG, "members", 1, async () => 1)).resolves.toBeUndefined();
  });
});

describe("storage", () => {
  const send = async (megabytes: number) => {
    const { uploadFile } = await import("@/features/upload/service");
    const formData = new FormData();
    formData.set("file", new File([new Uint8Array(megabytes * 1_000_000)], "big.png", { type: "image/png" }));
    formData.set("userId", USER);
    formData.set("orgId", ORG);

    return uploadFile(formData);
  };

  it("refuses a file that does not fit what the plan has left, before it is stored", async () => {
    await seedUpload(USER, { organizationId: ORG, size: 99_000_000 });

    const result = await send(2);

    expect(result).toEqual({ error: { code: "PLAN_LIMIT", values: { limit: 100, plan: "Free" } } });
    expect(mockPut).not.toHaveBeenCalled();
    expect(await testDb.select().from(upload)).toHaveLength(1);
  });

  it("takes a file that fits, and the one that leaves the workspace exactly at the limit", async () => {
    await seedUpload(USER, { organizationId: ORG, size: 98_000_000 });

    expect(await send(2)).toHaveProperty("id");
    expect(await send(1)).toHaveProperty("error");
  });
});

describe("free workspaces", () => {
  it("are limited per person: one free workspace each by default, a paid one does not count", async () => {
    const { assertFreeWorkspaceRoom } = await import("@/features/plan-limits");

    await expect(assertFreeWorkspaceRoom(USER)).rejects.toMatchObject({ code: "limit_reached", limit: { key: "workspaces", limit: 1, used: 1, includedIn: "Pro" } });

    await setPlan("pro");
    await expect(assertFreeWorkspaceRoom(USER)).resolves.toBeUndefined();
  });

  it("do not count the workspaces someone only joined", async () => {
    const { assertFreeWorkspaceRoom } = await import("@/features/plan-limits");
    await testDb.delete(organization);
    await seedOrg("someone-elses");
    await seedOrgMember(USER, "someone-elses", "member");

    await expect(assertFreeWorkspaceRoom(USER)).resolves.toBeUndefined();
  });
});

// Better Auth writes the workspace on its own connection, so the cap is settled after the write: whatever the order
// the creations came in, the same ones survive, and the others go
describe("free workspaces created at the same time", () => {
  async function ownsFree(ids: string[]) {
    for (const [index, id] of ids.entries()) {
      await seedOrg(id, { createdAt: new Date(Date.now() + index * 1000) });
      await seedOrgMember(USER, id, "owner");
    }
  }

  it("keep the oldest, and delete the one that is over the cap, saying why", async () => {
    const { settleFreeWorkspaces } = await import("@/features/plan-limits");
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
    await ownsFree(["w-1", "w-2", "w-3"]);

    await expect(settleFreeWorkspaces(USER, "w-3")).rejects.toMatchObject({ code: "limit_reached", limit: { key: "workspaces" } });
    await expect(settleFreeWorkspaces(USER, "w-2")).rejects.toMatchObject({ code: "limit_reached" });
    await expect(settleFreeWorkspaces(USER, "w-1")).resolves.toBeUndefined();

    expect((await testDb.select().from(organization)).map(({ id }) => id)).toEqual(["w-1"]);
  });

  it("leave a workspace alone that has paid", async () => {
    const { settleFreeWorkspaces } = await import("@/features/plan-limits");
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
    await ownsFree(["w-1", "w-2"]);
    await seedSubscription("w-1", { planId: "pro" });

    await expect(settleFreeWorkspaces(USER, "w-2")).resolves.toBeUndefined();
    expect(await testDb.select().from(organization)).toHaveLength(2);
  });
});

describe("the way to a bigger plan, for who may take it", () => {
  it("is given to an owner and an admin, and not to a member, who is told to ask", async () => {
    const { getLimitStatus, assertWithinPlan } = await import("@/features/plan-limits");
    for (let index = 0; index < 3; index++) {
      await seedProject(ORG);
    }

    expect((await getLimitStatus(ORG, "projects")).upgradeHref).toBe("/settings/billing");
    await testDb.update(organizationMember).set({ role: "member" }).where(eq(organizationMember.userId, USER));

    expect((await getLimitStatus(ORG, "projects")).upgradeHref).toBeNull();
    await expect(assertWithinPlan(ORG, "projects")).rejects.toMatchObject({ limit: { upgradeHref: null, includedIn: "Pro" } });
    expect(await newProject("d")).toMatchObject({ success: false, limit: { upgradeHref: null } });
  });
});

describe("the status of a limit, for a page that locks a button", () => {
  it("says it is reached, which plan includes more, and where to go", async () => {
    const { getLimitStatus } = await import("@/features/plan-limits");

    expect(await getLimitStatus(ORG, "members")).toEqual({ reached: true, limit: 1, used: 1, planName: "Free", includedIn: "Pro", upgradeHref: "/settings/billing" });

    await setPlan("enterprise");
    expect(await getLimitStatus(ORG, "members")).toMatchObject({ reached: false, limit: -1 });
  });
});
