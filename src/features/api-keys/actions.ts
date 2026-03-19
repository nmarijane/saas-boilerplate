"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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

export async function createApiKeyAction(
  orgId: string,
  userId: string,
  input: z.infer<typeof createApiKeySchema>,
) {
  const parsed = createApiKeySchema.parse(input);
  const { key, prefix, hash } = generateApiKey();
  const id = generateId();

  await db.insert(apiKey).values({
    id,
    orgId,
    createdBy: userId,
    name: parsed.name,
    prefix,
    hash,
    scopes: parsed.scopes,
    expiresAt: parsed.expiresAt ?? null,
  });

  await emitEvent("api_key.created", {
    orgId,
    actorId: userId,
    resourceType: "api_key",
    resourceId: id,
    metadata: { name: parsed.name },
  });

  revalidatePath("/settings/api");

  return { id, key, prefix };
}

export async function revokeApiKeyAction(
  keyId: string,
  orgId: string,
  userId: string,
) {
  await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(eq(apiKey.id, keyId));

  await emitEvent("api_key.revoked", {
    orgId,
    actorId: userId,
    resourceType: "api_key",
    resourceId: keyId,
  });

  revalidatePath("/settings/api");
}
