import { eq } from "drizzle-orm";
import { featureFlag } from "@/models/feature-flag";
import { db } from "@/shared/lib/DB";

interface FlagContext {
  orgId?: string;
  planId?: string;
}

interface CachedFlag {
  enabled: boolean;
  rules: Array<{ type: "plan" | "org"; value: string }>;
  fetchedAt: number;
}

const FLAG_CACHE = new Map<string, CachedFlag>();
const CACHE_TTL = 60_000; // 60 seconds

export function invalidateFlagCache(key?: string) {
  if (key) {
    FLAG_CACHE.delete(key);
  } else {
    FLAG_CACHE.clear();
  }
}

async function getFlag(key: string): Promise<CachedFlag | null> {
  const cached = FLAG_CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  const flag = await db.query.featureFlag.findFirst({
    where: eq(featureFlag.key, key),
  });

  if (!flag) return null;

  const entry: CachedFlag = {
    enabled: flag.enabled,
    rules: flag.rules as Array<{ type: "plan" | "org"; value: string }>,
    fetchedAt: Date.now(),
  };

  FLAG_CACHE.set(key, entry);
  return entry;
}

export async function isFeatureEnabled(key: string, context: FlagContext = {}): Promise<boolean> {
  const flag = await getFlag(key);
  if (!flag) return false;
  if (!flag.enabled) return false;
  if (flag.rules.length === 0) return true;

  return flag.rules.some((rule) => {
    if (rule.type === "plan" && context.planId) return rule.value === context.planId;
    if (rule.type === "org" && context.orgId) return rule.value === context.orgId;
    return false;
  });
}
