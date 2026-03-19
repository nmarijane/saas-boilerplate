import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const webhookEndpoint = pgTable("webhook_endpoint", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("webhook_endpoint_org_id_idx").on(t.orgId),
]);

export const webhookDelivery = pgTable("webhook_delivery", {
  id: text("id").primaryKey(),
  endpointId: text("endpoint_id")
    .notNull()
    .references(() => webhookEndpoint.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
  nextRetryAt: timestamp("next_retry_at"),
  attemptNumber: integer("attempt_number").notNull().default(1),
}, (t) => [
  index("webhook_delivery_endpoint_id_idx").on(t.endpointId),
]);
