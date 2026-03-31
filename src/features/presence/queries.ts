"use server";

import { eq, lt } from "drizzle-orm";
import { userPresence } from "@/models/presence";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import { computeStatus } from "./helpers";

export async function getPresenceForOrg(organizationId: string) {
  const rows = await db
    .select({
      userId: userPresence.userId,
      currentPage: userPresence.currentPage,
      lastSeenAt: userPresence.lastSeenAt,
      userName: user.name,
      userImage: user.image,
    })
    .from(userPresence)
    .innerJoin(user, eq(userPresence.userId, user.id))
    .where(eq(userPresence.organizationId, organizationId));

  const now = new Date();
  return rows.map((row) => ({
    userId: row.userId,
    userName: row.userName,
    userImage: row.userImage,
    currentPage: row.currentPage,
    status: computeStatus(row.lastSeenAt, now),
    lastSeenAt: row.lastSeenAt,
  }));
}

export async function cleanupStalePresence() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db
    .delete(userPresence)
    .where(lt(userPresence.lastSeenAt, cutoff));
}
