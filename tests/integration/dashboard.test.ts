import { beforeEach, describe, expect, it } from "vitest";
import {
  getDashboardStats,
  getUnreadNotificationCount,
} from "@/features/dashboard/queries";
import { notification, organizationMember, subscription, upload } from "@/models";
import {
  seedNotification,
  seedOrg,
  seedOrgMember,
  seedPlan,
  seedSubscription,
  seedUpload,
  seedUser,
} from "../helpers/seed";
import { testDb } from "../setup";

const ORG_ID = "dash-org-1";
const USER_ID = "dash-user-1";

describe("dashboard queries", () => {
  beforeEach(async () => {
    // Clean tables relevant to dashboard queries (order matters due to FK constraints)
    await testDb.delete(notification);
    await testDb.delete(upload);
    await testDb.delete(subscription);
    await testDb.delete(organizationMember);
    // Seed base user and org
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  describe("getDashboardStats", () => {
    it("returns zeros for empty org", async () => {
      const stats = await getDashboardStats(ORG_ID);
      expect(stats.members).toBe(0);
      expect(stats.plan).toBe("free");
      expect(stats.uploads).toBe(0);
    });

    it("returns correct member count", async () => {
      await seedUser("dash-user-2");
      await seedOrgMember(USER_ID, ORG_ID, "owner");
      await seedOrgMember("dash-user-2", ORG_ID, "member");

      const stats = await getDashboardStats(ORG_ID);
      expect(stats.members).toBe(2);
    });

    it("returns correct plan from subscription", async () => {
      await seedPlan("pro", { name: "Pro", price: 1999 });
      await seedSubscription(ORG_ID, { planId: "pro", status: "active" });

      const stats = await getDashboardStats(ORG_ID);
      expect(stats.plan).toBe("pro");
      expect(stats.status).toBe("active");
    });

    it("returns correct upload count", async () => {
      await seedUpload(USER_ID, { organizationId: ORG_ID });
      await seedUpload(USER_ID, { organizationId: ORG_ID });

      const stats = await getDashboardStats(ORG_ID);
      expect(stats.uploads).toBe(2);
    });
  });

  describe("getUnreadNotificationCount", () => {
    it("counts only unread notifications", async () => {
      await seedNotification(USER_ID, { read: false });
      await seedNotification(USER_ID, { read: false });
      await seedNotification(USER_ID, { read: true });

      const count = await getUnreadNotificationCount(USER_ID);
      expect(count).toBe(2);
    });
  });
});
