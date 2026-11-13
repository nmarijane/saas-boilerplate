import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const notification = pgTable("notification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // The workspace the notification is about, whose pages its link opens; null
  // for one that is the account's. It goes with its workspace.
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  // Its words: the messages of its type (`notifications.events.<type>`), drawn
  // in the reader's language with `values`. Stored text is for a type that has
  // no message, as a job or a webhook may write.
  title: text("title"),
  body: text("body"),
  values: jsonb("values").$type<Record<string, string>>(),
  read: boolean("read").notNull().default(false),
  type: text("type").notNull().default("info"),
  link: text("link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("notification_user_id_idx").on(t.userId),
  index("notification_user_read_idx").on(t.userId, t.read),
  index("notification_org_id_idx").on(t.organizationId),
]);
