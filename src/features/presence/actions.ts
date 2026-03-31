"use server";

import { and, eq } from "drizzle-orm";
import { userPresence } from "@/models/presence";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { computeStatus } from "./helpers";

export async function upsertPresence(
  userId: string,
  organizationId: string,
  currentPage: string,
) {
  const now = new Date();

  const existing = await db
    .select({ id: userPresence.id, status: userPresence.status })
    .from(userPresence)
    .where(
      and(
        eq(userPresence.userId, userId),
        eq(userPresence.organizationId, organizationId),
      ),
    )
    .limit(1);

  const previousStatus = existing[0]
    ? computeStatus(existing[0].status === "offline" ? new Date(0) : now, now)
    : null;

  if (existing[0]) {
    await db
      .update(userPresence)
      .set({ currentPage, status: "online", lastSeenAt: now })
      .where(eq(userPresence.id, existing[0].id));
  } else {
    await db.insert(userPresence).values({
      id: generateId(),
      userId,
      organizationId,
      currentPage,
      status: "online",
      lastSeenAt: now,
    });
  }

  return { previousStatus, currentStatus: "online" as const };
}
