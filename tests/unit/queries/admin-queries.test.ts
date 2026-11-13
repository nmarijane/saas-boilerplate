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

  // The lists stop at 100: the people the page leaves out must be the oldest ones, in an
  // order that does not change between two reads, since `offset` pages through it.
  describe("the order of getAdminUsers", () => {
    const DAY = 24 * 60 * 60 * 1000;

    it("lists the newest first", async () => {
      const now = Date.now();
      await seedUser("user-old", { createdAt: new Date(now - 3 * DAY), email: "old@test.com" });
      await seedUser("user-new", { createdAt: new Date(now), email: "new@test.com" });
      await seedUser("user-mid", { createdAt: new Date(now - DAY), email: "mid@test.com" });
      const { getAdminUsers } = await import("@/features/admin/queries");

      expect((await getAdminUsers()).map((u) => u.id)).toEqual(["user-new", "user-mid", "user-old"]);
    });

    it("lists users that share their createdAt by id, descending", async () => {
      const at = new Date("2026-11-04T10:00:00Z");
      for (const id of ["user-b", "user-c", "user-a"]) {
        await seedUser(id, { createdAt: at, email: `${id}@test.com` });
      }
      const { getAdminUsers } = await import("@/features/admin/queries");

      expect((await getAdminUsers()).map((u) => u.id)).toEqual(["user-c", "user-b", "user-a"]);
    });

    it("pages through rows that share their createdAt without repeating or skipping one", async () => {
      const at = new Date("2026-11-04T10:00:00Z");
      await testDb.insert(user).values(
        Array.from({ length: 7 }, (_, index) => ({
          id: `user-${index}`,
          name: `User ${index}`,
          email: `user-${index}@test.com`,
          emailVerified: true,
          createdAt: at,
          updatedAt: at,
        })),
      );
      const { getAdminUsers } = await import("@/features/admin/queries");

      const pages = [await getAdminUsers(3, 0), await getAdminUsers(3, 3), await getAdminUsers(3, 6)];
      const ids = pages.flat().map((u) => u.id);

      expect(ids).toEqual(["user-6", "user-5", "user-4", "user-3", "user-2", "user-1", "user-0"]);
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

  describe("the order of getAdminOrganizations", () => {
    const DAY = 24 * 60 * 60 * 1000;

    it("lists the newest first", async () => {
      const now = Date.now();
      await seedOrg("org-old", { slug: "old", createdAt: new Date(now - 3 * DAY) });
      await seedOrg("org-new", { slug: "new", createdAt: new Date(now) });
      await seedOrg("org-mid", { slug: "mid", createdAt: new Date(now - DAY) });
      const { getAdminOrganizations } = await import("@/features/admin/queries");

      expect((await getAdminOrganizations()).map((o) => o.id)).toEqual(["org-new", "org-mid", "org-old"]);
    });

    it("lists organizations that share their createdAt by id, descending", async () => {
      const at = new Date("2026-11-04T10:00:00Z");
      for (const id of ["org-b", "org-c", "org-a"]) {
        await seedOrg(id, { slug: id, createdAt: at });
      }
      const { getAdminOrganizations } = await import("@/features/admin/queries");

      expect((await getAdminOrganizations()).map((o) => o.id)).toEqual(["org-c", "org-b", "org-a"]);
    });

    it("pages through rows that share their createdAt without repeating or skipping one", async () => {
      const at = new Date("2026-11-04T10:00:00Z");
      await testDb.insert(organization).values(
        Array.from({ length: 7 }, (_, index) => ({
          id: `org-${index}`,
          name: `Org ${index}`,
          slug: `org-${index}`,
          createdAt: at,
          updatedAt: at,
        })),
      );
      const { getAdminOrganizations } = await import("@/features/admin/queries");

      const pages = [
        await getAdminOrganizations(3, 0),
        await getAdminOrganizations(3, 3),
        await getAdminOrganizations(3, 6),
      ];

      expect(pages.flat().map((o) => o.id)).toEqual(["org-6", "org-5", "org-4", "org-3", "org-2", "org-1", "org-0"]);
    });
  });

  // The header of a page counts what there is, not what its table lists: the
  // lists stop at 100, so each count is a query of its own.
  describe("countUsers", () => {
    it("is zero when no users exist", async () => {
      const { countUsers } = await import("@/features/admin/queries");

      expect(await countUsers()).toBe(0);
    });

    it("counts every user, past the 100 the list stops at", async () => {
      const now = new Date();
      await testDb.insert(user).values(
        Array.from({ length: 101 }, (_, index) => ({
          id: `user-${index}`,
          name: `User ${index}`,
          email: `user-${index}@test.com`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        })),
      );
      const { countUsers, getAdminUsers } = await import(
        "@/features/admin/queries"
      );

      expect(await countUsers()).toBe(101);
      expect(await getAdminUsers()).toHaveLength(100);
    });
  });

  describe("countOrganizations", () => {
    it("is zero when no organizations exist", async () => {
      const { countOrganizations } = await import("@/features/admin/queries");

      expect(await countOrganizations()).toBe(0);
    });

    it("counts every organization, past the 100 the list stops at", async () => {
      const now = new Date();
      await testDb.insert(organization).values(
        Array.from({ length: 101 }, (_, index) => ({
          id: `org-${index}`,
          name: `Org ${index}`,
          slug: `org-${index}`,
          createdAt: now,
          updatedAt: now,
        })),
      );
      const { countOrganizations, getAdminOrganizations } = await import(
        "@/features/admin/queries"
      );

      expect(await countOrganizations()).toBe(101);
      expect(await getAdminOrganizations()).toHaveLength(100);
    });
  });

  describe("getAdminMetrics", () => {
    it("reads the totals of the two counts, whatever the limit of the lists", async () => {
      const now = new Date();
      await testDb.insert(user).values(
        Array.from({ length: 101 }, (_, index) => ({
          id: `user-${index}`,
          name: `User ${index}`,
          email: `user-${index}@test.com`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await seedOrg("org-1", { slug: "s-1" });
      const { countOrganizations, countUsers, getAdminMetrics } = await import(
        "@/features/admin/queries"
      );

      const result = await getAdminMetrics();

      expect(result.totalUsers).toBe(await countUsers());
      expect(result.totalUsers).toBe(101);
      expect(result.totalOrganizations).toBe(await countOrganizations());
    });

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
