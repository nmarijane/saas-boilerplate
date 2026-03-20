import { beforeEach, describe, expect, it } from "vitest";
import { notification } from "@/models/notification";
import { seedNotification, seedUser } from "../../helpers/seed";
import { testDb } from "../../setup";

const NOTIF_USER = "nq-user-1";
const OTHER_USER = "nq-user-2";

describe("notification queries", () => {
  beforeEach(async () => {
    await testDb.delete(notification);
    await seedUser(NOTIF_USER);
    await seedUser(OTHER_USER, { email: "other-nq@test.com" });
  });

  describe("getNotifications", () => {
    it("returns an empty array when user has no notifications", async () => {
      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER);

      expect(result).toEqual([]);
    });

    it("returns notifications for the given user only", async () => {
      await seedNotification(NOTIF_USER, { id: "nq-1" });
      await seedNotification(NOTIF_USER, { id: "nq-2" });
      await seedNotification(OTHER_USER, { id: "nq-other-1" });

      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER);

      expect(result).toHaveLength(2);
      expect(result.every((n) => n.userId === NOTIF_USER)).toBe(true);
    });

    it("orders by createdAt descending", async () => {
      const past = new Date("2025-01-01");
      const recent = new Date("2025-06-01");

      await seedNotification(NOTIF_USER, { id: "nq-old", createdAt: past });
      await seedNotification(NOTIF_USER, {
        id: "nq-new",
        createdAt: recent,
      });

      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("nq-new");
      expect(result[1].id).toBe("nq-old");
    });

    it("respects the limit parameter", async () => {
      await seedNotification(NOTIF_USER, { id: "nq-l1" });
      await seedNotification(NOTIF_USER, { id: "nq-l2" });
      await seedNotification(NOTIF_USER, { id: "nq-l3" });

      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER, { limit: 2 });

      expect(result).toHaveLength(2);
    });

    it("defaults to limit of 20", async () => {
      for (let i = 0; i < 25; i++) {
        await seedNotification(NOTIF_USER, { id: `nq-def-${i}` });
      }

      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER);

      expect(result).toHaveLength(20);
    });

    it("respects the offset parameter", async () => {
      const past = new Date("2025-01-01");
      const mid = new Date("2025-03-01");
      const recent = new Date("2025-06-01");

      await seedNotification(NOTIF_USER, {
        id: "nq-off-old",
        createdAt: past,
      });
      await seedNotification(NOTIF_USER, {
        id: "nq-off-mid",
        createdAt: mid,
      });
      await seedNotification(NOTIF_USER, {
        id: "nq-off-new",
        createdAt: recent,
      });

      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER, { offset: 1 });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("nq-off-mid");
      expect(result[1].id).toBe("nq-off-old");
    });

    it("returns empty array when offset exceeds total", async () => {
      await seedNotification(NOTIF_USER, { id: "nq-oe-1" });

      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER, { offset: 100 });

      expect(result).toEqual([]);
    });

    it("combines limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await seedNotification(NOTIF_USER, { id: `nq-lo-${i}` });
      }

      const { getNotifications } = await import(
        "@/features/notifications/queries"
      );

      const result = await getNotifications(NOTIF_USER, {
        limit: 2,
        offset: 2,
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("getUnreadCount", () => {
    it("returns 0 when user has no notifications", async () => {
      const { getUnreadCount } = await import(
        "@/features/notifications/queries"
      );

      const count = await getUnreadCount(NOTIF_USER);

      expect(count).toBe(0);
    });

    it("counts only unread notifications", async () => {
      await seedNotification(NOTIF_USER, { id: "nq-u1", read: false });
      await seedNotification(NOTIF_USER, { id: "nq-u2", read: false });
      await seedNotification(NOTIF_USER, { id: "nq-u3", read: true });

      const { getUnreadCount } = await import(
        "@/features/notifications/queries"
      );

      const count = await getUnreadCount(NOTIF_USER);

      expect(count).toBe(2);
    });

    it("returns 0 when all notifications are read", async () => {
      await seedNotification(NOTIF_USER, { id: "nq-r1", read: true });
      await seedNotification(NOTIF_USER, { id: "nq-r2", read: true });

      const { getUnreadCount } = await import(
        "@/features/notifications/queries"
      );

      const count = await getUnreadCount(NOTIF_USER);

      expect(count).toBe(0);
    });

    it("does not count other users unread notifications", async () => {
      await seedNotification(NOTIF_USER, { id: "nq-cu1", read: false });
      await seedNotification(OTHER_USER, { id: "nq-cu2", read: false });
      await seedNotification(OTHER_USER, { id: "nq-cu3", read: false });

      const { getUnreadCount } = await import(
        "@/features/notifications/queries"
      );

      const count = await getUnreadCount(NOTIF_USER);

      expect(count).toBe(1);
    });
  });
});
