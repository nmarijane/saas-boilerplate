import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

// The example entity: a workspace's projects. `status` is plain text holding one
// of PROJECT_STATUSES (features/projects/schemas.ts), which the actions validate.
export const project = pgTable("project", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("project_org_updated_idx").on(t.organizationId, t.updatedAt),
]);
