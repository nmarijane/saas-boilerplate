"use server";

import { and, eq } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { apiKey } from "@/models/api-key";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { earliestEnd, startOfDay } from "./expiry";
import { generateApiKey } from "./helpers";
import { KEY_NAME_MAX } from "./limits";

const createApiKeySchema = z.object({
  name: z.string().min(1).max(KEY_NAME_MAX),
  scopes: z.array(z.string()).default(["*"]),
  expiresAt: z.date().optional(),
});

const keyIdSchema = z.string().min(1).max(100);

/**
 * The answer of `createApiKeyAction`: the key, which is told once, or why it was
 * not made. A request that is not right is answered, not thrown: Next hides the
 * text of an error that is thrown, in production, and the dialog shows this one.
 */
type CreateApiKeyAnswer = { id: string; key: string; prefix: string } | { error: string };

/**
 * The sentence that refuses an end before the first day a key can end on
 * (tomorrow, by the clock of UTC: `earliestEnd`, which the dialog reads too), or
 * nothing when the end is good. A key that ends today is over before anyone has
 * used it. The dialog says so before it sends anything; a request that does not
 * come from the dialog, or from a page whose clock is not the server's (a few
 * minutes before midnight, UTC), is refused here, in the words of the dialog and
 * in the language of the request, which name the day the server takes (its own
 * clock, which is the one that counts).
 */
async function refusalOfEnd(expiresAt: Date | undefined): Promise<string | undefined> {
  if (expiresAt === undefined) {
    return undefined;
  }

  const earliest = startOfDay(earliestEnd(new Date()));
  if (expiresAt.getTime() >= earliest.getTime()) {
    return undefined;
  }

  const [t, format] = await Promise.all([
    getTranslations("apiKeys.dialog"),
    getFormatter(),
  ]);

  return t("expiresPast", {
    date: format.dateTime(earliest, { dateStyle: "long", timeZone: "UTC" }),
  });
}

export async function createApiKeyAction(
  orgId: string,
  input: z.infer<typeof createApiKeySchema>,
): Promise<CreateApiKeyAnswer> {
  const { session } = await requireRole(orgId, "admin");
  const parsed = createApiKeySchema.parse(input);
  const refusal = await refusalOfEnd(parsed.expiresAt);
  if (refusal !== undefined) {
    return { error: refusal };
  }

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

  revalidatePath("/settings/developers");

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

  revalidatePath("/settings/developers");
}
