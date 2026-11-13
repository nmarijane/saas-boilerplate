import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const plan = pgTable("plan", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  stripePriceId: text("stripe_price_id"),
  features: json("features").$type<Record<string, boolean>>().default({}),
  limits: json("limits").$type<Record<string, number>>().default({}),
  price: integer("price").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("active"),
  planId: text("plan_id")
    .notNull()
    .references(() => plan.id),
  currentPeriodEnd: timestamp("current_period_end"),
  /** "month" or "year": the interval of the price the subscription is on. Null for a workspace with no paid subscription. */
  billingInterval: text("billing_interval"),
  /** The subscription ends at the end of the period it has paid for. */
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  /** When the trial ends, while the subscription is trialing. */
  trialEnd: timestamp("trial_end"),
  /** The language the checkout was opened in: the e-mails about the subscription are written in it. */
  locale: text("locale"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("subscription_org_id_idx").on(t.organizationId),
]);


/**
 * The events of the payment provider that were taken in. A delivery is claimed
 * here before it is handled, so that one delivered twice, or at once by two
 * servers, changes nothing the second time. `processing` is a claim that has a
 * lease (`updatedAt`): a handler that died leaves one that is taken again.
 */
export const stripeEvent = pgTable("stripe_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("processing"), // "processing" | "done"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
