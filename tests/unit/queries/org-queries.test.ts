import { beforeEach, describe, expect, it } from "vitest";
import { organization, organizationMember, user } from "@/models";
import {
  seedOrg,
  seedOrgMember,
  seedUser,
} from "../../helpers/seed";
import { testDb } from "../../setup";

const ORG_USER_1 = "oq-user-1";
const ORG_USER_2 = "oq-user-2";
const ORG_1 = "oq-org-1";
const ORG_2 = "oq-org-2";

describe("organization queries", () => {
  beforeEach(async () => {
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
    await testDb.delete(user);
    await seedUser(ORG_USER_1, { name: "Alice", email: "alice-oq@test.com" });
    await seedUser(ORG_USER_2, {
      name: "Bob",
      email: "bob-oq@test.com",
      image: "https://example.com/bob.png",
    });
    await seedOrg(ORG_1, { name: "Acme Inc", slug: "oq-acme" });
    await seedOrg(ORG_2, {
      name: "Globex Corp",
      slug: "oq-globex",
      logo: "https://example.com/logo.png",
    });
  });

  describe("getOrganization", () => {
    it("returns the organization when it exists", async () => {
      const { getOrganization } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganization(ORG_1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(ORG_1);
      expect(result?.name).toBe("Acme Inc");
      expect(result?.slug).toBe("oq-acme");
    });

    it("returns null when the organization does not exist", async () => {
      const { getOrganization } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganization("nonexistent-org");

      expect(result).toBeNull();
    });

    it("returns the correct organization among multiple", async () => {
      const { getOrganization } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganization(ORG_2);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(ORG_2);
      expect(result?.name).toBe("Globex Corp");
      expect(result?.logo).toBe("https://example.com/logo.png");
    });
  });

  describe("getOrganizationMembers", () => {
    it("returns an empty array when org has no members", async () => {
      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganizationMembers(ORG_1);

      expect(result).toEqual([]);
    });

    it("returns members with user details via join", async () => {
      await seedOrgMember(ORG_USER_1, ORG_1, "owner");

      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganizationMembers(ORG_1);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(ORG_USER_1);
      expect(result[0].role).toBe("owner");
      expect(result[0].userName).toBe("Alice");
      expect(result[0].userEmail).toBe("alice-oq@test.com");
    });

    it("returns multiple members for the same org", async () => {
      await seedOrgMember(ORG_USER_1, ORG_1, "owner");
      await seedOrgMember(ORG_USER_2, ORG_1, "member");

      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganizationMembers(ORG_1);

      expect(result).toHaveLength(2);
      const userIds = result.map((m) => m.userId);
      expect(userIds).toContain(ORG_USER_1);
      expect(userIds).toContain(ORG_USER_2);
    });

    it("does not include members from another org", async () => {
      await seedOrgMember(ORG_USER_1, ORG_1, "owner");
      await seedOrgMember(ORG_USER_2, ORG_2, "admin");

      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganizationMembers(ORG_1);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(ORG_USER_1);
    });

    it("includes user image in the result", async () => {
      await seedOrgMember(ORG_USER_2, ORG_1, "member");

      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getOrganizationMembers(ORG_1);

      expect(result).toHaveLength(1);
      expect(result[0].userImage).toBe("https://example.com/bob.png");
    });
  });

  describe("getUserOrganizations", () => {
    it("returns an empty array when user has no organizations", async () => {
      const { getUserOrganizations } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getUserOrganizations(ORG_USER_1);

      expect(result).toEqual([]);
    });

    it("returns organizations the user belongs to", async () => {
      await seedOrgMember(ORG_USER_1, ORG_1, "owner");
      await seedOrgMember(ORG_USER_1, ORG_2, "member");

      const { getUserOrganizations } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getUserOrganizations(ORG_USER_1);

      expect(result).toHaveLength(2);
      const orgIds = result.map((o) => o.id);
      expect(orgIds).toContain(ORG_1);
      expect(orgIds).toContain(ORG_2);
    });

    it("includes the user role in each organization", async () => {
      await seedOrgMember(ORG_USER_1, ORG_1, "owner");
      await seedOrgMember(ORG_USER_1, ORG_2, "member");

      const { getUserOrganizations } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getUserOrganizations(ORG_USER_1);

      const org1Result = result.find((o) => o.id === ORG_1);
      const org2Result = result.find((o) => o.id === ORG_2);

      expect(org1Result?.role).toBe("owner");
      expect(org2Result?.role).toBe("member");
    });

    it("does not include organizations the user is not a member of", async () => {
      await seedOrgMember(ORG_USER_1, ORG_1, "owner");
      await seedOrgMember(ORG_USER_2, ORG_2, "admin");

      const { getUserOrganizations } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getUserOrganizations(ORG_USER_1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ORG_1);
    });

    it("includes org name, slug, and logo", async () => {
      await seedOrgMember(ORG_USER_1, ORG_2, "member");

      const { getUserOrganizations } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getUserOrganizations(ORG_USER_1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Globex Corp");
      expect(result[0].slug).toBe("oq-globex");
      expect(result[0].logo).toBe("https://example.com/logo.png");
    });

    it("returns empty for a nonexistent user", async () => {
      const { getUserOrganizations } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getUserOrganizations("nonexistent-user");

      expect(result).toEqual([]);
    });
  });
});
