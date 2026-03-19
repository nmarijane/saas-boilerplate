"use server";

import { and, count, eq } from "drizzle-orm";
import { notification, organizationMember, subscription, upload } from "@/models";
import { db } from "@/shared/lib/DB";

export async function getDashboardStats(orgId: string) {
  const [membersResult] = await db
    .select({ count: count() })
    .from(organizationMember)
    .where(eq(organizationMember.organizationId, orgId));

  const sub = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, orgId))
    .limit(1);

  const [uploadsResult] = await db
    .select({ count: count() })
    .from(upload)
    .where(eq(upload.organizationId, orgId));

  return {
    members: membersResult?.count ?? 0,
    plan: sub[0]?.planId ?? "free",
    status: sub[0]?.status ?? "active",
    uploads: uploadsResult?.count ?? 0,
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));

  return result?.count ?? 0;
}
