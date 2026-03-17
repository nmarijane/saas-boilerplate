"use server";

import { count, sql } from "drizzle-orm";

import { organization } from "@/models/organization";
import { plan, subscription  } from "@/models/subscription";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";

export async function getAdminUsers() {
  return db.select().from(user);
}

export async function getAdminOrganizations() {
  return db.select().from(organization);
}

export async function getAdminMetrics() {
  const [usersCount] = await db.select({ count: count() }).from(user);
  const [orgsCount] = await db.select({ count: count() }).from(organization);

  // Calculate MRR from active subscriptions
  const mrrResult = await db
    .select({
      mrr: sql<number>`COALESCE(SUM(${plan.price}), 0)`,
    })
    .from(subscription)
    .innerJoin(plan, sql`${subscription.planId} = ${plan.id}`)
    .where(sql`${subscription.status} = 'active'`);

  return {
    totalUsers: usersCount?.count ?? 0,
    totalOrganizations: orgsCount?.count ?? 0,
    mrr: mrrResult[0]?.mrr ?? 0,
  };
}
