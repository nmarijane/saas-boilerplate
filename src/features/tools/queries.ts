"use server";

import { and, eq, ne } from "drizzle-orm";
import { aiTools } from "@/models";
import { db } from "@/shared/lib/DB";

export async function getPublishedTools() {
  return db
    .select()
    .from(aiTools)
    .where(
      and(
        eq(aiTools.status, "published"),
        ne(aiTools.slug, "organise-disclosure-material"),
      ),
    );
}

export async function getToolBySlug(slug: string) {
  // Retired example: also block existing seed data before migration 0007 runs.
  if (slug === "organise-disclosure-material") return null;
  const [tool] = await db
    .select()
    .from(aiTools)
    .where(eq(aiTools.slug, slug))
    .limit(1);
  return tool ?? null;
}
