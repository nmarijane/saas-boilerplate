"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { apiKey } from "@/models/api-key";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { generateApiKey } from "./helpers";

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(["*"]),
  expiresAt: z.date().optional(),
});

const keyIdSchema = z.string().min(1).max(100);

export async function createApiKeyAction(
  orgId: string,
  input: z.infer<typeof createApiKeySchema>,
) {
  const { session } = await requireRole(orgId, "admin");
  const parsed = createApiKeySchema.parse(input);
  const { key, prefix, hash } = generateApiKey();
  const id = generateId();

  await db.insert(apiKey).values({
    id,
    orgId,
    createdBy: session.user.id,
    name: parsed.name,
    prefix,
    hash,
    scopes: parsed.scopes,
    expiresAt: parsed.expiresAt ?? null,
  });

  await emitEvent("api_key.created", {
    orgId,
    actorId: session.user.id,
    resourceType: "api_key",
    resourceId: id,
    metadata: { name: parsed.name },
  });

  revalidatePath("/settings/api");

  return { id, key, prefix };
}

export async function revokeApiKeyAction(keyId: string, orgId: string) {
  const { session } = await requireRole(orgId, "admin");
  const id = keyIdSchema.parse(keyId);

  // Scoped to orgId: an admin of one organization cannot revoke another's keys.
  const revoked = await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKey.id, id), eq(apiKey.orgId, orgId)))
    .returning();

  if (revoked.length === 0) return;

  await emitEvent("api_key.revoked", {
    orgId,
    actorId: session.user.id,
    resourceType: "api_key",
    resourceId: id,
  });

  revalidatePath("/settings/api");
}
