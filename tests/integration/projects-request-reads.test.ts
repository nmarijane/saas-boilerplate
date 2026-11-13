import { beforeEach, describe, expect, it, vi } from "vitest";
import { countProjects } from "@/features/projects/queries";
import { projectsShell } from "@/features/projects/shell";
import { organization, project, user } from "@/models";
import { requestCache } from "../helpers/request-cache";
import { seedOrg, seedProject, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * The projects of a workspace are counted by the quota card, the first step and
 * the pager of the list, in one render: a request counts them once, for each
 * workspace, and the next request counts again. React's `cache` shares the
 * answer (`tests/helpers/request-cache.ts` stands for it).
 */

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (await import("../helpers/request-cache")).requestCache.cache,
}));

const ORG_A = "prr-org-a";
const ORG_B = "prr-org-b";
const PERSON = "prr-person";

const [quota] = projectsShell.quotas ?? [];
const [firstProject] = projectsShell.tasks ?? [];
const scope = (orgId: string) => ({ orgId, userId: PERSON, role: "owner" as const });

async function statementsOf(call: () => Promise<unknown>): Promise<number> {
  const query = vi.spyOn(testDb.$client, "query");
  query.mockClear();
  await call();
  const count = query.mock.calls.length;
  query.mockRestore();

  return count;
}

beforeEach(async () => {
  requestCache.endRequest();
  await testDb.delete(project);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(PERSON);
  await seedOrg(ORG_A, { slug: "prr-a" });
  await seedOrg(ORG_B, { slug: "prr-b" });
  await seedProject(ORG_A, { id: "prr-p1", createdBy: PERSON });
});

describe("the projects of a workspace in a request", () => {
  it("are counted once for the quota card, the first step and the pager", async () => {
    const statements = await statementsOf(async () => {
      await quota?.usage(scope(ORG_A));
      await firstProject?.isDone(scope(ORG_A));
      await countProjects(ORG_A);
    });

    expect(statements).toBe(1);
  });

  it("are counted for each workspace on its own", async () => {
    expect(await countProjects(ORG_A)).toBe(1);
    expect(await countProjects(ORG_B)).toBe(0);
  });

  it("are counted again by the next request, and so a change is seen", async () => {
    expect(await countProjects(ORG_A)).toBe(1);
    await seedProject(ORG_A, { id: "prr-p2", createdBy: PERSON });
    expect(await countProjects(ORG_A)).toBe(1);

    requestCache.endRequest();

    expect(await countProjects(ORG_A)).toBe(2);
  });
});
