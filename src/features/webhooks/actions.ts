"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { assertSafeWebhookUrl } from "./safe-url";

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

export async function createWebhookEndpointAction(
  orgId: string,
  input: z.infer<typeof createWebhookSchema>,
) {
  const parsed = createWebhookSchema.parse(input);
  const { session } = await requireOrgRole(orgId, "admin");
  await assertSafeWebhookUrl(parsed.url);
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

export async function deleteWebhookEndpointAction(
  endpointId: string,
  orgId: string,
) {
  const { session } = await requireOrgRole(orgId, "admin");
  await db
    .delete(webhookEndpoint)
    .where(
      and(eq(webhookEndpoint.id, endpointId), eq(webhookEndpoint.orgId, orgId)),
    );

  await emitEvent("webhook.deleted", {
    orgId,
    actorId: session.user.id,
    resourceType: "webhook_endpoint",
    resourceId: endpointId,
  });

  revalidatePath("/settings/api");
}

export async function toggleWebhookEndpointAction(
  endpointId: string,
  orgId: string,
  active: boolean,
) {
  await requireOrgRole(orgId, "admin");
  await db
    .update(webhookEndpoint)
    .set({ active })
    .where(
      and(eq(webhookEndpoint.id, endpointId), eq(webhookEndpoint.orgId, orgId)),
    );

  revalidatePath("/settings/api");
}
