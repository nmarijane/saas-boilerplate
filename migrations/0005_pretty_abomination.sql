CREATE TYPE "public"."ai_chambers_assignment_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."ai_chambers_payment_status" AS ENUM('pending', 'paid', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_chambers_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ai_chambers_solution_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ai_chambers_solution_type" AS ENUM('workflow', 'agent', 'chat');--> statement-breakpoint
CREATE TYPE "public"."ai_chambers_tool_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ai_chambers_tool_type" AS ENUM('form', 'chat');--> statement-breakpoint
CREATE TABLE "ai_chambers_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"user_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chambers_files" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"run_id" text,
	"submission_id" text,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"bucket" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chambers_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tool_id" text,
	"solution_id" text,
	"status" "ai_chambers_run_status" DEFAULT 'queued' NOT NULL,
	"input" jsonb,
	"config" jsonb,
	"result" jsonb,
	"error" text,
	"payment_status" "ai_chambers_payment_status" DEFAULT 'pending',
	"stripe_session_id" text,
	"n8n_execution_id" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chambers_solutions" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "ai_chambers_solution_type" NOT NULL,
	"status" "ai_chambers_solution_status" DEFAULT 'draft' NOT NULL,
	"definition" jsonb,
	"integration_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_chambers_solutions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_chambers_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text,
	"tool_id" text NOT NULL,
	"form_data" jsonb,
	"files" jsonb DEFAULT '[]'::jsonb,
	"payment_status" "ai_chambers_payment_status" DEFAULT 'pending' NOT NULL,
	"amount" integer,
	"currency" text DEFAULT 'AUD',
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"job_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_chambers_submissions_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "ai_chambers_tools" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"instructions" text,
	"type" "ai_chambers_tool_type" NOT NULL,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" "ai_chambers_tool_status" DEFAULT 'draft' NOT NULL,
	"schema" jsonb,
	"integration_ref" text,
	"pricing" jsonb,
	"version" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_chambers_tools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_chambers_solution_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"solution_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" "ai_chambers_assignment_status" DEFAULT 'active' NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chambers_audit" ADD CONSTRAINT "ai_chambers_audit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_audit" ADD CONSTRAINT "ai_chambers_audit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_files" ADD CONSTRAINT "ai_chambers_files_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_files" ADD CONSTRAINT "ai_chambers_files_run_id_ai_chambers_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_chambers_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_files" ADD CONSTRAINT "ai_chambers_files_submission_id_ai_chambers_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."ai_chambers_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_runs" ADD CONSTRAINT "ai_chambers_runs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_runs" ADD CONSTRAINT "ai_chambers_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_runs" ADD CONSTRAINT "ai_chambers_runs_tool_id_ai_chambers_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."ai_chambers_tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_runs" ADD CONSTRAINT "ai_chambers_runs_solution_id_ai_chambers_solutions_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."ai_chambers_solutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_submissions" ADD CONSTRAINT "ai_chambers_submissions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_submissions" ADD CONSTRAINT "ai_chambers_submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_submissions" ADD CONSTRAINT "ai_chambers_submissions_run_id_ai_chambers_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_chambers_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_submissions" ADD CONSTRAINT "ai_chambers_submissions_tool_id_ai_chambers_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."ai_chambers_tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_solution_assignments" ADD CONSTRAINT "ai_chambers_solution_assignments_solution_id_ai_chambers_solutions_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."ai_chambers_solutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chambers_solution_assignments" ADD CONSTRAINT "ai_chambers_solution_assignments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chambers_audit_org_idx" ON "ai_chambers_audit" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_audit_action_idx" ON "ai_chambers_audit" USING btree ("action");--> statement-breakpoint
CREATE INDEX "ai_chambers_files_org_idx" ON "ai_chambers_files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_files_run_idx" ON "ai_chambers_files" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_runs_org_idx" ON "ai_chambers_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_runs_user_idx" ON "ai_chambers_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_runs_status_idx" ON "ai_chambers_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_chambers_runs_idempotency_idx" ON "ai_chambers_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_chambers_solutions_status_idx" ON "ai_chambers_solutions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_chambers_submissions_org_idx" ON "ai_chambers_submissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_submissions_stripe_session_idx" ON "ai_chambers_submissions" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_tools_status_idx" ON "ai_chambers_tools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_chambers_tools_slug_idx" ON "ai_chambers_tools" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_chambers_solution_assignments_unique" ON "ai_chambers_solution_assignments" USING btree ("solution_id","organization_id");--> statement-breakpoint
CREATE INDEX "ai_chambers_solution_assignments_org_idx" ON "ai_chambers_solution_assignments" USING btree ("organization_id");