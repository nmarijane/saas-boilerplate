import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  requireRole: vi.fn().mockResolvedValue(undefined),
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

    it("returns error when session is null", async () => {
      const { getServerSession } = await import("@/features/auth/guards");
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

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
        subject: "You've been invited to join an organization",
      });
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

    it("returns error when session is null", async () => {
      const { getServerSession } = await import("@/features/auth/guards");
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

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
});
