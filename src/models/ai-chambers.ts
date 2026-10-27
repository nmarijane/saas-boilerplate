import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const toolTypeEnum = pgEnum("ai_chambers_tool_type", ["form", "chat"]);
export const toolStatusEnum = pgEnum("ai_chambers_tool_status", [
  "draft",
  "published",
  "archived",
]);
export const solutionTypeEnum = pgEnum("ai_chambers_solution_type", [
  "workflow",
  "agent",
  "chat",
]);
export const solutionStatusEnum = pgEnum("ai_chambers_solution_status", [
  "draft",
  "published",
  "archived",
]);
export const runStatusEnum = pgEnum("ai_chambers_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("ai_chambers_payment_status", [
  "pending",
  "paid",
  "cancelled",
  "failed",
]);
export const assignmentStatusEnum = pgEnum("ai_chambers_assignment_status", [
  "active",
  "inactive",
]);

export const aiTools = pgTable(
  "ai_chambers_tools",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    instructions: text("instructions"),
    type: toolTypeEnum("type").notNull(),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>().default([]),
    status: toolStatusEnum("status").notNull().default("draft"),
    schema: jsonb("schema").$type<Record<string, unknown>>(),
    integrationRef: text("integration_ref"),
    pricing: jsonb("pricing").$type<{
      priceId?: string;
      amount?: number;
      currency?: string;
      enabled?: boolean;
    }>(),
    version: text("version"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_chambers_tools_status_idx").on(t.status),
    index("ai_chambers_tools_slug_idx").on(t.slug),
  ],
);

export const aiSolutions = pgTable(
  "ai_chambers_solutions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    type: solutionTypeEnum("type").notNull(),
    status: solutionStatusEnum("status").notNull().default("draft"),
    definition: jsonb("definition").$type<Record<string, unknown>>(),
    integrationRef: text("integration_ref"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("ai_chambers_solutions_status_idx").on(t.status)],
);

export const solutionAssignments = pgTable(
  "ai_chambers_solution_assignments",
  {
    id: text("id").primaryKey(),
    solutionId: text("solution_id")
      .notNull()
      .references(() => aiSolutions.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: assignmentStatusEnum("status").notNull().default("active"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ai_chambers_solution_assignments_unique").on(
      t.solutionId,
      t.organizationId,
    ),
    index("ai_chambers_solution_assignments_org_idx").on(t.organizationId),
  ],
);

export const aiRuns = pgTable(
  "ai_chambers_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toolId: text("tool_id").references(() => aiTools.id),
    solutionId: text("solution_id").references(() => aiSolutions.id),
    status: runStatusEnum("status").notNull().default("queued"),
    input: jsonb("input").$type<Record<string, unknown>>(),
    config: jsonb("config").$type<Record<string, unknown>>(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    paymentStatus: paymentStatusEnum("payment_status").default("pending"),
    stripeSessionId: text("stripe_session_id"),
    n8nExecutionId: text("n8n_execution_id"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_chambers_runs_org_idx").on(t.organizationId),
    index("ai_chambers_runs_user_idx").on(t.userId),
    index("ai_chambers_runs_status_idx").on(t.status),
    index("ai_chambers_runs_idempotency_idx").on(t.idempotencyKey),
  ],
);

export const aiSubmissions = pgTable(
  "ai_chambers_submissions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => aiRuns.id),
    toolId: text("tool_id")
      .notNull()
      .references(() => aiTools.id),
    formData: jsonb("form_data").$type<Record<string, unknown>>(),
    files: jsonb("files")
      .$type<Array<{ fileId: string; name: string; size: number }>>()
      .default([]),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    amount: integer("amount"),
    currency: text("currency").default("AUD"),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    jobId: text("job_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_chambers_submissions_org_idx").on(t.organizationId),
    index("ai_chambers_submissions_stripe_session_idx").on(t.stripeSessionId),
  ],
);

export const aiFiles = pgTable(
  "ai_chambers_files",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => aiRuns.id),
    submissionId: text("submission_id").references(() => aiSubmissions.id),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    bucket: text("bucket"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_chambers_files_org_idx").on(t.organizationId),
    index("ai_chambers_files_run_idx").on(t.runId),
  ],
);

export const aiAudit = pgTable(
  "ai_chambers_audit",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => user.id),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_chambers_audit_org_idx").on(t.organizationId),
    index("ai_chambers_audit_action_idx").on(t.action),
  ],
);
