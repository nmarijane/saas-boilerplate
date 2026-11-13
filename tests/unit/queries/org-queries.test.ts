import { eq } from "drizzle-orm";
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

    it("returns display fields only, never the user record", async () => {
      await seedOrgMember(ORG_USER_1, ORG_1, "owner");

      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const [first] = await getOrganizationMembers(ORG_1);

      expect(Object.keys(first ?? {}).sort()).toEqual(
        ["id", "role", "userEmail", "userId", "userImage", "userName"],
      );
    });

    it("gives the id of the membership, which is not the id of the person", async () => {
      const membership = await seedOrgMember(ORG_USER_2, ORG_1, "member");

      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const [first] = await getOrganizationMembers(ORG_1);

      expect(first?.id).toBe(membership.id);
      expect(first?.userId).toBe(ORG_USER_2);
      expect(first?.id).not.toBe(first?.userId);
    });

    it("lists the oldest membership first, then by id, whatever the order the rows were written in", async () => {
      // Carol is written first, then Bob, who joined at the very same moment:
      // the ids tell them apart (Bob's comes first). Alice joined after both.
      await seedUser("oq-user-3", { name: "Carol", email: "carol-oq@test.com" });
      const carol = await seedOrgMember("oq-user-3", ORG_1, "member");
      const bob = await seedOrgMember(ORG_USER_2, ORG_1, "admin");
      const alice = await seedOrgMember(ORG_USER_1, ORG_1, "owner");
      const joined = new Date("2026-01-01T00:00:00Z");
      for (const [id, createdAt] of [
        [carol.id, joined],
        [bob.id, joined],
        [alice.id, new Date("2026-02-01T00:00:00Z")],
      ] as const) {
        await testDb.update(organizationMember).set({ createdAt }).where(eq(organizationMember.id, id));
      }

      const { getOrganizationMembers } = await import(
        "@/features/auth/organization/queries"
      );

      const first = await getOrganizationMembers(ORG_1);
      const second = await getOrganizationMembers(ORG_1);

      expect(bob.id < carol.id).toBe(true);
      expect(first.map((m) => m.id)).toEqual([bob.id, carol.id, alice.id]);
      expect(second.map((m) => m.id)).toEqual(first.map((m) => m.id));
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

    it("lists the organizations from the oldest membership to the newest", async () => {
      // ORG_1 was joined first by insertion, but ORG_2 is the older membership.
      const newer = await seedOrgMember(ORG_USER_1, ORG_1, "owner");
      const older = await seedOrgMember(ORG_USER_1, ORG_2, "member");
      await testDb
        .update(organizationMember)
        .set({ createdAt: new Date("2026-02-01T00:00:00Z") })
        .where(eq(organizationMember.id, newer.id));
      await testDb
        .update(organizationMember)
        .set({ createdAt: new Date("2026-01-01T00:00:00Z") })
        .where(eq(organizationMember.id, older.id));

      const { getUserOrganizations } = await import(
        "@/features/auth/organization/queries"
      );

      const result = await getUserOrganizations(ORG_USER_1);

      expect(result.map((o) => o.id)).toEqual([ORG_2, ORG_1]);
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
