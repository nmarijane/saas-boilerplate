import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notification } from "@/models/notification";
import { seedNotification, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const NOTIF_USER = "test-user-1";

describe("notification actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(notification);
    await seedUser(NOTIF_USER);
  });

  describe("createNotification", () => {
    it("creates a notification with required fields", async () => {
      const { createNotification } = await import(
        "@/features/notifications/actions"
      );

      const result = await createNotification(NOTIF_USER, {
        title: "Welcome",
        body: "Welcome to the app",
      });

      expect(result.id).toBeDefined();

      const notifs = await testDb
        .select()
        .from(notification)
        .where(eq(notification.userId, NOTIF_USER));

      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toBe("Welcome");
      expect(notifs[0].body).toBe("Welcome to the app");
      expect(notifs[0].type).toBe("info");
      expect(notifs[0].link).toBeNull();
      expect(notifs[0].read).toBe(false);
    });

    it("creates a notification with optional type and link", async () => {
      const { createNotification } = await import(
        "@/features/notifications/actions"
      );

      await createNotification(NOTIF_USER, {
        title: "Payment Failed",
        body: "Your payment could not be processed",
        type: "billing",
        link: "/settings/billing",
      });

      const notifs = await testDb
        .select()
        .from(notification)
        .where(eq(notification.userId, NOTIF_USER));

      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("billing");
      expect(notifs[0].link).toBe("/settings/billing");
    });
  });

  describe("markAsRead", () => {
    it("marks a single notification as read", async () => {
      const notif = await seedNotification(NOTIF_USER, {
        id: "notif-read-1",
        read: false,
      });

      const { markAsRead } = await import(
        "@/features/notifications/actions"
      );

      await markAsRead(notif.id);

      const updated = await testDb
        .select()
        .from(notification)
        .where(eq(notification.id, notif.id));

      expect(updated[0].read).toBe(true);
    });

    it("does not affect other notifications", async () => {
      const notif1 = await seedNotification(NOTIF_USER, {
        id: "notif-read-2a",
        read: false,
      });
      await seedNotification(NOTIF_USER, {
        id: "notif-read-2b",
        read: false,
      });

      const { markAsRead } = await import(
        "@/features/notifications/actions"
      );

      await markAsRead(notif1.id);

      const other = await testDb
        .select()
        .from(notification)
        .where(eq(notification.id, "notif-read-2b"));

      expect(other[0].read).toBe(false);
    });

    it("does not mark another user's notification as read", async () => {
      const otherUser = "other-user-1";
      await seedUser(otherUser);
      const notif = await seedNotification(otherUser, { id: "notif-cross-read", read: false });

      const { markAsRead } = await import("@/features/notifications/actions");
      await markAsRead(notif.id);

      const result = await testDb
        .select()
        .from(notification)
        .where(eq(notification.id, notif.id));
      expect(result[0].read).toBe(false);
    });
  });

  describe("markAllRead", () => {
    it("marks all unread notifications as read for a user", async () => {
      await seedNotification(NOTIF_USER, { id: "notif-all-1", read: false });
      await seedNotification(NOTIF_USER, { id: "notif-all-2", read: false });
      await seedNotification(NOTIF_USER, { id: "notif-all-3", read: true });

      const { markAllRead } = await import(
        "@/features/notifications/actions"
      );

      await markAllRead();

      const notifs = await testDb
        .select()
        .from(notification)
        .where(eq(notification.userId, NOTIF_USER));

      expect(notifs.every((n) => n.read)).toBe(true);
    });

    it("does not affect other users' notifications", async () => {
      const otherUser = "notif-user-other";
      await seedUser(otherUser);
      await seedNotification(NOTIF_USER, { id: "notif-my-1", read: false });
      await seedNotification(otherUser, { id: "notif-other-1", read: false });

      const { markAllRead } = await import(
        "@/features/notifications/actions"
      );

      await markAllRead();

      const otherNotifs = await testDb
        .select()
        .from(notification)
        .where(eq(notification.userId, otherUser));

      expect(otherNotifs[0].read).toBe(false);
    });
  });

  describe("deleteNotification", () => {
    it("deletes a notification", async () => {
      const notif = await seedNotification(NOTIF_USER, {
        id: "notif-del-1",
      });

      const { deleteNotification } = await import(
        "@/features/notifications/actions"
      );

      await deleteNotification(notif.id);

      const remaining = await testDb
        .select()
        .from(notification)
        .where(eq(notification.id, notif.id));

      expect(remaining).toHaveLength(0);
    });

    it("does not affect other notifications", async () => {
      await seedNotification(NOTIF_USER, { id: "notif-del-2a" });
      await seedNotification(NOTIF_USER, { id: "notif-del-2b" });

      const { deleteNotification } = await import(
        "@/features/notifications/actions"
      );

      await deleteNotification("notif-del-2a");

      const remaining = await testDb
        .select()
        .from(notification)
        .where(eq(notification.userId, NOTIF_USER));

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("notif-del-2b");
    });

    it("does not delete another user's notification", async () => {
      const otherUser = "other-user-2";
      await seedUser(otherUser);
      await seedNotification(otherUser, { id: "notif-cross-del" });

      const { deleteNotification } = await import("@/features/notifications/actions");
      await deleteNotification("notif-cross-del");

      const result = await testDb
        .select()
        .from(notification)
        .where(eq(notification.id, "notif-cross-del"));
      expect(result).toHaveLength(1);
    });
  });
});
