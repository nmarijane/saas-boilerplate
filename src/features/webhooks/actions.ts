"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { webhookEndpoint } from "@/models/webhook";
import { SECRET_PREFIXES } from "@/shared/config/app";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { ENDPOINT_URL_MAX, isAllowedEndpointUrl } from "./endpoint-url";
import { eventsSchema } from "./events-schema";
import { isNonPublicAddressLiteral } from "./outbound";

const createWebhookSchema = z.object({
  // https only (http://localhost in development); where it leads is checked at each delivery (outbound.ts)
  url: z
    .string()
    .max(ENDPOINT_URL_MAX)
    .refine((value) => isAllowedEndpointUrl(value), { message: "The address must be an https URL" })
    // An address written as numbers that is not public is refused here, without resolving anything (a name is checked at delivery)
    .refine((value) => !isNonPublicAddressLiteral(value), { message: "The address must be public" }),
  events: eventsSchema,
});

const endpointIdSchema = z.string().min(1).max(100);

export async function createWebhookEndpointAction(
  orgId: string,
  input: z.infer<typeof createWebhookSchema>,
) {
  const { session } = await requireRole(orgId, "admin");
  const parsed = createWebhookSchema.parse(input);
  const id = generateId();
  const secret = `${SECRET_PREFIXES.webhookSecret}${randomBytes(24).toString("base64url")}`;

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

  revalidatePath("/settings/developers");
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

  revalidatePath("/settings/developers");
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

  revalidatePath("/settings/developers");
}
