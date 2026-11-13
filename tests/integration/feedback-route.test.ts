import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/feedback/route";
import { requireApiAuth } from "@/features/auth/api-auth";
import { requireAuth, requireRole } from "@/features/auth/guards";
import { feedback } from "@/models/feedback";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * The route that takes feedback from a client of the API. The workspace it names must be one of the person's,
 * as it must be for the read of the same route: the guard of the action redirects for any other, which a client
 * that is no page cannot follow. The guards of the actions are replaced by the setup of the tests, which grants
 * every role: a workspace that is refused here is refused by the route itself.
 */

vi.mock("@/features/auth/api-auth", () => ({ requireApiAuth: vi.fn() }));

const USER = "fbr-user-1";
const OWN_ORG = "fbr-own-org";
const OTHER_ORG = "fbr-other-org";

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3088/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const rows = () => testDb.select().from(feedback);

describe("the feedback route, when a client sends feedback", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const session = fakeSession(USER);
    vi.mocked(requireAuth).mockResolvedValue(session);
    vi.mocked(requireApiAuth).mockResolvedValue({ authenticated: true, session } as never);
    await testDb.delete(feedback);
    await seedUser(USER);
    await seedOrg(OWN_ORG);
    await seedOrg(OTHER_ORG);
    await seedOrgMember(USER, OWN_ORG, "member");
  });

  it("refuses a workspace that is not one of the person's with a 403 in JSON, and writes nothing", async () => {
    const response = await post({ type: "bug", message: "Broken", orgId: OTHER_ORG });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden", code: "FORBIDDEN", status: 403 });
    expect(await rows()).toHaveLength(0);
  });

  it("refuses it before the action is asked anything: the guard of the action is not reached", async () => {
    await post({ type: "bug", message: "Broken", orgId: OTHER_ORG });

    expect(requireRole).not.toHaveBeenCalled();
  });

  it("refuses a workspace that does not exist as it refuses one that is not the person's", async () => {
    const response = await post({ type: "bug", message: "Broken", orgId: "no-such-workspace" });

    expect(response.status).toBe(403);
    expect(await rows()).toHaveLength(0);
  });

  it("takes a workspace of the person's, and writes the feedback for it", async () => {
    const response = await post({ type: "feature", message: "Add dark mode", orgId: OWN_ORG });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: expect.any(String) });
    expect(await rows()).toMatchObject([{ userId: USER, organizationId: OWN_ORG, type: "feature", message: "Add dark mode" }]);
  });

  it("takes feedback that names no workspace at all", async () => {
    const response = await post({ type: "bug", message: "Broken" });

    expect(response.status).toBe(201);
    expect(await rows()).toMatchObject([{ userId: USER, organizationId: null }]);
  });

  it.each([
    ["a number", 42],
    ["an object", { id: OWN_ORG }],
    ["an empty text", ""],
  ])("answers 400, and writes nothing, for a workspace that is %s", async (_, orgId) => {
    const response = await post({ type: "bug", message: "Broken", orgId });

    expect(response.status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("asks for a session first: with none it answers 401 and reads nothing", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue({
      authenticated: false,
      response: NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED", status: 401 }, { status: 401 }),
    });

    const response = await post({ type: "bug", message: "Broken", orgId: OWN_ORG });

    expect(response.status).toBe(401);
    expect(await rows()).toHaveLength(0);
  });
});
