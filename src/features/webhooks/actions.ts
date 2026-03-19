"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emitEvent } from "@/features/events/emitter";
import { webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

export async function createWebhookEndpointAction(
  orgId: string,
  userId: string,
  input: z.infer<typeof createWebhookSchema>,
) {
  const parsed = createWebhookSchema.parse(input);
  const id = generateId();
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;

  await db.insert(webhookEndpoint).values({
    id,
    orgId,
    url: parsed.url,
    secret,
    events: parsed.events,
  });

  await emitEvent("webhook.created", {
    orgId,
    actorId: userId,
    resourceType: "webhook_endpoint",
    resourceId: id,
  });

  revalidatePath("/settings/api");
  return { id, secret };
}

export async function deleteWebhookEndpointAction(
  endpointId: string,
  orgId: string,
  userId: string,
) {
  await db.delete(webhookEndpoint).where(eq(webhookEndpoint.id, endpointId));

  await emitEvent("webhook.deleted", {
    orgId,
    actorId: userId,
    resourceType: "webhook_endpoint",
    resourceId: endpointId,
  });

  revalidatePath("/settings/api");
}

export async function toggleWebhookEndpointAction(
  endpointId: string,
  active: boolean,
) {
  await db
    .update(webhookEndpoint)
    .set({ active })
    .where(eq(webhookEndpoint.id, endpointId));

  revalidatePath("/settings/api");
}
