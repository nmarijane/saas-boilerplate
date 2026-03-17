"use server";

import { desc, eq } from "drizzle-orm";
import { feedback } from "@/models/feedback";
import { db } from "@/shared/lib/DB";

interface GetFeedbacksOptions {
  status?: string;
  orgId?: string;
}

export async function getFeedbacks(options: GetFeedbacksOptions = {}) {
  let query = db.select().from(feedback).orderBy(desc(feedback.createdAt)).$dynamic();

  if (options.status) {
    query = query.where(eq(feedback.status, options.status));
  }

  if (options.orgId) {
    query = query.where(eq(feedback.organizationId, options.orgId));
  }

  return query;
}
