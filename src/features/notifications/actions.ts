"use server";

import { generateId } from "@/shared/utils/helpers";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";

interface CreateNotificationInput {
  title: string;
  body: string;
  type?: string;
  link?: string;
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput,
) {
  const id = generateId();

  await db.insert(notification).values({
    id,
    userId,
    title: input.title,
    body: input.body,
    type: input.type ?? "info",
    link: input.link ?? null,
  });

  return { id };
}

export async function markAsRead(notifId: string) {
  await db
    .update(notification)
    .set({ read: true })
    .where(eq(notification.id, notifId));
  revalidatePath("/");
}

export async function markAllRead(userId: string) {
  await db
    .update(notification)
    .set({ read: true })
    .where(
      and(eq(notification.userId, userId), eq(notification.read, false)),
    );
  revalidatePath("/");
}

export async function deleteNotification(notifId: string) {
  await db.delete(notification).where(eq(notification.id, notifId));
  revalidatePath("/");
}
