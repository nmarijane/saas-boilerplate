"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/features/auth/guards";
import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";

// createNotification lives in ./service: it is an internal operation.

const notifIdSchema = z.string().min(1).max(100);

export async function markAsRead(notifId: string) {
  const session = await requireAuth();
  const id = notifIdSchema.parse(notifId);
  await db
    .update(notification)
    .set({ read: true })
    .where(
      and(eq(notification.id, id), eq(notification.userId, session.user.id)),
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
  const id = notifIdSchema.parse(notifId);
  await db
    .delete(notification)
    .where(
      and(eq(notification.id, id), eq(notification.userId, session.user.id)),
    );
  revalidatePath("/");
}
