import { desc, eq } from "drizzle-orm";
import { webhookDelivery, webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import "server-only";

// The signing secret is shown once at creation and never sent back to the page.
export async function getWebhookEndpointsForOrg(orgId: string) {
  return db
    .select({
      id: webhookEndpoint.id,
      orgId: webhookEndpoint.orgId,
      url: webhookEndpoint.url,
      events: webhookEndpoint.events,
      active: webhookEndpoint.active,
      createdAt: webhookEndpoint.createdAt,
    })
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.orgId, orgId))
    .orderBy(webhookEndpoint.createdAt);
}

export async function getWebhookDeliveries(endpointId: string, limit = 20) {
  return db
    .select()
    .from(webhookDelivery)
    .where(eq(webhookDelivery.endpointId, endpointId))
    .orderBy(desc(webhookDelivery.attemptedAt))
    .limit(limit);
}
