"use server";

import { and, eq, isNull } from "drizzle-orm";
import { apiKey } from "@/models/api-key";
import { db } from "@/shared/lib/DB";

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

export async function getActiveApiKeysForOrg(orgId: string) {
  return db
    .select()
    .from(apiKey)
    .where(
      and(
        eq(apiKey.orgId, orgId),
        isNull(apiKey.revokedAt),
      ),
    );
}
