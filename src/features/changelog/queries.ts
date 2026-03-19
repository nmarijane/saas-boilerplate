"use server";

import { desc } from "drizzle-orm";

import { changelogEntry } from "@/models/changelog";
import { db } from "@/shared/lib/DB";

export async function getChangelogEntries(limit = 50) {
  return db
    .select()
    .from(changelogEntry)
    .orderBy(desc(changelogEntry.publishedAt))
    .limit(limit);
}
