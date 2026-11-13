import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { apiKey } from "@/models/api-key";
import { db } from "@/shared/lib/DB";
import "server-only";

export async function getApiKeysForOrg(orgId: string) {
  return db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      lastUsed: apiKey.lastUsed,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      revokedAt: apiKey.revokedAt,
    })
    .from(apiKey)
    .where(eq(apiKey.orgId, orgId))
    .orderBy(apiKey.createdAt);
}

// A key that can still be used: not revoked, and not past its expiry (a key
// may have none). The one condition of "active", for the list and for the count.
function isUsable() {
  return and(
    isNull(apiKey.revokedAt),
    or(isNull(apiKey.expiresAt), gt(apiKey.expiresAt, new Date())),
  );
}

export async function getActiveApiKeysForOrg(orgId: string) {
  return db
    .select()
    .from(apiKey)
    .where(and(eq(apiKey.orgId, orgId), isUsable()));
}

/** How many keys of a workspace can still be used: not revoked, and not expired, as `getActiveApiKeysForOrg` lists them. */
export async function countActiveApiKeys(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(apiKey)
    .where(and(eq(apiKey.orgId, orgId), isUsable()));

  return result?.count ?? 0;
}
