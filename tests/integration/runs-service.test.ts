import { beforeEach, describe, expect, it, vi  } from "vitest";
import { requireOrgRole } from "@/features/auth/guards";
import { createRun, transitionRun } from "@/features/runs/service";
import { aiRuns, aiTools } from "@/models";
import { seedOrg, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const ORG = "run-org-1";
const USER = "run-user-1";

describe("run service", () => {
  beforeEach(async () => {
    await testDb.delete(aiRuns);
    await testDb.delete(aiTools);
    await seedUser(USER);
    await seedOrg(ORG);
    vi.mocked(requireOrgRole).mockResolvedValue({
      session: { user: { id: USER } },
      member: { role: "member" },
    } as never);
    await testDb.insert(aiTools).values({
      id: "tool-1",
      slug: "fixture",
      name: "Fixture",
      type: "form",
      status: "published",
    });
  });

  it("is idempotent per key", async () => {
    const args = { orgId: ORG, toolId: "tool-1", input: {}, idempotencyKey: "k1" };
    const a = await createRun(args);
    const b = await createRun(args);
    expect(b.id).toBe(a.id);
  });

  it("rejects unpublished tools", async () => {
    await testDb.insert(aiTools).values({
      id: "tool-2",
      slug: "draft",
      name: "Draft",
      type: "form",
    });
    await expect(
      createRun({ orgId: ORG, toolId: "tool-2", input: {}, idempotencyKey: "k2" }),
    ).rejects.toThrow("not available");
  });

  it("enforces the state machine", async () => {
    const run = await createRun({ orgId: ORG, toolId: "tool-1", input: {}, idempotencyKey: "k3" });
    await expect(transitionRun(run.id, "succeeded")).rejects.toThrow("Invalid");
    await transitionRun(run.id, "running");
    const done = await transitionRun(run.id, "succeeded", { result: { ok: true } });
    expect(done.result).toEqual({ ok: true });
    await expect(transitionRun(run.id, "failed")).rejects.toThrow("Invalid");
  });
});
