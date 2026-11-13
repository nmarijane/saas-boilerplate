import { count, desc, sql } from "drizzle-orm";

import { organization } from "@/models/organization";
import { plan, subscription  } from "@/models/subscription";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import "server-only";

// Admin reads: each admin page calls requireAdmin() before using them.
// Columns are listed explicitly, so a sensitive column added to a table later is never exposed.

// The two lists stop at `limit`, so what they leave out must be the oldest rows, in
// an order that holds between two reads: newest first, then by id. Rows inserted in
// one statement share their `createdAt`, and without the id two pages of `offset` could
// repeat a row or skip one.

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
    .orderBy(desc(user.createdAt), desc(user.id))
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
    .orderBy(desc(organization.createdAt), desc(organization.id))
    .limit(limit)
    .offset(offset);
}

// The totals the headers of the admin pages give. The lists above stop at 100,
// so a header never counts the rows its table was handed: it asks for the total.
export async function countUsers() {
  const [row] = await db.select({ count: count() }).from(user);

  return row?.count ?? 0;
}

export async function countOrganizations() {
  const [row] = await db.select({ count: count() }).from(organization);

  return row?.count ?? 0;
}

export async function getAdminMetrics() {
  const [totalUsers, totalOrganizations, mrrResult] = await Promise.all([
    countUsers(),
    countOrganizations(),
    db
      .select({
        mrr: sql<number>`COALESCE(SUM(${plan.price}), 0)`,
      })
      .from(subscription)
      .innerJoin(plan, sql`${subscription.planId} = ${plan.id}`)
      .where(sql`${subscription.status} = 'active'`),
  ]);

  return {
    totalUsers,
    totalOrganizations,
    mrr: mrrResult[0]?.mrr ?? 0,
  };
}
