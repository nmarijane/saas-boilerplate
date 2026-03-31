import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const presenceStatusEnum = pgEnum("presence_status", ["online", "idle", "offline"]);

export const userPresence = pgTable("user_presence", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  currentPage: text("current_page").notNull().default("/dashboard"),
  status: presenceStatusEnum("status").notNull().default("online"),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
}, (t) => [
  index("presence_org_status_idx").on(t.organizationId, t.status),
  index("presence_user_org_idx").on(t.userId, t.organizationId),
]);
