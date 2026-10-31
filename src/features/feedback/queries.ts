import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import { feedback } from "@/models/feedback";
import { db } from "@/shared/lib/DB";
import "server-only";

interface GetFeedbacksOptions {
  status?: string;
  orgId?: string;
  userId?: string;
}

export async function getFeedbacks(options: GetFeedbacksOptions = {}) {
  const conditions: SQL[] = [];

  if (options.status) {
    conditions.push(eq(feedback.status, options.status));
  }

  if (options.orgId) {
    conditions.push(eq(feedback.organizationId, options.orgId));
  }

  if (options.userId) {
    conditions.push(eq(feedback.userId, options.userId));
  }

  return db
    .select()
    .from(feedback)
    .where(and(...conditions))
    .orderBy(desc(feedback.createdAt));
}
