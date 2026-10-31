"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

const endpointIdSchema = z.string().min(1).max(100);

export async function createWebhookEndpointAction(
  orgId: string,
  input: z.infer<typeof createWebhookSchema>,
) {
  const { session } = await requireRole(orgId, "admin");
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
    actorId: session.user.id,
    resourceType: "webhook_endpoint",
    resourceId: id,
  });

  revalidatePath("/settings/api");
  return { id, secret };
}

// Delete and toggle are scoped to orgId: an admin of one organization
// cannot touch the endpoints of another.

export async function deleteWebhookEndpointAction(
  endpointId: string,
  orgId: string,
) {
  const { session } = await requireRole(orgId, "admin");
  const id = endpointIdSchema.parse(endpointId);

  const deleted = await db
    .delete(webhookEndpoint)
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.orgId, orgId)))
    .returning();

  if (deleted.length === 0) return;

  await emitEvent("webhook.deleted", {
    orgId,
    actorId: session.user.id,
    resourceType: "webhook_endpoint",
    resourceId: id,
  });

  revalidatePath("/settings/api");
}

export async function toggleWebhookEndpointAction(
  endpointId: string,
  orgId: string,
  active: boolean,
) {
  await requireRole(orgId, "admin");
  const id = endpointIdSchema.parse(endpointId);
  const isActive = z.boolean().parse(active);

  await db
    .update(webhookEndpoint)
    .set({ active: isActive })
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.orgId, orgId)));

  revalidatePath("/settings/api");
}
