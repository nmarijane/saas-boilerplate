"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/features/auth/guards";
import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

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
  const session = await requireAuth();
  await db
    .update(notification)
    .set({ read: true })
    .where(
      and(eq(notification.id, notifId), eq(notification.userId, session.user.id)),
    );
  revalidatePath("/");
}

export async function markAllRead() {
  const session = await requireAuth();
  await db
    .update(notification)
    .set({ read: true })
    .where(
      and(eq(notification.userId, session.user.id), eq(notification.read, false)),
    );
  revalidatePath("/");
}

export async function deleteNotification(notifId: string) {
  const session = await requireAuth();
  await db
    .delete(notification)
    .where(
      and(eq(notification.id, notifId), eq(notification.userId, session.user.id)),
    );
  revalidatePath("/");
}
