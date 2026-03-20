import { beforeEach, describe, expect, it } from "vitest";
import { organization, plan, subscription, user } from "@/models";
import {
  seedOrg,
  seedPlan,
  seedSubscription,
  seedUser,
} from "../../helpers/seed";
import { testDb } from "../../setup";

describe("admin queries", () => {
  beforeEach(async () => {
    await testDb.delete(subscription);
    await testDb.delete(plan);
    await testDb.delete(organization);
    await testDb.delete(user);
  });

  describe("getAdminUsers", () => {
    it("returns an empty array when no users exist", async () => {
      const { getAdminUsers } = await import("@/features/admin/queries");

      const result = await getAdminUsers();

      expect(result).toEqual([]);
    });

    it("returns all users", async () => {
      await seedUser("user-1", { name: "Alice", email: "alice@test.com" });
      await seedUser("user-2", { name: "Bob", email: "bob@test.com" });

      const { getAdminUsers } = await import("@/features/admin/queries");

      const result = await getAdminUsers();

      expect(result).toHaveLength(2);
      expect(result.map((u) => u.id)).toContain("user-1");
      expect(result.map((u) => u.id)).toContain("user-2");
    });

    it("respects the limit parameter", async () => {
      await seedUser("user-1", { email: "a@test.com" });
      await seedUser("user-2", { email: "b@test.com" });
      await seedUser("user-3", { email: "c@test.com" });

      const { getAdminUsers } = await import("@/features/admin/queries");

      const result = await getAdminUsers(2);

      expect(result).toHaveLength(2);
    });

    it("respects the offset parameter", async () => {
      await seedUser("user-1", { email: "a@test.com" });
      await seedUser("user-2", { email: "b@test.com" });
      await seedUser("user-3", { email: "c@test.com" });

      const { getAdminUsers } = await import("@/features/admin/queries");

      const allUsers = await getAdminUsers();
      const offsetResult = await getAdminUsers(100, 2);

      expect(offsetResult).toHaveLength(1);
      expect(offsetResult[0].id).toBe(allUsers[2].id);
    });
  });

  describe("getAdminOrganizations", () => {
    it("returns an empty array when no organizations exist", async () => {
      const { getAdminOrganizations } = await import(
        "@/features/admin/queries"
      );

      const result = await getAdminOrganizations();

      expect(result).toEqual([]);
    });

    it("returns all organizations", async () => {
      await seedOrg("org-1", { name: "Org A", slug: "org-a" });
      await seedOrg("org-2", { name: "Org B", slug: "org-b" });

      const { getAdminOrganizations } = await import(
        "@/features/admin/queries"
      );

      const result = await getAdminOrganizations();

      expect(result).toHaveLength(2);
      expect(result.map((o) => o.id)).toContain("org-1");
      expect(result.map((o) => o.id)).toContain("org-2");
    });

    it("respects the limit parameter", async () => {
      await seedOrg("org-1", { slug: "s-1" });
      await seedOrg("org-2", { slug: "s-2" });
      await seedOrg("org-3", { slug: "s-3" });

      const { getAdminOrganizations } = await import(
        "@/features/admin/queries"
      );

      const result = await getAdminOrganizations(2);

      expect(result).toHaveLength(2);
    });

    it("respects the offset parameter", async () => {
      await seedOrg("org-1", { slug: "s-1" });
      await seedOrg("org-2", { slug: "s-2" });
      await seedOrg("org-3", { slug: "s-3" });

      const { getAdminOrganizations } = await import(
        "@/features/admin/queries"
      );

      const allOrgs = await getAdminOrganizations();
      const offsetResult = await getAdminOrganizations(100, 2);

      expect(offsetResult).toHaveLength(1);
      expect(offsetResult[0].id).toBe(allOrgs[2].id);
    });
  });

  describe("getAdminMetrics", () => {
    it("returns zeroes when database is empty", async () => {
      const { getAdminMetrics } = await import("@/features/admin/queries");

      const result = await getAdminMetrics();

      expect(result).toEqual({
        totalUsers: 0,
        totalOrganizations: 0,
        mrr: 0,
      });
    });

    it("counts users and organizations correctly", async () => {
      await seedUser("user-1", { email: "a@test.com" });
      await seedUser("user-2", { email: "b@test.com" });
      await seedOrg("org-1", { slug: "s-1" });

      const { getAdminMetrics } = await import("@/features/admin/queries");

      const result = await getAdminMetrics();

      expect(result.totalUsers).toBe(2);
      expect(result.totalOrganizations).toBe(1);
      expect(result.mrr).toBe(0);
    });

    it("calculates MRR from active subscriptions only", async () => {
      await seedOrg("org-1", { slug: "s-1" });
      await seedOrg("org-2", { slug: "s-2" });
      await seedOrg("org-3", { slug: "s-3" });

      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedPlan("enterprise", { name: "Enterprise", price: 9900 });

      await seedSubscription("org-1", {
        id: "sub-1",
        planId: "pro",
        status: "active",
      });
      await seedSubscription("org-2", {
        id: "sub-2",
        planId: "enterprise",
        status: "active",
      });
      // canceled subscription should NOT count toward MRR
      await seedSubscription("org-3", {
        id: "sub-3",
        planId: "pro",
        status: "canceled",
      });

      const { getAdminMetrics } = await import("@/features/admin/queries");

      const result = await getAdminMetrics();

      expect(result.mrr).toBe(2900 + 9900);
      expect(result.totalOrganizations).toBe(3);
    });

    it("returns mrr 0 when all subscriptions are canceled", async () => {
      await seedOrg("org-1", { slug: "s-1" });
      await seedPlan("pro", { name: "Pro", price: 2900 });
      await seedSubscription("org-1", {
        id: "sub-1",
        planId: "pro",
        status: "canceled",
      });

      const { getAdminMetrics } = await import("@/features/admin/queries");

      const result = await getAdminMetrics();

      expect(result.mrr).toBe(0);
    });
  });
});
