import type { FeatureShell } from "@/shared/shell/contract";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/features/auth/auth";
import { requireAuth } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { deleteAccount, updateProfile } from "@/features/settings/actions";
import { invitation, organization, organizationMember } from "@/models/organization";
import { account, user  } from "@/models/user";
import { enforceActionRateLimit } from "@/shared/lib/rate-limit/action";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

const { features } = vi.hoisted(() => ({ features: { list: [] as FeatureShell[] } }));
vi.mock("@/features/registry", () => ({
  get FEATURES() {
    return features.list;
  },
}));
vi.mock("@/shared/lib/rate-limit/action", () => ({ enforceActionRateLimit: vi.fn(), getClientIp: vi.fn() }));

describe("updateProfile", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(user).where(eq(user.id, "test-user-1"));
    await seedUser("test-user-1", { name: "Original Name" });
  });

  it("updates user name", async () => {
    await updateProfile({ name: "New Name" });

    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("New Name");
  });

  it("updates user name and image", async () => {
    await updateProfile({ name: "With Image", image: "https://example.com/avatar.png" });

    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users[0].name).toBe("With Image");
    expect(users[0].image).toBe("https://example.com/avatar.png");
  });

  it("sets image to null when empty string", async () => {
    await updateProfile({ name: "No Image", image: "" });

    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users[0].image).toBeNull();
  });

  // The picture is fetched by the browser of everyone who sees the person: https only
  it.each(["http://example.com/me.png", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "https://user:pass@example.com/me.png", "//example.com/me.png", "me.png"])(
    "refuses the picture %s, and changes nothing",
    async (image) => {
      const result = await updateProfile({ name: "Renamed", image });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.validationErrors?.image).toBeDefined();
      }
      const [stored] = await testDb.select().from(user).where(eq(user.id, "test-user-1"));
      expect(stored?.name).toBe("Original Name");
      expect(stored?.image).toBeNull();
    },
  );

  it("rejects empty name", async () => {
    const result = await updateProfile({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validationErrors?.name).toBeDefined();
    }
  });

  it("rejects name exceeding max length", async () => {
    const result = await updateProfile({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validationErrors?.name).toBeDefined();
    }
  });
});

const PERSON = "test-user-1"; // the person the mocked guard signs in

/** Signs the person in with a session opened `minutesAgo` minutes ago. */
function signedInSince(minutesAgo: number) {
  const session = fakeSession(PERSON);
  session.session.createdAt = new Date(Date.now() - minutesAgo * 60_000);
  vi.mocked(requireAuth).mockResolvedValue(session);
}

async function givePassword(password: string) {
  const { password: hasher } = await auth.$context;
  await testDb.insert(account).values({
    id: `credential-${PERSON}`,
    accountId: PERSON,
    providerId: "credential",
    userId: PERSON,
    password: await hasher.hash(password),
  });
}

const personExists = async () => (await testDb.select().from(user).where(eq(user.id, PERSON))).length === 1;
const workspaceExists = async (id: string) => (await testDb.select().from(organization).where(eq(organization.id, id))).length === 1;

describe("deleteAccount", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    features.list = [];
    await testDb.execute(sql`drop trigger if exists refuse_user_delete on "user"`);
    await testDb.delete(account);
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
    await testDb.delete(user);
    await seedUser(PERSON, { name: "Delete Me" });
    // A session opened a minute ago: recent enough, unless a test says otherwise
    signedInSince(1);
  });

  it("deletes a person with no workspace and no password, who signed in a minute ago", async () => {
    await expect(deleteAccount()).resolves.toEqual({ success: true, data: { deleted: true } });

    expect(await personExists()).toBe(false);
  });

  describe("proving that it is them", () => {
    it("keeps the account of a person with no password whose session is not recent: signing in again is the proof", async () => {
      signedInSince(10);

      await expect(deleteAccount()).resolves.toEqual({ success: true, data: { deleted: false, reason: "recent-sign-in-required" } });

      expect(await personExists()).toBe(true);
    });

    it("keeps the account of a session with no date: it is not known to be recent", async () => {
      const session = fakeSession(PERSON);
      Reflect.deleteProperty(session.session, "createdAt");
      vi.mocked(requireAuth).mockResolvedValue(session);

      await expect(deleteAccount()).resolves.toMatchObject({ data: { deleted: false, reason: "recent-sign-in-required" } });
    });

    // A session is a cookie, and a cookie can be someone else's: a recent one is no proof when there is a password
    it.each([
      ["no password is given", undefined, "password-required"],
      ["the password is wrong", { password: "not-the-password" }, "wrong-password"],
    ] as const)("keeps the account of a person with a password when %s, however recent the session", async (_, input, reason) => {
      await givePassword("the-password");

      await expect(deleteAccount(input)).resolves.toEqual({ success: true, data: { deleted: false, reason } });

      expect(await personExists()).toBe(true);
    });

    it("deletes the account of a person with a password who gives it, even on an old session", async () => {
      await givePassword("the-password");
      signedInSince(600);

      await expect(deleteAccount({ password: "the-password" })).resolves.toEqual({ success: true, data: { deleted: true } });

      expect(await personExists()).toBe(false);
    });

    it("limits the attempts: a wrong password is a guess at it", async () => {
      await givePassword("the-password");
      vi.mocked(enforceActionRateLimit).mockRejectedValueOnce(new Error("Too many requests"));

      const answer = await deleteAccount({ password: "the-password" });

      expect(answer.success).toBe(false);
      expect(enforceActionRateLimit).toHaveBeenCalledWith(`delete-account:${PERSON}`, 5, 600);
      expect(await personExists()).toBe(true);
    });
  });

  describe("the workspaces the person owns", () => {
    it("deletes a workspace that they own alone, with them: cleanups first, the event told, the rows gone", async () => {
      const cleaned: string[] = [];
      features.list = [{ id: "files", onWorkspaceDelete: { order: 1, run: async (orgId: string) => { cleaned.push(orgId); return "files.cleanedUp"; }, failureKey: "files.failed" } }];
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");

      await expect(deleteAccount()).resolves.toEqual({ success: true, data: { deleted: true } });

      expect(cleaned).toEqual(["set-org-alone"]);
      expect(emitEvent).toHaveBeenCalledWith("organization.deleted", expect.objectContaining({ orgId: "set-org-alone", actorId: PERSON }), { awaitWebhooks: true });
      expect(await workspaceExists("set-org-alone")).toBe(false);
      expect(await personExists()).toBe(false);
    });

    // Someone else could take it over: it is not the person's to take away with them
    it("keeps everything while a workspace they own has other members, and says which", async () => {
      await seedUser("set-other-user", { email: "other@test.com" });
      await seedOrg("set-org-shared", { name: "Shared Studio" });
      await seedOrgMember(PERSON, "set-org-shared", "owner");
      await seedOrgMember("set-other-user", "set-org-shared", "admin");

      await expect(deleteAccount()).resolves.toEqual({
        success: true,
        data: { deleted: false, reason: "workspace-has-members", workspace: "Shared Studio" },
      });

      expect(await personExists()).toBe(true);
      expect(await workspaceExists("set-org-shared")).toBe(true);
      const members = await testDb.select().from(organizationMember).where(eq(organizationMember.organizationId, "set-org-shared"));
      expect(members.map(({ userId, role }) => `${userId}:${role}`).sort()).toEqual(["set-other-user:admin", `${PERSON}:owner`]);
    });

    it("touches nothing of a workspace they own alone while another one of theirs has members", async () => {
      const cleaned: string[] = [];
      features.list = [{ id: "files", onWorkspaceDelete: { order: 1, run: async (orgId: string) => { cleaned.push(orgId); return null; }, failureKey: "files.failed" } }];
      await seedUser("set-other-user", { email: "other@test.com" });
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");
      await seedOrg("set-org-shared");
      await seedOrgMember(PERSON, "set-org-shared", "owner");
      await seedOrgMember("set-other-user", "set-org-shared", "member");

      await deleteAccount();

      // Checked before anything is done: no subscription was cancelled, no file deleted, no event told
      expect(cleaned).toEqual([]);
      expect(emitEvent).not.toHaveBeenCalled();
      expect(await workspaceExists("set-org-alone")).toBe(true);
    });

    it("does not count the workspaces they only belong to", async () => {
      await seedUser("set-other-user", { email: "other@test.com" });
      await seedOrg("set-org-theirs");
      await seedOrgMember("set-other-user", "set-org-theirs", "owner");
      await seedOrgMember(PERSON, "set-org-theirs", "member");

      await expect(deleteAccount()).resolves.toEqual({ success: true, data: { deleted: true } });

      expect(await personExists()).toBe(false);
      expect(await workspaceExists("set-org-theirs")).toBe(true);
    });

    it("keeps the account, and the workspace, when a cleanup cannot do its part", async () => {
      features.list = [{ id: "billing", onWorkspaceDelete: { order: 1, run: async () => { throw new Error("Stripe is down"); }, failureKey: "billing.deleteWorkspaceFailed" } }];
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");

      await expect(deleteAccount()).resolves.toEqual({
        success: true,
        data: { deleted: false, reason: "workspace-kept", messageKey: "billing.deleteWorkspaceFailed" },
      });

      expect(await personExists()).toBe(true);
      expect(await workspaceExists("set-org-alone")).toBe(true);
    });

    // The cleanups and the deliveries take seconds: somebody may join in the meantime
    // The owner of another workspace hands it to the person while the cleanups run: they own it now, and are
    // the only one who could delete it, so nothing is deleted with them
    it("keeps the account when a workspace was handed to the person after the check", async () => {
      await seedUser("set-giver", { email: "giver@test.com" });
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");
      await seedOrg("set-org-given", { name: "Handed Over" });
      await seedOrgMember("set-giver", "set-org-given", "admin");
      const given = await seedOrgMember(PERSON, "set-org-given", "member");
      features.list = [
        {
          id: "slow",
          onWorkspaceDelete: {
            order: 1,
            run: async () => {
              await testDb.update(organizationMember).set({ role: "owner" }).where(eq(organizationMember.id, given.id));
              return null;
            },
            failureKey: "slow.failed",
          },
        },
      ];

      await expect(deleteAccount()).resolves.toEqual({
        success: true,
        data: { deleted: false, reason: "workspace-has-members", workspace: "Handed Over" },
      });

      expect(await personExists()).toBe(true);
      expect(await workspaceExists("set-org-given")).toBe(true);
      expect(emitEvent).not.toHaveBeenCalled();
    });

    // The doors are closed before anything is told: the events are true, and a pending invitation cannot be accepted after them
    it("tells nobody when somebody joined during the cleanups, and deletes the pending invitations before the first event", async () => {
      await seedUser("set-late-user", { email: "late@test.com" });
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");
      await testDb.insert(invitation).values({ id: "pending-1", organizationId: "set-org-alone", email: "x@test.com", role: "member", status: "pending", expiresAt: new Date(Date.now() + 86_400_000), inviterId: PERSON });
      features.list = [{ id: "slow", onWorkspaceDelete: { order: 1, run: async (orgId: string) => { await seedOrgMember("set-late-user", orgId, "member"); return null; }, failureKey: "slow.failed" } }];

      await deleteAccount();

      expect(emitEvent).not.toHaveBeenCalled();
      expect(await personExists()).toBe(true);
    });

    it("deletes the pending invitations of the workspaces it deletes, and only then tells the event", async () => {
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");
      await testDb.insert(invitation).values({ id: "pending-2", organizationId: "set-org-alone", email: "y@test.com", role: "member", status: "pending", expiresAt: new Date(Date.now() + 86_400_000), inviterId: PERSON });
      let invitationsWhenTold = -1;
      vi.mocked(emitEvent).mockImplementationOnce(async () => {
        invitationsWhenTold = (await testDb.select().from(invitation).where(eq(invitation.organizationId, "set-org-alone"))).length;
      });

      await expect(deleteAccount()).resolves.toEqual({ success: true, data: { deleted: true } });

      expect(invitationsWhenTold).toBe(0);
    });

    it("keeps everything when somebody joins a workspace between the check and the deletion", async () => {
      await seedUser("set-late-user", { email: "late@test.com" });
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");
      // The invitation is accepted while the cleanups run
      features.list = [{ id: "slow", onWorkspaceDelete: { order: 1, run: async (orgId: string) => { await seedOrgMember("set-late-user", orgId, "member"); return null; }, failureKey: "slow.failed" } }];

      await expect(deleteAccount()).resolves.toEqual({
        success: true,
        data: { deleted: false, reason: "workspace-has-members", workspace: "Test Org" },
      });

      expect(await personExists()).toBe(true);
      expect(await workspaceExists("set-org-alone")).toBe(true);
    });

    // Every cleanup first, the events last: a receiver is not told of a deletion that then does not happen
    it("runs every cleanup before it tells anyone, and tells no one when one of them fails", async () => {
      const ran: string[] = [];
      features.list = [
        {
          id: "billing",
          onWorkspaceDelete: {
            order: 1,
            run: async (orgId: string) => {
              ran.push(orgId);
              if (orgId === "set-org-two") {
                throw new Error("Stripe is down");
              }
              return null;
            },
            failureKey: "billing.deleteWorkspaceFailed",
          },
        },
      ];
      await seedOrg("set-org-one");
      await seedOrgMember(PERSON, "set-org-one", "owner");
      await seedOrg("set-org-two");
      await seedOrgMember(PERSON, "set-org-two", "owner");

      const answer = await deleteAccount();

      expect(answer).toMatchObject({ data: { deleted: false, reason: "workspace-kept" } });
      expect(ran.sort()).toEqual(["set-org-one", "set-org-two"]);
      expect(emitEvent).not.toHaveBeenCalled();
      expect(await workspaceExists("set-org-one")).toBe(true);
      expect(await personExists()).toBe(true);
    });

    // One transaction: the workspaces and the person go together or not at all
    it("deletes the workspaces and the person in one transaction: a failure leaves both", async () => {
      await seedOrg("set-org-alone");
      await seedOrgMember(PERSON, "set-org-alone", "owner");
      await testDb.execute(sql`
        create or replace function refuse_user_delete() returns trigger as $$ begin raise exception 'refused'; end $$ language plpgsql
      `);
      await testDb.execute(sql`create trigger refuse_user_delete before delete on "user" for each row execute function refuse_user_delete()`);

      try {
        const answer = await deleteAccount();

        expect(answer.success).toBe(false);
        expect(await personExists()).toBe(true);
        expect(await workspaceExists("set-org-alone")).toBe(true);
      } finally {
        // The next test file may share the database (a real PostgreSQL does): the trigger goes, pass or fail
        await testDb.execute(sql`drop trigger if exists refuse_user_delete on "user"`);
      }
    });
  });
});
