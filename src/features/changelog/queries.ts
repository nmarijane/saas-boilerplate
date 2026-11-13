import { desc } from "drizzle-orm";

import { changelogEntry } from "@/models/changelog";
import { db } from "@/shared/lib/DB";
import "server-only";

/** How many entries the admin list holds: a list of this many may be the latest of more. */
export const CHANGELOG_LIMIT = 50;

export async function getChangelogEntries(limit = CHANGELOG_LIMIT) {
  return db
    .select()
    .from(changelogEntry)
    .orderBy(desc(changelogEntry.publishedAt))
    .limit(limit);
}
