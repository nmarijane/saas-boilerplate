import { and, count, desc, eq } from "drizzle-orm";
import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";
import { listWindowOf } from "./list-window";
import "server-only";

interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
}

export async function getNotifications(
  userId: string,
  options: GetNotificationsOptions = {},
) {
  // Whoever calls, the window is one that can be served (list-window.ts)
  const { limit, offset } = listWindowOf(options.limit, options.offset);

  return db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getUnreadCount(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(notification)
    .where(
      and(eq(notification.userId, userId), eq(notification.read, false)),
    );

  return result?.count ?? 0;
}
