import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "@/features/auth/guards";
import { organizationShell } from "@/features/auth/organization/shell";
import { organization, organizationMember, user } from "@/models";
import { requestCache } from "../helpers/request-cache";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * What a request reads, it reads once. The session is asked by the guard of the
 * page, the layout of the shell and the workspace context; the members are
 * counted by the quota card and by the first step. React's `cache` shares one
 * answer between them for the length of the request (`tests/helpers/request-cache.ts`
 * stands for it), and the next request reads again.
 */

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (await import("../helpers/request-cache")).requestCache.cache,
}));
vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", () => ({ auth: { api: { getSession } } }));

const ORG_A = "rr-org-a";
const ORG_B = "rr-org-b";
const PERSON = "rr-person";

const [members] = organizationShell.quotas ?? [];
const [inviteStep] = organizationShell.tasks ?? [];

/** The statements the database gets while a call runs. */
async function statementsOf(call: () => Promise<unknown>): Promise<number> {
  const query = vi.spyOn(testDb.$client, "query");
  query.mockClear();
  await call();
  const count = query.mock.calls.length;
  query.mockRestore();

  return count;
}

beforeEach(async () => {
  vi.clearAllMocks();
  requestCache.endRequest();
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(PERSON);
  await seedOrg(ORG_A, { slug: "rr-a" });
  await seedOrg(ORG_B, { slug: "rr-b" });
  await seedOrgMember(PERSON, ORG_A, "owner");
  getSession.mockResolvedValue(fakeSession(PERSON));
});

describe("the session of a request", () => {
  it("is read once for the three callers that ask for it", async () => {
    await Promise.all([getServerSession(), getServerSession()]);
    await getServerSession();

    expect(getSession).toHaveBeenCalledOnce();
  });

  it("is read again by the next request", async () => {
    await getServerSession();
    requestCache.endRequest();
    await getServerSession();

    expect(getSession).toHaveBeenCalledTimes(2);
  });
});

describe("the members of a workspace in a request", () => {
  const scope = (orgId: string) => ({ orgId, userId: PERSON, role: "owner" as const });

  it("are counted once for the quota card and the invite step", async () => {
    const statements = await statementsOf(async () => {
      await members?.usage(scope(ORG_A));
      await inviteStep?.isDone(scope(ORG_A));
      await members?.usage(scope(ORG_A));
    });

    expect(statements).toBe(1);
  });

  it("are counted for each workspace on its own", async () => {
    await seedUser("rr-second");
    await seedOrgMember("rr-second", ORG_B, "owner");

    expect(await members?.usage(scope(ORG_A))).toBe(1);
    expect(await members?.usage(scope(ORG_B))).toBe(1);
    expect(await statementsOf(() => members?.usage(scope(ORG_B)) ?? Promise.resolve())).toBe(0);
  });

  it("are counted again by the next request, and so a change is seen", async () => {
    expect(await members?.usage(scope(ORG_A))).toBe(1);
    await seedUser("rr-joiner");
    await seedOrgMember("rr-joiner", ORG_A, "member");
    // Same request: the answer it already holds
    expect(await members?.usage(scope(ORG_A))).toBe(1);

    requestCache.endRequest();

    expect(await members?.usage(scope(ORG_A))).toBe(2);
  });
});
