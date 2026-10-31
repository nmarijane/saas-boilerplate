import { count, sql } from "drizzle-orm";

import { organization } from "@/models/organization";
import { plan, subscription  } from "@/models/subscription";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import "server-only";

// Admin reads: each admin page calls requireAdmin() before using them.
// Columns are listed explicitly: the user table holds 2FA secrets.

export async function getAdminUsers(limit = 100, offset = 0) {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    })
    .from(user)
    .limit(limit)
    .offset(offset);
}

export async function getAdminOrganizations(limit = 100, offset = 0) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .limit(limit)
    .offset(offset);
}

export async function getAdminMetrics() {
  const [usersCount, orgsCount, mrrResult] = await Promise.all([
    db.select({ count: count() }).from(user),
    db.select({ count: count() }).from(organization),
    db
      .select({
        mrr: sql<number>`COALESCE(SUM(${plan.price}), 0)`,
      })
      .from(subscription)
      .innerJoin(plan, sql`${subscription.planId} = ${plan.id}`)
      .where(sql`${subscription.status} = 'active'`),
  ]);

  return {
    totalUsers: usersCount[0]?.count ?? 0,
    totalOrganizations: orgsCount[0]?.count ?? 0,
    mrr: mrrResult[0]?.mrr ?? 0,
  };
}
