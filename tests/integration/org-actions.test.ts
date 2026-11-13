import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE_WORKSPACE_MIN_ROLE,
  MANAGE_MEMBERS_MIN_ROLE,
} from "@/features/auth/organization/permissions";
import { organizationMember, organization as organizationTable } from "@/models/organization";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

vi.mock("@/features/auth/auth", () => ({
  auth: {
    api: {
      createOrganization: vi.fn().mockResolvedValue({ id: "new-org-1", slug: "test" }),
      createInvitation: vi.fn().mockResolvedValue({ id: "invite-1", organizationId: "test-org-1" }),
    },
  },
}));

vi.mock("@/features/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/email/templates/invitation", () => ({
  InvitationEmail: vi.fn().mockReturnValue("mock-template"),
}));

// Deleting a workspace reads the registry, which reaches the client components of
// the features: the navigation of next-intl they import is replaced (no Next router runs in a test)
vi.mock("@/shared/lib/i18n-navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
}));

// Override the guards mock from setup.ts to add requireRole
vi.mock("@/features/auth/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: "test-user-1", name: "Test User", email: "test@test.com" },
    session: { id: "test-session-1" },
  }),
  requireAdmin: vi.fn().mockResolvedValue({
    user: {
      id: "test-admin-1",
      name: "Admin",
      email: "admin@test.com",
      isAdmin: true,
    },
    session: { id: "test-session-2" },
  }),
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-1", name: "Test User", email: "test@test.com" },
    session: { id: "test-session-1" },
  }),
  requireRole: vi.fn().mockResolvedValue({
    session: {
      user: { id: "test-user-1", name: "Test User", email: "test@test.com" },
      session: { id: "test-session-1" },
    },
    member: { id: "member-test-user-1", role: "owner" },
  }),
}));

const ORG_USER = "test-user-1";
const ORG_ID = "test-org-1";

describe("organization actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(organizationMember);
    await testDb.delete(organizationTable);
    await seedUser(ORG_USER);
  });

  describe("createOrganization", () => {
    it("creates an organization successfully", async () => {
      const { createOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await createOrganization({
        name: "My Org",
        slug: "my-org",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ id: "new-org-1", slug: "test" });
      }
    });

    it("returns validation error for empty name", async () => {
      const { createOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await createOrganization({
        name: "",
        slug: "valid-slug",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
        expect(result.validationErrors?.name).toBeDefined();
      }
    });

    it("returns validation error for invalid slug with uppercase", async () => {
      const { createOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await createOrganization({
        name: "Valid Name",
        slug: "Invalid-Slug!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
        expect(result.validationErrors?.slug).toBeDefined();
      }
    });

    it("returns validation error for empty slug", async () => {
      const { createOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await createOrganization({
        name: "Valid Name",
        slug: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
      }
    });

    it("returns error when the auth guard rejects", async () => {
      const { requireAuth } = await import("@/features/auth/guards");
      vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

      const { createOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await createOrganization({
        name: "My Org",
        slug: "my-org",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to create organization");
      }
    });
  });

  describe("inviteMember", () => {
    // The invitation is made for a workspace that exists, and says its name
    beforeEach(async () => {
      await seedOrg(ORG_ID, { name: "Acme Inc" });
    });

    it("invites a member and sends email", async () => {
      const { inviteMember } = await import(
        "@/features/auth/organization/actions"
      );
      const { sendEmail } = await import("@/features/email/send");
      const { auth } = await import("@/features/auth/auth");

      const result = await inviteMember({
        orgId: ORG_ID,
        email: "new@test.com",
        role: "member",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ id: "invite-1", organizationId: ORG_ID });
      }

      // Verify auth API was called
      expect(auth.api.createInvitation).toHaveBeenCalledOnce();

      // Verify email was sent
      expect(sendEmail).toHaveBeenCalledOnce();
      expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
        to: "new@test.com",
        subject: "Test User invited you to join Acme Inc",
      });
    });

    // The link opens the page of the invitation, in the language of the page it was sent from
    it("names the workspace in the email by its name, not by its id, and links to the invitation in the language of the sender", async () => {
      const { inviteMember } = await import(
        "@/features/auth/organization/actions"
      );
      const { InvitationEmail } = await import("@/features/email/templates/invitation");

      await inviteMember({ orgId: ORG_ID, email: "new@test.com", role: "member", locale: "fr" });

      expect(InvitationEmail).toHaveBeenCalledExactlyOnceWith({
        inviterName: "Test User",
        organizationName: "Acme Inc",
        inviteUrl: expect.stringMatching(/^https?:\/\/[^/]+\/fr\/accept-invitation\/invite-1$/),
      });

      vi.mocked(InvitationEmail).mockClear();
      await inviteMember({ orgId: ORG_ID, email: "new@test.com", role: "member" });
      expect(vi.mocked(InvitationEmail).mock.calls[0]?.[0].inviteUrl).toMatch(/\/en\/accept-invitation\/invite-1$/);
    });

    // `requireRole` has proved that the person belongs to the workspace, so one that is not found
    // is a failure of the action, not an empty name: no invitation is made, and none is mailed.
    it("fails, and makes and mails no invitation, when the workspace cannot be found", async () => {
      const { inviteMember } = await import(
        "@/features/auth/organization/actions"
      );
      const { sendEmail } = await import("@/features/email/send");
      const { auth } = await import("@/features/auth/auth");
      await testDb.delete(organizationTable);

      const result = await inviteMember({ orgId: ORG_ID, email: "new@test.com", role: "member" });

      expect(result).toEqual({ success: false, error: "Failed to invite member" });
      expect(auth.api.createInvitation).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("returns validation error for invalid email", async () => {
      const { inviteMember } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await inviteMember({
        orgId: ORG_ID,
        email: "not-an-email",
        role: "member",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
        expect(result.validationErrors?.email).toBeDefined();
      }
    });

    it("returns validation error for empty orgId", async () => {
      const { inviteMember } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await inviteMember({
        orgId: "",
        email: "valid@test.com",
        role: "admin",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
      }
    });
  });

  describe("removeMember", () => {
    it("removes a member from the organization", async () => {
      await seedOrg(ORG_ID);
      await seedUser("member-to-remove");
      const member = await seedOrgMember("member-to-remove", ORG_ID, "member");

      const { removeMember } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await removeMember({
        orgId: ORG_ID,
        memberIdToRemove: member.id,
      });

      expect(result.success).toBe(true);

      // Verify member was removed from DB
      const members = await testDb
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.id, member.id));
      expect(members).toHaveLength(0);
    });

    // The owner hands the workspace to this member at the moment an admin removes them: the check that read
    // "member" is stale, and the write itself must refuse the row that is an owner now
    it("refuses to remove a member who became the owner after the check, and removes nobody", async () => {
      await seedOrg(ORG_ID);
      await seedUser("just-made-owner");
      const member = await seedOrgMember("just-made-owner", ORG_ID, "owner");
      // What the check read, before the hand-over: a member
      const stale = vi.spyOn(testDb, "select").mockImplementationOnce((() => ({
        from: () => ({ where: () => ({ limit: async () => [{ role: "member" }] }) }),
      })) as never);
      const { removeMember } = await import("@/features/auth/organization/actions");

      const result = await removeMember({ orgId: ORG_ID, memberIdToRemove: member.id });
      stale.mockRestore();

      expect(result.success).toBe(false);
      const rows = await testDb.select().from(organizationMember).where(eq(organizationMember.id, member.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.role).toBe("owner");
    });

    it("returns validation error for empty orgId", async () => {
      const { removeMember } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await removeMember({
        orgId: "",
        memberIdToRemove: "some-id",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
      }
    });

    it("does not affect other org members", async () => {
      await seedOrg(ORG_ID);
      await seedUser("user-stay");
      await seedUser("user-go");
      await seedOrgMember("user-stay", ORG_ID, "member");
      const toRemove = await seedOrgMember("user-go", ORG_ID, "member");

      const { removeMember } = await import(
        "@/features/auth/organization/actions"
      );

      await removeMember({
        orgId: ORG_ID,
        memberIdToRemove: toRemove.id,
      });

      const remaining = await testDb
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.organizationId, ORG_ID));
      expect(remaining).toHaveLength(1);
      expect(remaining[0].userId).toBe("user-stay");
    });
  });

  describe("changeRole", () => {
    it("changes a member role from member to admin", async () => {
      await seedOrg(ORG_ID);
      await seedUser("user-role-change");
      const member = await seedOrgMember("user-role-change", ORG_ID, "member");

      const { changeRole } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await changeRole({
        orgId: ORG_ID,
        memberId: member.id,
        newRole: "admin",
      });

      expect(result.success).toBe(true);

      const updated = await testDb
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.id, member.id));
      expect(updated).toHaveLength(1);
      expect(updated[0].role).toBe("admin");
    });

    it("refuses to demote a member who became the owner after the check, and changes nothing", async () => {
      await seedOrg(ORG_ID);
      await seedUser("just-made-owner-2");
      const member = await seedOrgMember("just-made-owner-2", ORG_ID, "owner");
      const stale = vi.spyOn(testDb, "select").mockImplementationOnce((() => ({
        from: () => ({ where: () => ({ limit: async () => [{ role: "admin" }] }) }),
      })) as never);
      const { changeRole } = await import("@/features/auth/organization/actions");

      const result = await changeRole({ orgId: ORG_ID, memberId: member.id, newRole: "member" });
      stale.mockRestore();

      expect(result.success).toBe(false);
      const rows = await testDb.select().from(organizationMember).where(eq(organizationMember.id, member.id));
      expect(rows[0]?.role).toBe("owner");
    });

    it("changes a member role from admin to member", async () => {
      await seedOrg(ORG_ID);
      await seedUser("user-demote");
      const member = await seedOrgMember("user-demote", ORG_ID, "admin");

      const { changeRole } = await import(
        "@/features/auth/organization/actions"
      );

      await changeRole({
        orgId: ORG_ID,
        memberId: member.id,
        newRole: "member",
      });

      const updated = await testDb
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.id, member.id));
      expect(updated[0].role).toBe("member");
    });

    it("returns validation error for empty memberId", async () => {
      const { changeRole } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await changeRole({
        orgId: ORG_ID,
        memberId: "",
        newRole: "admin",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
      }
    });
  });

  describe("deleteOrganization", () => {
    it("deletes an organization from DB", async () => {
      await seedOrg(ORG_ID);

      // requireRole is already mocked to resolve (no-op check)

      const { deleteOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await deleteOrganization({ orgId: ORG_ID });

      expect(result.success).toBe(true);

      const orgs = await testDb
        .select()
        .from(organizationTable)
        .where(eq(organizationTable.id, ORG_ID));
      expect(orgs).toHaveLength(0);
    });

    it("returns validation error for empty orgId", async () => {
      const { deleteOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await deleteOrganization({ orgId: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
      }
    });

    it("returns error when the auth guard rejects", async () => {
      const { requireAuth } = await import("@/features/auth/guards");
      vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

      const { deleteOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      const result = await deleteOrganization({ orgId: ORG_ID });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to delete organization");
      }
    });
  });

  // The Team page shows an action to the roles at least as high as the ones
  // below, and the server asks the guard for the same ones: if either side moves
  // alone, a button is offered that the server refuses, or hidden that it allows.
  describe("the roles the actions ask of the guard", () => {
    it("asks an admin to invite, to change a role and to remove a member, as the Team page offers them", async () => {
      const { requireRole } = await import("@/features/auth/guards");
      const { changeRole, inviteMember, removeMember } = await import(
        "@/features/auth/organization/actions"
      );
      await seedOrg(ORG_ID);

      await inviteMember({ orgId: ORG_ID, email: "who@test.com", role: "member" });
      await changeRole({ orgId: ORG_ID, memberId: "m1", newRole: "admin" });
      await removeMember({ orgId: ORG_ID, memberIdToRemove: "m1" });

      expect(MANAGE_MEMBERS_MIN_ROLE).toBe("admin");
      expect(vi.mocked(requireRole).mock.calls).toEqual([
        [ORG_ID, MANAGE_MEMBERS_MIN_ROLE],
        [ORG_ID, MANAGE_MEMBERS_MIN_ROLE],
        [ORG_ID, MANAGE_MEMBERS_MIN_ROLE],
      ]);
    });

    it("asks the owner to delete the workspace, as the Team page offers it", async () => {
      const { requireRole } = await import("@/features/auth/guards");
      const { deleteOrganization } = await import(
        "@/features/auth/organization/actions"
      );

      await deleteOrganization({ orgId: ORG_ID });

      expect(DELETE_WORKSPACE_MIN_ROLE).toBe("owner");
      expect(requireRole).toHaveBeenCalledExactlyOnceWith(ORG_ID, DELETE_WORKSPACE_MIN_ROLE);
    });
  });
});
