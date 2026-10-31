import { featureFlag } from "@/models/feature-flag";
import { db } from "@/shared/lib/DB";
import "server-only";

export async function getAllFeatureFlags() {
  return db.select().from(featureFlag).orderBy(featureFlag.key);
}
