import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { transferOwnership } from "@/features/auth/organization/actions";
import { emitEvent } from "@/features/events/emitter";
import { organization, organizationMember, user } from "@/models";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * Handing a workspace over, called the way an attacker would: directly, with the real guards (only the session
 * lookup is replaced). The owner only, to a member of this workspace, in one transaction.
 */

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("next-intl/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl/server")>()),
  getLocale: async () => "en",
}));
vi.mock("@/features/auth/auth", () => ({ auth: { api: { getSession } } }));

const ORG = "handover-org";
const OTHER_ORG = "handover-other-org";
const OWNER = "handover-owner";
const ADMIN = "handover-admin";
const MEMBER = "handover-member";
const OUTSIDER = "handover-outsider"; // owns the other workspace

const roles = async () =>
  Object.fromEntries((await testDb.select().from(organizationMember).where(eq(organizationMember.organizationId, ORG))).map((row) => [row.userId, row.role]));

beforeEach(async () => {
  vi.clearAllMocks();
  await testDb.execute(sql`drop trigger if exists refuse_admin on organization_member`);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  for (const id of [OWNER, ADMIN, MEMBER, OUTSIDER]) {
    await seedUser(id);
  }
  await seedOrg(ORG);
  await seedOrg(OTHER_ORG);
  await seedOrgMember(OWNER, ORG, "owner");
  await seedOrgMember(ADMIN, ORG, "admin");
  await seedOrgMember(MEMBER, ORG, "member");
  await seedOrgMember(OUTSIDER, OTHER_ORG, "owner");
  getSession.mockResolvedValue(fakeSession(OWNER));
});

const memberId = (userId: string, orgId = ORG) => `member-${userId}-${orgId}`;

describe("handing a workspace over", () => {
  it("makes the member the owner and the owner an admin, together", async () => {
    await expect(transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) })).resolves.toEqual({ success: true, data: undefined });

    expect(await roles()).toEqual({ [OWNER]: "admin", [ADMIN]: "admin", [MEMBER]: "owner" });
  });

  it("works for an admin as well, and leaves exactly one owner", async () => {
    await transferOwnership({ orgId: ORG, memberId: memberId(ADMIN) });

    const after = Object.values(await roles());
    expect(after.filter((role) => role === "owner")).toHaveLength(1);
    expect((await roles())[ADMIN]).toBe("owner");
  });

  it("tells the event bus, with the new owner's membership and who handed it over", async () => {
    await transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) });

    expect(emitEvent).toHaveBeenCalledWith(
      "member.role_changed",
      expect.objectContaining({ orgId: ORG, actorId: OWNER, resourceType: "organization_member", resourceId: memberId(MEMBER), metadata: expect.objectContaining({ role: "owner", handedOverBy: OWNER }) }),
    );
  });

  // The guard is `requireRole(orgId, "owner")`
  it.each([
    ["an admin", ADMIN],
    ["a member", MEMBER],
    ["the owner of another workspace", OUTSIDER],
  ])("is refused to %s, and nothing changes", async (_, who) => {
    getSession.mockResolvedValue(fakeSession(who));
    const before = await roles();

    await expect(transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) })).rejects.toThrow();

    expect(await roles()).toEqual(before);
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it("is refused to somebody who is not signed in", async () => {
    getSession.mockResolvedValue(null);

    await expect(transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) })).rejects.toThrow();
    expect(await roles()).toEqual({ [OWNER]: "owner", [ADMIN]: "admin", [MEMBER]: "member" });
  });

  it.each([
    ["a member of another workspace", () => memberId(OUTSIDER, OTHER_ORG)],
    ["a membership that does not exist", () => "no-such-membership"],
    ["the owner's own membership", () => memberId(OWNER)],
  ])("cannot be made to choose %s", async (_, choose) => {
    const answer = await transferOwnership({ orgId: ORG, memberId: choose() });

    expect(answer.success).toBe(false);
    expect(await roles()).toEqual({ [OWNER]: "owner", [ADMIN]: "admin", [MEMBER]: "member" });
    expect((await testDb.select().from(organizationMember).where(eq(organizationMember.organizationId, OTHER_ORG)))[0]?.role).toBe("owner");
  });

  it("makes no second owner when it is asked twice by the one who is no longer the owner", async () => {
    await transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) });

    // The session still says the first owner: the guard reads the role again, and it is admin now
    await expect(transferOwnership({ orgId: ORG, memberId: memberId(ADMIN) })).rejects.toThrow();

    expect(await roles()).toEqual({ [OWNER]: "admin", [ADMIN]: "admin", [MEMBER]: "owner" });
  });

  // One transaction: the member is made owner first, and the owner's own demotion is what fails here
  it("leaves both roles as they were when the second change fails", async () => {
    await testDb.execute(sql`
      create or replace function refuse_admin() returns trigger as $$ begin
        if new.role = 'admin' and old.role = 'owner' then raise exception 'refused'; end if;
        return new;
      end $$ language plpgsql
    `);
    await testDb.execute(sql`create trigger refuse_admin before update on organization_member for each row execute function refuse_admin()`);

    try {
      const answer = await transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) });

      expect(answer.success).toBe(false);
      expect(await roles()).toEqual({ [OWNER]: "owner", [ADMIN]: "admin", [MEMBER]: "member" });
      expect(emitEvent).not.toHaveBeenCalled();
    } finally {
      await testDb.execute(sql`drop trigger if exists refuse_admin on organization_member`);
    }
  });
});
