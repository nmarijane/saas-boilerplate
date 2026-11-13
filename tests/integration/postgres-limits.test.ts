import { beforeEach, expect, it, vi } from "vitest";
import { createProject } from "@/features/projects/actions";
import { organization, organizationMember, plan, project, subscription, user } from "@/models";
import { describeOnPostgres } from "../helpers/postgres";
import { seedOrg, seedOrgMember, seedProject, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * The limits of the plan, on a real PostgreSQL, where two creations can truly arrive at once: the row of the
 * workspace is locked while the limit is counted and the project is written, so the second creation counts the
 * first. (PGlite has one connection: plan-limits.test.ts says the same there, one after the other.)
 */

vi.mock("@/features/registry", async () => {
  const { getWorkspacePlans } = await import("@/features/billing/queries");
  const { countProjectsFresh } = await import("@/features/projects/queries");

  return {
    FEATURES: [
      { id: "billing", plans: getWorkspacePlans },
      { id: "projects", limits: [{ limitKey: "projects", used: countProjectsFresh }] },
    ],
  };
});

const ORG = "pg-limits-org";
const USER = "test-user-1";

beforeEach(async () => {
  await testDb.delete(project);
  await testDb.delete(subscription);
  await testDb.delete(plan);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(USER);
  await seedOrg(ORG);
  await seedOrgMember(USER, ORG, "owner");
});

describeOnPostgres("the projects limit", () => {
  it("lets one of ten simultaneous creations take the last place of the free plan", async () => {
    await seedProject(ORG);
    await seedProject(ORG);

    const answers = await Promise.all(Array.from({ length: 10 }, (_, index) => createProject({ organizationId: ORG, name: `p${index}`, description: "" })));

    expect(answers.filter((answer) => answer.success)).toHaveLength(1);
    expect(answers.filter((answer) => !answer.success && answer.error === "limit_reached")).toHaveLength(9);
    expect(await testDb.select().from(project)).toHaveLength(3);
  });
});

describeOnPostgres("the subscription of a workspace", () => {
  it("is one row, however many deliveries of the same subscription are written at once", async () => {
    const { applySubscription } = await import("@/features/billing/subscription");
    const stripeSubscription = {
      id: "sub_race",
      status: "active",
      customer: "cus_race",
      cancel_at_period_end: false,
      trial_end: null,
      metadata: { orgId: ORG, planId: "pro" },
      items: { data: [{ id: "si_1", price: { id: "price_unknown", recurring: { interval: "month" } }, current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
    } as never;

    await Promise.all(Array.from({ length: 8 }, () => applySubscription(stripeSubscription)));

    expect(await testDb.select().from(subscription)).toHaveLength(1);
  });
});

describeOnPostgres("the free workspaces of one person", () => {
  beforeEach(async () => {
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
  });

  async function owns(id: string, createdAt: Date) {
    await seedOrg(id, { createdAt });
    await seedOrgMember(USER, id, "owner");
  }

  it("leaves one when they are all settled at once, whatever the order they were written in", async () => {
    const { settleFreeWorkspaces } = await import("@/features/plan-limits");
    const ids = Array.from({ length: 8 }, (_, index) => `free-${index}`);
    for (const [index, id] of ids.entries()) {
      await owns(id, new Date(Date.now() - index * 1000));
    }

    const answers = await Promise.allSettled(ids.map((id) => settleFreeWorkspaces(USER, id)));

    expect(await testDb.select().from(organization)).toHaveLength(1);
    expect(answers.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  });

  // A creation that looks first, and settles before the other is written, must not make room for it: the one written last goes,
  // even when its clock reads earlier
  it("removes the workspace that is over the cap, not the one that the dates rank last", async () => {
    const { settleFreeWorkspaces } = await import("@/features/plan-limits");
    await owns("later-date", new Date(Date.now() + 5000));
    await settleFreeWorkspaces(USER, "later-date");
    await owns("earlier-date", new Date(Date.now() - 5000));

    await expect(settleFreeWorkspaces(USER, "earlier-date")).rejects.toMatchObject({ code: "limit_reached", limit: { key: "workspaces" } });

    expect((await testDb.select().from(organization)).map(({ id }) => id)).toEqual(["later-date"]);
  });
});
