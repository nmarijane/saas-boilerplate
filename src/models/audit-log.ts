import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_log_org_created_idx").on(t.orgId, t.createdAt),
  index("audit_log_org_action_idx").on(t.orgId, t.action),
]);
