-- Migration: Initial database schema
-- Created: 2026-03-17

CREATE TYPE "org_role" AS ENUM ('owner', 'admin', 'member');

-- Better Auth tables
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "is_admin" BOOLEAN NOT NULL DEFAULT false,
  "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expires_at" TIMESTAMP NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP,
  "refresh_token_expires_at" TIMESTAMP,
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Organization & RBAC
CREATE TABLE "organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "logo" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "organization_member" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "role" "org_role" NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Billing
CREATE TABLE "plan" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stripe_price_id" TEXT,
  "features" JSON DEFAULT '{}',
  "limits" JSON DEFAULT '{}',
  "price" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "subscription" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "plan_id" TEXT NOT NULL REFERENCES "plan"("id"),
  "current_period_end" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE "notification" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "type" TEXT NOT NULL DEFAULT 'info',
  "link" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Feedback
CREATE TABLE "feedback" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "organization_id" TEXT REFERENCES "organization"("id") ON DELETE SET NULL,
  "type" TEXT NOT NULL DEFAULT 'other',
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Uploads
CREATE TABLE "upload" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "organization_id" TEXT REFERENCES "organization"("id") ON DELETE SET NULL,
  "filename" TEXT NOT NULL,
  "mimetype" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Changelog
CREATE TABLE "changelog_entry" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" TEXT,
  "published_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);
