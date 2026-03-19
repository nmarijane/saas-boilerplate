"use server";

import { desc, eq } from "drizzle-orm";
import { webhookDelivery, webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";

export async function getWebhookEndpointsForOrg(orgId: string) {
  return db
    .select()
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
