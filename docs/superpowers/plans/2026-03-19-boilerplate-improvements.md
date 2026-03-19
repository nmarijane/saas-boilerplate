# Boilerplate Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event bus, audit log, rate limiting (adapter), background jobs (Inngest), monitoring (Sentry + healthcheck), API keys, webhooks, feature flags, CI/CD, wired settings, real dashboard, changelog admin, example tests, storybook stories, and a11y tests to the SaaS boilerplate.

**Architecture:** Event bus (`emitEvent()`) is the central piece connecting audit log, webhooks, and notifications. Inngest handles async jobs (emails, webhook delivery, cron). Rate limiting uses adapter pattern (memory/redis/upstash). Feature flags are DB-backed with in-memory cache.

**Tech Stack:** Next.js 16 / 15.3 (App Router), Drizzle ORM, Inngest, @sentry/nextjs, @upstash/ratelimit, ioredis, @axe-core/playwright

**Spec:** `docs/superpowers/specs/2026-03-19-boilerplate-improvements-design.md`

---

## File Map

### New files to create:
```
# Lot 1 — Fondations
src/models/audit-log.ts
src/models/api-key.ts
src/models/webhook.ts
src/models/feature-flag.ts
src/shared/lib/rate-limit/types.ts
src/shared/lib/rate-limit/memory.ts
src/shared/lib/rate-limit/redis.ts
src/shared/lib/rate-limit/upstash.ts
src/shared/lib/rate-limit/index.ts
src/features/events/types.ts
src/features/events/emitter.ts
src/features/events/handlers/audit-log.ts
src/features/events/handlers/webhook.ts
src/features/events/handlers/notification.ts
.github/workflows/ci.yml

# Lot 2 — Background Jobs & Monitoring
src/shared/lib/inngest/client.ts
src/features/jobs/functions/send-email.ts
src/features/jobs/functions/deliver-webhook.ts
src/features/jobs/functions/purge-audit-logs.ts
src/features/jobs/index.ts
src/app/api/inngest/route.ts
src/app/api/health/route.ts
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
src/instrumentation.ts

# Lot 3 — Features SaaS avancées
src/features/audit/queries.ts
src/features/audit/components/audit-log-table.tsx
src/features/api-keys/actions.ts
src/features/api-keys/queries.ts
src/features/api-keys/helpers.ts
src/features/api-keys/components/api-key-list.tsx
src/features/api-keys/components/create-key-modal.tsx
src/features/webhooks/actions.ts
src/features/webhooks/queries.ts
src/features/webhooks/matching.ts
src/features/webhooks/components/webhook-list.tsx
src/features/webhooks/components/create-webhook-modal.tsx
src/features/feature-flags/queries.ts
src/features/feature-flags/actions.ts
src/features/feature-flags/helpers.ts
src/features/feature-flags/components/feature-gate.tsx
src/features/feature-flags/components/flag-admin-table.tsx
src/features/feature-flags/hooks/use-feature-flag.ts
src/app/[locale]/(admin)/admin/audit/page.tsx
src/app/[locale]/(admin)/admin/features/page.tsx
src/app/[locale]/(app)/settings/api/page.tsx
src/app/api/features/[key]/route.ts
src/shared/lib/api-key-auth.ts

# Lot 4 — Câblage & Polish
src/features/settings/actions.ts
src/features/dashboard/queries.ts
src/features/changelog/actions.ts
src/app/[locale]/(admin)/admin/changelog/page.tsx
tests/unit/actions/feedback.test.ts
tests/unit/queries/notifications.test.ts
tests/unit/webhook-handler.test.ts
tests/e2e/onboarding.e2e.ts
tests/e2e/a11y.e2e.ts
src/shared/components/ui/button.stories.tsx
src/shared/components/data/data-table.stories.tsx
```

### Existing files to modify:
```
src/models/index.ts                          # Add new model exports
src/shared/lib/env.ts                        # Add new env vars
src/middleware.ts                             # Replace rate limiter
src/features/billing/webhook-handlers.ts     # Add emitEvent() calls
src/features/notifications/actions.ts        # Used by event handler
src/features/auth/auth.ts                    # Keep sync email (no change, just verify)
.env.example                                 # Add new env vars
package.json                                 # Add new dependencies
src/locales/en.json                          # Add new translation keys
src/locales/fr.json                          # Add new translation keys
next.config.ts                               # Add Sentry config
vitest.config.mts                            # Add setup file if needed
src/app/[locale]/(app)/dashboard/page.tsx    # Wire real data
src/app/[locale]/(app)/settings/profile/page.tsx   # Wire form
src/app/[locale]/(app)/settings/notifications/page.tsx  # Wire form
src/app/[locale]/(app)/settings/danger/page.tsx    # Wire delete
src/app/[locale]/(admin)/layout.tsx           # Add nav links
```

---

## CHECKPOINT: Lot 1 — Fondations

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

```bash
npm install inngest @sentry/nextjs @upstash/ratelimit ioredis @axe-core/playwright
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D @types/ioredis
```

- [ ] **Step 3: Verify install succeeded**

Run: `npm ls inngest @sentry/nextjs @upstash/ratelimit ioredis`
Expected: All packages listed without errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add inngest, sentry, upstash, ioredis, axe-core dependencies"
```

---

### Task 2: Add new environment variables

**Files:**
- Modify: `src/shared/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update T3 Env config**

In `src/shared/lib/env.ts`, add these server vars inside `server: { ... }` after the existing S3 vars:

```typescript
    // Rate limiting
    RATE_LIMIT_ADAPTER: z.enum(["memory", "redis", "upstash"]).default("memory"),
    REDIS_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    // Audit
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    // Sentry (server)
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    // Inngest
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),
```

Add to `client: { ... }` section (after existing client vars):

```typescript
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
```

Add matching entries in `runtimeEnv: { ... }`:

```typescript
    RATE_LIMIT_ADAPTER: process.env.RATE_LIMIT_ADAPTER,
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    AUDIT_LOG_RETENTION_DAYS: process.env.AUDIT_LOG_RETENTION_DAYS,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
```

- [ ] **Step 2: Update .env.example**

Append to `.env.example`:

```env

# Rate Limiting (adapter: memory | redis | upstash)
RATE_LIMIT_ADAPTER=memory
# REDIS_URL=redis://localhost:6379
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=

# Audit Log
AUDIT_LOG_RETENTION_DAYS=90

# Sentry (optional)
# SENTRY_DSN=
# NEXT_PUBLIC_SENTRY_DSN=
# SENTRY_ORG=
# SENTRY_PROJECT=

# Inngest (optional, auto-detected in dev)
# INNGEST_EVENT_KEY=
# INNGEST_SIGNING_KEY=
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/env.ts .env.example
git commit -m "feat: add env vars for rate limiting, audit, sentry, inngest"
```

---

### Task 3: Create DB models (audit_log, api_key, webhook_endpoint, webhook_delivery, feature_flag)

**Files:**
- Create: `src/models/audit-log.ts`
- Create: `src/models/api-key.ts`
- Create: `src/models/webhook.ts`
- Create: `src/models/feature-flag.ts`
- Modify: `src/models/index.ts`

- [ ] **Step 1: Create audit-log model**

Create `src/models/audit-log.ts`:

```typescript
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
```

- [ ] **Step 2: Create api-key model**

Create `src/models/api-key.ts`:

```typescript
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const apiKey = pgTable("api_key", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (t) => [
  index("api_key_org_id_idx").on(t.orgId),
  index("api_key_hash_idx").on(t.hash),
]);
```

- [ ] **Step 3: Create webhook models**

Create `src/models/webhook.ts`:

```typescript
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
```

- [ ] **Step 4: Create feature-flag model**

Create `src/models/feature-flag.ts`:

```typescript
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

interface FeatureFlagRule {
  type: "plan" | "org";
  value: string;
}

export const featureFlag = pgTable("feature_flag", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  rules: jsonb("rules").$type<FeatureFlagRule[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

- [ ] **Step 5: Update models index**

Replace the content of `src/models/index.ts`:

```typescript
export * from "./changelog";
export * from "./feedback";
export * from "./notification";
export * from "./organization";
export * from "./subscription";
export * from "./upload";
export * from "./user";
export * from "./audit-log";
export * from "./api-key";
export * from "./webhook";
export * from "./feature-flag";
```

- [ ] **Step 6: Generate migration**

Run: `npm run db:generate`
Expected: New migration file in `migrations/` directory

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/models/ migrations/
git commit -m "feat: add audit_log, api_key, webhook, feature_flag DB models"
```

---

### Task 4: Rate limiting adapter

**Files:**
- Create: `src/shared/lib/rate-limit/types.ts`
- Create: `src/shared/lib/rate-limit/memory.ts`
- Create: `src/shared/lib/rate-limit/redis.ts`
- Create: `src/shared/lib/rate-limit/upstash.ts`
- Create: `src/shared/lib/rate-limit/index.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Create rate limit types**

Create `src/shared/lib/rate-limit/types.ts`:

```typescript
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitAdapter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}
```

- [ ] **Step 2: Create memory adapter**

Create `src/shared/lib/rate-limit/memory.ts`:

```typescript
import type { RateLimitAdapter, RateLimitResult } from "./types";

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
let lastPrune = 0;
const PRUNE_INTERVAL = 60_000;

function prune(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export class MemoryRateLimiter implements RateLimitAdapter {
  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      prune(now);
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    entry.count++;
    const allowed = entry.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }
}
```

- [ ] **Step 3: Create Redis adapter**

Create `src/shared/lib/rate-limit/redis.ts`:

```typescript
import type { RateLimitAdapter, RateLimitResult } from "./types";

/**
 * Redis rate limiter using ioredis (sliding window).
 * Node.js runtime only — NOT compatible with Edge Runtime.
 */
export class RedisRateLimiter implements RateLimitAdapter {
  private redis: import("ioredis").default | null = null;

  constructor(private readonly redisUrl: string) {}

  private async getClient() {
    if (!this.redis) {
      const { default: Redis } = await import("ioredis");
      this.redis = new Redis(this.redisUrl);
    }
    return this.redis;
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const client = await this.getClient();
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;
    const redisKey = `rate_limit:${key}`;

    const multi = client.multi();
    multi.zremrangebyscore(redisKey, 0, windowStart);
    multi.zadd(redisKey, now.toString(), `${now}:${Math.random()}`);
    multi.zcard(redisKey);
    multi.expire(redisKey, windowSeconds);

    const results = await multi.exec();
    const count = (results?.[2]?.[1] as number) ?? 1;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + windowMs,
    };
  }
}
```

- [ ] **Step 4: Create Upstash adapter**

Create `src/shared/lib/rate-limit/upstash.ts`:

```typescript
import type { RateLimitAdapter, RateLimitResult } from "./types";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Upstash rate limiter — Edge Runtime compatible (HTTP-based).
 */
export class UpstashRateLimiter implements RateLimitAdapter {
  private limiters = new Map<string, Ratelimit>();

  constructor(
    private readonly restUrl: string,
    private readonly restToken: string,
  ) {}

  private getLimiter(limit: number, windowSeconds: number): Ratelimit {
    const cacheKey = `${limit}:${windowSeconds}`;
    let limiter = this.limiters.get(cacheKey);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: new Redis({ url: this.restUrl, token: this.restToken }),
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      });
      this.limiters.set(cacheKey, limiter);
    }
    return limiter;
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const limiter = this.getLimiter(limit, windowSeconds);
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }
}
```

- [ ] **Step 5: Create rate limit factory**

Create `src/shared/lib/rate-limit/index.ts`:

```typescript
import type { RateLimitAdapter } from "./types";

export type { RateLimitAdapter, RateLimitResult } from "./types";

let _rateLimiter: RateLimitAdapter | null = null;
let _edgeRateLimiter: RateLimitAdapter | null = null;

/**
 * Get rate limiter for API routes and server actions (Node.js runtime).
 * Supports all adapters: memory, redis, upstash.
 */
export async function getRateLimiter(): Promise<RateLimitAdapter> {
  if (_rateLimiter) return _rateLimiter;

  const adapter = process.env.RATE_LIMIT_ADAPTER ?? "memory";

  switch (adapter) {
    case "redis": {
      const url = process.env.REDIS_URL;
      if (!url) throw new Error("REDIS_URL required when RATE_LIMIT_ADAPTER=redis");
      const { RedisRateLimiter } = await import("./redis");
      _rateLimiter = new RedisRateLimiter(url);
      break;
    }
    case "upstash": {
      const restUrl = process.env.UPSTASH_REDIS_REST_URL;
      const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!restUrl || !restToken)
        throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required when RATE_LIMIT_ADAPTER=upstash");
      const { UpstashRateLimiter } = await import("./upstash");
      _rateLimiter = new UpstashRateLimiter(restUrl, restToken);
      break;
    }
    default: {
      const { MemoryRateLimiter } = await import("./memory");
      _rateLimiter = new MemoryRateLimiter();
    }
  }

  return _rateLimiter;
}

/**
 * Get rate limiter for Edge Runtime (middleware).
 * Only supports: memory, upstash. Throws if redis is configured.
 */
export async function getEdgeRateLimiter(): Promise<RateLimitAdapter> {
  if (_edgeRateLimiter) return _edgeRateLimiter;

  const adapter = process.env.RATE_LIMIT_ADAPTER ?? "memory";

  if (adapter === "redis") {
    throw new Error(
      "Redis rate limiter is not compatible with Edge Runtime. Use 'memory' or 'upstash' for middleware rate limiting.",
    );
  }

  if (adapter === "upstash") {
    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!restUrl || !restToken)
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required");
    const { UpstashRateLimiter } = await import("./upstash");
    _edgeRateLimiter = new UpstashRateLimiter(restUrl, restToken);
  } else {
    const { MemoryRateLimiter } = await import("./memory");
    _edgeRateLimiter = new MemoryRateLimiter();
  }

  return _edgeRateLimiter;
}
```

- [ ] **Step 6: Update middleware to use adapter**

Replace `src/middleware.ts` entirely:

```typescript
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/shared/lib/i18n-routing";
import { getEdgeRateLimiter } from "@/shared/lib/rate-limit";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting on API routes
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const limiter = await getEdgeRateLimiter();
    const result = await limiter.check(`ip:${ip}`, 100, 60);

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMIT", status: 429 },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.resetAt),
          },
        },
      );
    }
    return NextResponse.next();
  }

  // 2. i18n middleware (handles locale detection and redirection)
  const response = intlMiddleware(request);

  // 3. Auth guards — protect (app) and (admin) routes
  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value;
  const localeMatch = pathname.match(/^\/(en|fr)/);
  const pathWithoutLocale = localeMatch
    ? pathname.slice(localeMatch[0].length)
    : pathname;

  const isAppRoute = pathWithoutLocale.startsWith("/dashboard") ||
    pathWithoutLocale.startsWith("/settings") ||
    pathWithoutLocale.startsWith("/onboarding");
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");

  if ((isAppRoute || isAdminRoute) && !sessionToken) {
    const locale = localeMatch?.[1] ?? routing.defaultLocale;
    const signInUrl = new URL(`/${locale}/sign-in`, request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except static files and Next.js internals
    "/((?!_next|.*\\..*).*)",
  ],
};
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/shared/lib/rate-limit/ src/middleware.ts
git commit -m "feat: add rate limiting adapter (memory/redis/upstash) and update middleware"
```

---

### Task 5: Event bus + handlers

**Files:**
- Create: `src/features/events/types.ts`
- Create: `src/features/events/emitter.ts`
- Create: `src/features/events/handlers/audit-log.ts`
- Create: `src/features/events/handlers/webhook.ts`
- Create: `src/features/events/handlers/notification.ts`

- [ ] **Step 1: Create event types**

Create `src/features/events/types.ts`:

```typescript
export interface EventPayload {
  orgId: string;
  actorId?: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export type EventName =
  | "member.invited"
  | "member.removed"
  | "member.role_changed"
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "payment.succeeded"
  | "payment.failed"
  | "api_key.created"
  | "api_key.revoked"
  | "webhook.created"
  | "webhook.deleted"
  | "feature_flag.updated"
  | "feedback.created"
  | "upload.created";

export interface AppEvent {
  name: EventName;
  payload: EventPayload;
  timestamp: Date;
}
```

- [ ] **Step 2: Create audit-log handler**

Create `src/features/events/handlers/audit-log.ts`:

```typescript
import type { AppEvent } from "../types";
import { auditLog } from "@/models/audit-log";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

export async function handleAuditLog(event: AppEvent): Promise<void> {
  await db.insert(auditLog).values({
    id: generateId(),
    orgId: event.payload.orgId,
    actorId: event.payload.actorId ?? null,
    action: event.name,
    resourceType: event.payload.resourceType,
    resourceId: event.payload.resourceId,
    metadata: event.payload.metadata ?? null,
    ipAddress: event.payload.ip ?? null,
    userAgent: event.payload.userAgent ?? null,
  });
}
```

- [ ] **Step 3: Create webhook handler (placeholder — wired fully in Lot 2 with Inngest)**

Create `src/features/events/handlers/webhook.ts`:

```typescript
import type { AppEvent } from "../types";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["events", "webhook"]);

/**
 * Dispatches webhook deliveries for matching endpoints.
 * Uses Inngest for async delivery with retry — wired in Lot 2.
 * Before Inngest is set up, this is a no-op that logs the event.
 */
export async function handleWebhook(event: AppEvent): Promise<void> {
  try {
    // Dynamic import to avoid errors when inngest is not yet configured
    const { inngest } = await import("@/shared/lib/inngest/client");
    const { eq, and } = await import("drizzle-orm");
    const { webhookEndpoint } = await import("@/models/webhook");
    const { db } = await import("@/shared/lib/DB");

    const endpoints = await db
      .select()
      .from(webhookEndpoint)
      .where(
        and(
          eq(webhookEndpoint.orgId, event.payload.orgId),
          eq(webhookEndpoint.active, true),
        ),
      );

    const { matchEvent } = await import("@/features/webhooks/matching");

    for (const endpoint of endpoints) {
      if (matchEvent(event.name, endpoint.events)) {
        await inngest.send({
          name: "webhook/deliver",
          data: {
            endpointId: endpoint.id,
            url: endpoint.url,
            secret: endpoint.secret,
            event: event.name,
            payload: {
              event: event.name,
              data: event.payload,
              timestamp: event.timestamp.toISOString(),
            },
          },
        });
      }
    }
  } catch {
    logger.debug`Webhook handler skipped (Inngest not configured): ${event.name}`;
  }
}
```

- [ ] **Step 4: Create notification handler**

Create `src/features/events/handlers/notification.ts`:

```typescript
import type { AppEvent } from "../types";
import { getLogger } from "@logtape/logtape";
import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const logger = getLogger(["events", "notification"]);

/**
 * Map of events to notification config.
 * Only events listed here generate notifications.
 */
const NOTIFICATION_MAP: Record<string, { title: string; body: string; type: string }> = {
  "payment.failed": {
    title: "Payment failed",
    body: "Your subscription payment has failed. Please update your payment method.",
    type: "billing",
  },
  "member.invited": {
    title: "New member invited",
    body: "A new team member has been invited to your organization.",
    type: "info",
  },
  "subscription.cancelled": {
    title: "Subscription cancelled",
    body: "Your subscription has been cancelled.",
    type: "billing",
  },
};

export async function handleNotification(event: AppEvent): Promise<void> {
  const config = NOTIFICATION_MAP[event.name];
  if (!config) return; // Event doesn't generate a notification

  try {
    // Find the org owner to notify
    const { organizationMember } = await import("@/models/organization");
    const { and, eq } = await import("drizzle-orm");

    const owner = await db.query.organizationMember.findFirst({
      where: and(
        eq(organizationMember.organizationId, event.payload.orgId),
        eq(organizationMember.role, "owner"),
      ),
    });

    if (!owner) return;

    await db.insert(notification).values({
      id: generateId(),
      userId: owner.userId,
      title: config.title,
      body: config.body,
      type: config.type,
    });
  } catch (error) {
    logger.error`Failed to create notification for ${event.name}: ${error}`;
  }
}
```

- [ ] **Step 5: Create event emitter**

Create `src/features/events/emitter.ts`:

```typescript
import type { EventName, EventPayload } from "./types";
import { getLogger } from "@logtape/logtape";
import { handleAuditLog } from "./handlers/audit-log";
import { handleNotification } from "./handlers/notification";
import { handleWebhook } from "./handlers/webhook";

const logger = getLogger(["events"]);

/**
 * Emit an application event. This is the single entry point for all event handling.
 *
 * - Audit log: synchronous, errors propagate to caller
 * - Webhook delivery: async (via Inngest), errors logged but don't block
 * - Notifications: synchronous, errors logged but don't block
 */
export async function emitEvent(name: EventName, payload: EventPayload): Promise<void> {
  const event = { name, payload, timestamp: new Date() };

  // Audit log is critical — errors propagate
  await handleAuditLog(event);

  // Webhooks are non-critical — errors are logged
  handleWebhook(event).catch((error) => {
    logger.error`Webhook handler failed for ${name}: ${error}`;
  });

  // Notifications are non-critical — errors are logged
  handleNotification(event).catch((error) => {
    logger.error`Notification handler failed for ${name}: ${error}`;
  });
}
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors (webhook handler may warn about missing inngest — OK, wired in Lot 2)

- [ ] **Step 7: Commit**

```bash
git add src/features/events/
git commit -m "feat: add event bus with audit log, webhook, and notification handlers"
```

---

### Task 5b: Wire emitEvent() into existing billing webhook handlers

**Files:**
- Modify: `src/features/billing/webhook-handlers.ts`

- [ ] **Step 1: Add emitEvent imports and calls**

In `src/features/billing/webhook-handlers.ts`, add import at the top:

```typescript
import { emitEvent } from "@/features/events/emitter";
```

Then add `emitEvent()` calls after each DB mutation in the 5 handlers:

- `handleCheckoutCompleted`: after subscription insert/update, add `await emitEvent("subscription.created", { orgId, resourceType: "subscription", resourceId: sub.id ?? planId, metadata: { planId } });`
- `handleInvoicePaid`: add `await emitEvent("payment.succeeded", { orgId: sub.organizationId, resourceType: "subscription", resourceId: sub.id });`
- `handleInvoicePaymentFailed`: add `await emitEvent("payment.failed", { orgId: sub.organizationId, resourceType: "subscription", resourceId: sub.id });`
- `handleSubscriptionUpdated`: add `await emitEvent("subscription.updated", { orgId, resourceType: "subscription", resourceId: orgId, metadata: { planId } });`
- `handleSubscriptionDeleted`: add `await emitEvent("subscription.cancelled", { orgId, resourceType: "subscription", resourceId: orgId });`

**Note:** Once `emitEvent()` is wired, the direct `notifyOrgOwner()` calls can be removed since the event bus's notification handler will create notifications automatically. Remove the `notifyOrgOwner()` function and its calls.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/billing/webhook-handlers.ts
git commit -m "refactor: wire emitEvent() into billing webhook handlers, remove direct notification calls"
```

---

### Task 6: CI/CD GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "22"
  SKIP_ENV_VALIDATION: "true"

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run check:types

  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run test

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: nextjs-${{ hashFiles('package-lock.json') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
          restore-keys: nextjs-${{ hashFiles('package-lock.json') }}-
      - run: npm run build

  storybook:
    name: Storybook Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx storybook build --quiet
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add GitHub Actions CI workflow (lint, typecheck, test, build, storybook)"
```

---

## CHECKPOINT: Review Lot 1

Pause here. Verify:
- `npx tsc --noEmit` passes
- `npm run lint` passes
- Models and rate limiting code is clean
- Event bus structure is in place

---

## CHECKPOINT: Lot 2 — Background Jobs & Monitoring

### Task 7: Inngest setup

**Files:**
- Create: `src/shared/lib/inngest/client.ts`
- Create: `src/features/jobs/functions/send-email.ts`
- Create: `src/features/jobs/functions/deliver-webhook.ts`
- Create: `src/features/jobs/functions/purge-audit-logs.ts`
- Create: `src/features/jobs/index.ts`
- Create: `src/app/api/inngest/route.ts`

- [ ] **Step 1: Create Inngest client**

Create `src/shared/lib/inngest/client.ts`:

```typescript
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "saas-boilerplate",
});
```

- [ ] **Step 2: Create send-email job**

Create `src/features/jobs/functions/send-email.ts`:

```typescript
import type { ReactElement } from "react";
import { inngest } from "@/shared/lib/inngest/client";

export const sendEmailJob = inngest.createFunction(
  {
    id: "jobs/send-email",
    retries: 3,
  },
  { event: "jobs/send-email" },
  async ({ event }) => {
    const { sendEmail } = await import("@/features/email/send");
    const data = event.data as {
      to: string;
      subject: string;
      templateName: string;
      templateProps: Record<string, unknown>;
    };

    // Dynamic template import
    const templates = await import("@/features/email/templates");
    const Template = (templates as Record<string, (props: Record<string, unknown>) => ReactElement>)[data.templateName];
    if (!Template) throw new Error(`Unknown email template: ${data.templateName}`);

    await sendEmail({
      to: data.to,
      subject: data.subject,
      template: Template(data.templateProps),
    });
  },
);
```

- [ ] **Step 3: Create deliver-webhook job**

Create `src/features/jobs/functions/deliver-webhook.ts`:

```typescript
import { createHmac } from "node:crypto";
import { inngest } from "@/shared/lib/inngest/client";
import { db } from "@/shared/lib/DB";
import { webhookDelivery } from "@/models/webhook";
import { generateId } from "@/shared/utils/helpers";

export const deliverWebhookJob = inngest.createFunction(
  {
    id: "webhook/deliver",
    retries: 5,
  },
  { event: "webhook/deliver" },
  async ({ event }) => {
    const { endpointId, url, secret, event: eventName, payload } = event.data as {
      endpointId: string;
      url: string;
      secret: string;
      event: string;
      payload: Record<string, unknown>;
    };

    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    let statusCode: number | null = null;
    let responseBody: string | null = null;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": eventName,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      statusCode = response.status;
      responseBody = (await response.text()).slice(0, 1024);

      if (!response.ok) {
        throw new Error(`Webhook delivery failed: HTTP ${statusCode}`);
      }
    } catch (error) {
      // Log delivery attempt
      await db.insert(webhookDelivery).values({
        id: generateId(),
        endpointId,
        event: eventName,
        payload: payload as Record<string, unknown>,
        statusCode,
        responseBody: responseBody ?? (error instanceof Error ? error.message : "Unknown error"),
        attemptNumber: event.data.attempt ?? 1,
      });
      throw error; // Re-throw so Inngest retries
    }

    // Log successful delivery
    await db.insert(webhookDelivery).values({
      id: generateId(),
      endpointId,
      event: eventName,
      payload: payload as Record<string, unknown>,
      statusCode,
      responseBody,
      attemptNumber: event.data.attempt ?? 1,
    });
  },
);
```

- [ ] **Step 4: Create purge-audit-logs cron job**

Create `src/features/jobs/functions/purge-audit-logs.ts`:

```typescript
import { lt } from "drizzle-orm";
import { inngest } from "@/shared/lib/inngest/client";
import { auditLog } from "@/models/audit-log";
import { db } from "@/shared/lib/DB";

export const purgeAuditLogsJob = inngest.createFunction(
  {
    id: "audit/purge",
  },
  { cron: "0 3 * * *" }, // Daily at 3 AM
  async () => {
    const retentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? "90");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await db
      .delete(auditLog)
      .where(lt(auditLog.createdAt, cutoff));

    return { purged: result.rowCount ?? 0 };
  },
);
```

- [ ] **Step 5: Create jobs index**

Create `src/features/jobs/index.ts`:

```typescript
export { sendEmailJob } from "./functions/send-email";
export { deliverWebhookJob } from "./functions/deliver-webhook";
export { purgeAuditLogsJob } from "./functions/purge-audit-logs";
```

- [ ] **Step 6: Create Inngest API route**

Create `src/app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/shared/lib/inngest/client";
import { sendEmailJob, deliverWebhookJob, purgeAuditLogsJob } from "@/features/jobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendEmailJob, deliverWebhookJob, purgeAuditLogsJob],
});
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/shared/lib/inngest/ src/features/jobs/ src/app/api/inngest/
git commit -m "feat: add Inngest background jobs (email, webhook delivery, audit purge)"
```

---

### Task 8: Sentry + Healthcheck

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `src/instrumentation.ts`
- Modify: `next.config.ts`
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create Sentry client config**

Create `sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

- [ ] **Step 2: Create Sentry server config**

Create `sentry.server.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
```

- [ ] **Step 3: Create Sentry edge config**

Create `sentry.edge.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
```

- [ ] **Step 4: Create instrumentation file**

Create `src/instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
```

- [ ] **Step 5: Update next.config.ts to wrap with Sentry**

Read the current `next.config.ts`, then wrap the export with `withSentryConfig()`. The exact edit depends on the current content — wrap the default export:

```typescript
import { withSentryConfig } from "@sentry/nextjs";

// ... existing config ...

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  disableLogger: true,
});
```

**Important:** Only apply the Sentry wrapper if the current `next.config.ts` doesn't already use it. Read the file first to determine the exact edit needed.

- [ ] **Step 6: Create healthcheck endpoint**

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/shared/lib/DB";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};
  let healthy = true;

  // Check database
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
    healthy = false;
  }

  // Check Inngest configuration
  checks.inngest = (process.env.INNGEST_EVENT_KEY || process.env.NODE_ENV === "development")
    ? "ok"
    : "error";
  if (checks.inngest === "error") healthy = false;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts src/instrumentation.ts next.config.ts src/app/api/health/
git commit -m "feat: add Sentry error tracking and /api/health endpoint"
```

---

## CHECKPOINT: Review Lot 2

Pause here. Verify:
- `npx tsc --noEmit` passes
- `npm run lint` passes
- Inngest route handler exists
- Healthcheck responds

---

## CHECKPOINT: Lot 3 — Features SaaS avancées

### Task 9: Webhook event matching utility

**Files:**
- Create: `src/features/webhooks/matching.ts`

- [ ] **Step 1: Create matching utility**

Create `src/features/webhooks/matching.ts`:

```typescript
/**
 * Match an event name against a list of subscribed patterns.
 * Patterns: exact ("member.invited"), wildcard segment ("subscription.*"),
 * or wildcard all ("**").
 */
export function matchEvent(eventName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchPattern(eventName, pattern));
}

function matchPattern(eventName: string, pattern: string): boolean {
  if (pattern === "**") return true;
  if (pattern === eventName) return true;

  const eventParts = eventName.split(".");
  const patternParts = pattern.split(".");

  if (eventParts.length !== patternParts.length) return false;

  return patternParts.every(
    (part, i) => part === "*" || part === eventParts[i],
  );
}
```

- [ ] **Step 2: Write test for matching**

Create `tests/unit/webhook-matching.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { matchEvent } from "@/features/webhooks/matching";

describe("matchEvent", () => {
  it("matches exact event names", () => {
    expect(matchEvent("member.invited", ["member.invited"])).toBe(true);
    expect(matchEvent("member.invited", ["member.removed"])).toBe(false);
  });

  it("matches wildcard segments", () => {
    expect(matchEvent("subscription.created", ["subscription.*"])).toBe(true);
    expect(matchEvent("subscription.cancelled", ["subscription.*"])).toBe(true);
    expect(matchEvent("member.invited", ["subscription.*"])).toBe(false);
  });

  it("matches global wildcard", () => {
    expect(matchEvent("anything.here", ["**"])).toBe(true);
  });

  it("matches from a list of patterns", () => {
    expect(matchEvent("member.invited", ["subscription.*", "member.invited"])).toBe(true);
  });

  it("does not match different segment count", () => {
    expect(matchEvent("a.b.c", ["a.*"])).toBe(false);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx vitest run tests/unit/webhook-matching.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/features/webhooks/matching.ts tests/unit/webhook-matching.test.ts
git commit -m "feat: add webhook event matching with wildcard support"
```

---

### Task 10: API keys feature

**Files:**
- Create: `src/features/api-keys/helpers.ts`
- Create: `src/features/api-keys/actions.ts`
- Create: `src/features/api-keys/queries.ts`

- [ ] **Step 1: Create API key helpers**

Create `src/features/api-keys/helpers.ts`:

```typescript
import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX_LIVE = "sk_live_";
const KEY_PREFIX_TEST = "sk_test_";
const KEY_BYTES = 32;

export function generateApiKey(isTest = false): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(KEY_BYTES).toString("base64url");
  const prefix = isTest ? KEY_PREFIX_TEST : KEY_PREFIX_LIVE;
  const key = `${prefix}${raw}`;
  const hash = hashApiKey(key);
  const displayPrefix = key.slice(0, prefix.length + 4);

  return { key, prefix: displayPrefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
```

- [ ] **Step 2: Create API key actions**

Create `src/features/api-keys/actions.ts`:

```typescript
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiKey } from "@/models/api-key";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { emitEvent } from "@/features/events/emitter";
import { generateApiKey } from "./helpers";

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(["*"]),
  expiresAt: z.date().optional(),
});

export async function createApiKeyAction(
  orgId: string,
  userId: string,
  input: z.infer<typeof createApiKeySchema>,
) {
  const parsed = createApiKeySchema.parse(input);
  const { key, prefix, hash } = generateApiKey();
  const id = generateId();

  await db.insert(apiKey).values({
    id,
    orgId,
    createdBy: userId,
    name: parsed.name,
    prefix,
    hash,
    scopes: parsed.scopes,
    expiresAt: parsed.expiresAt ?? null,
  });

  await emitEvent("api_key.created", {
    orgId,
    actorId: userId,
    resourceType: "api_key",
    resourceId: id,
    metadata: { name: parsed.name },
  });

  revalidatePath("/settings/api");

  // Return the full key — only shown once
  return { id, key, prefix };
}

export async function revokeApiKeyAction(
  keyId: string,
  orgId: string,
  userId: string,
) {
  await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(eq(apiKey.id, keyId));

  await emitEvent("api_key.revoked", {
    orgId,
    actorId: userId,
    resourceType: "api_key",
    resourceId: keyId,
  });

  revalidatePath("/settings/api");
}
```

- [ ] **Step 3: Create API key queries**

Create `src/features/api-keys/queries.ts`:

```typescript
"use server";

import { and, eq, isNull } from "drizzle-orm";
import { apiKey } from "@/models/api-key";
import { db } from "@/shared/lib/DB";

export async function getApiKeysForOrg(orgId: string) {
  return db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      lastUsed: apiKey.lastUsed,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      revokedAt: apiKey.revokedAt,
    })
    .from(apiKey)
    .where(eq(apiKey.orgId, orgId))
    .orderBy(apiKey.createdAt);
}

export async function getActiveApiKeysForOrg(orgId: string) {
  return db
    .select()
    .from(apiKey)
    .where(
      and(
        eq(apiKey.orgId, orgId),
        isNull(apiKey.revokedAt),
      ),
    );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/api-keys/
git commit -m "feat: add API key generation, creation, and revocation"
```

---

### Task 11: Webhooks feature

**Files:**
- Create: `src/features/webhooks/actions.ts`
- Create: `src/features/webhooks/queries.ts`

- [ ] **Step 1: Create webhook actions**

Create `src/features/webhooks/actions.ts`:

```typescript
"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { emitEvent } from "@/features/events/emitter";

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

export async function createWebhookEndpointAction(
  orgId: string,
  userId: string,
  input: z.infer<typeof createWebhookSchema>,
) {
  const parsed = createWebhookSchema.parse(input);
  const id = generateId();
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;

  await db.insert(webhookEndpoint).values({
    id,
    orgId,
    url: parsed.url,
    secret,
    events: parsed.events,
  });

  await emitEvent("webhook.created", {
    orgId,
    actorId: userId,
    resourceType: "webhook_endpoint",
    resourceId: id,
  });

  revalidatePath("/settings/api");

  // Return secret — only shown once
  return { id, secret };
}

export async function deleteWebhookEndpointAction(
  endpointId: string,
  orgId: string,
  userId: string,
) {
  await db.delete(webhookEndpoint).where(eq(webhookEndpoint.id, endpointId));

  await emitEvent("webhook.deleted", {
    orgId,
    actorId: userId,
    resourceType: "webhook_endpoint",
    resourceId: endpointId,
  });

  revalidatePath("/settings/api");
}

export async function toggleWebhookEndpointAction(
  endpointId: string,
  active: boolean,
) {
  await db
    .update(webhookEndpoint)
    .set({ active })
    .where(eq(webhookEndpoint.id, endpointId));

  revalidatePath("/settings/api");
}
```

- [ ] **Step 2: Create webhook queries**

Create `src/features/webhooks/queries.ts`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/features/webhooks/actions.ts src/features/webhooks/queries.ts
git commit -m "feat: add webhook endpoint management actions and queries"
```

---

### Task 12: Feature flags

**Files:**
- Create: `src/features/feature-flags/helpers.ts`
- Create: `src/features/feature-flags/queries.ts`
- Create: `src/features/feature-flags/actions.ts`
- Create: `src/features/feature-flags/components/feature-gate.tsx`
- Create: `src/features/feature-flags/hooks/use-feature-flag.ts`
- Create: `src/app/api/features/[key]/route.ts`

- [ ] **Step 1: Create feature flag helpers (with cache)**

Create `src/features/feature-flags/helpers.ts`:

```typescript
import { eq } from "drizzle-orm";
import { featureFlag } from "@/models/feature-flag";
import { db } from "@/shared/lib/DB";

interface FlagContext {
  orgId?: string;
  planId?: string;
}

interface CachedFlag {
  enabled: boolean;
  rules: Array<{ type: "plan" | "org"; value: string }>;
  fetchedAt: number;
}

const FLAG_CACHE = new Map<string, CachedFlag>();
const CACHE_TTL = 60_000; // 60 seconds

export function invalidateFlagCache(key?: string) {
  if (key) {
    FLAG_CACHE.delete(key);
  } else {
    FLAG_CACHE.clear();
  }
}

async function getFlag(key: string): Promise<CachedFlag | null> {
  const cached = FLAG_CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  const flag = await db.query.featureFlag.findFirst({
    where: eq(featureFlag.key, key),
  });

  if (!flag) return null;

  const entry: CachedFlag = {
    enabled: flag.enabled,
    rules: flag.rules as Array<{ type: "plan" | "org"; value: string }>,
    fetchedAt: Date.now(),
  };

  FLAG_CACHE.set(key, entry);
  return entry;
}

export async function isFeatureEnabled(key: string, context: FlagContext = {}): Promise<boolean> {
  const flag = await getFlag(key);
  if (!flag) return false;
  if (!flag.enabled) return false;
  if (flag.rules.length === 0) return true;

  return flag.rules.some((rule) => {
    if (rule.type === "plan" && context.planId) return rule.value === context.planId;
    if (rule.type === "org" && context.orgId) return rule.value === context.orgId;
    return false;
  });
}
```

- [ ] **Step 2: Create feature flag queries**

Create `src/features/feature-flags/queries.ts`:

```typescript
"use server";

import { featureFlag } from "@/models/feature-flag";
import { db } from "@/shared/lib/DB";

export async function getAllFeatureFlags() {
  return db.select().from(featureFlag).orderBy(featureFlag.key);
}
```

- [ ] **Step 3: Create feature flag actions**

Create `src/features/feature-flags/actions.ts`:

```typescript
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureFlag } from "@/models/feature-flag";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { invalidateFlagCache } from "./helpers";

const flagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).default(""),
  enabled: z.boolean().default(false),
  rules: z.array(z.object({
    type: z.enum(["plan", "org"]),
    value: z.string(),
  })).default([]),
});

export async function createFeatureFlag(input: z.infer<typeof flagSchema>) {
  const parsed = flagSchema.parse(input);

  await db.insert(featureFlag).values({
    id: generateId(),
    ...parsed,
  });

  revalidatePath("/admin/features");
}

export async function updateFeatureFlag(
  flagId: string,
  input: Partial<z.infer<typeof flagSchema>>,
) {
  const flag = await db.query.featureFlag.findFirst({
    where: eq(featureFlag.id, flagId),
  });

  if (!flag) throw new Error("Feature flag not found");

  await db
    .update(featureFlag)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(featureFlag.id, flagId));

  invalidateFlagCache(flag.key);
  revalidatePath("/admin/features");
}

export async function deleteFeatureFlag(flagId: string) {
  const flag = await db.query.featureFlag.findFirst({
    where: eq(featureFlag.id, flagId),
  });

  await db.delete(featureFlag).where(eq(featureFlag.id, flagId));

  if (flag) invalidateFlagCache(flag.key);
  revalidatePath("/admin/features");
}

export async function toggleFeatureFlag(flagId: string, enabled: boolean) {
  return updateFeatureFlag(flagId, { enabled });
}
```

- [ ] **Step 4: Create FeatureGate RSC component**

Create `src/features/feature-flags/components/feature-gate.tsx`:

```typescript
import type { ReactNode } from "react";
import { isFeatureEnabled } from "../helpers";

interface FeatureGateProps {
  flag: string;
  orgId?: string;
  planId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export async function FeatureGate({
  flag,
  orgId,
  planId,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabled = await isFeatureEnabled(flag, { orgId, planId });
  return enabled ? children : fallback;
}
```

- [ ] **Step 5: Create client-side hook**

Create `src/features/feature-flags/hooks/use-feature-flag.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";

export function useFeatureFlag(key: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/features/${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data: { enabled: boolean }) => {
        setEnabled(data.enabled);
        setLoading(false);
      })
      .catch(() => {
        setEnabled(false);
        setLoading(false);
      });
  }, [key]);

  return { enabled, loading };
}
```

- [ ] **Step 6: Create feature flag API route**

Create `src/app/api/features/[key]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/features/feature-flags/helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const enabled = await isFeatureEnabled(key);
  return NextResponse.json({ key, enabled });
}
```

- [ ] **Step 7: Commit**

```bash
git add src/features/feature-flags/ src/app/api/features/
git commit -m "feat: add feature flags with DB, cache, RSC gate, and client hook"
```

---

### Task 13: Audit log admin page

**Files:**
- Create: `src/features/audit/queries.ts`
- Create: `src/features/audit/components/audit-log-table.tsx`
- Create: `src/app/[locale]/(admin)/admin/audit/page.tsx`

- [ ] **Step 1: Create audit queries**

Create `src/features/audit/queries.ts`:

```typescript
"use server";

import { desc } from "drizzle-orm";
import { auditLog } from "@/models/audit-log";
import { db } from "@/shared/lib/DB";

export async function getAuditLogs(limit = 50) {
  return db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
```

- [ ] **Step 2: Create audit log table component**

Create `src/features/audit/components/audit-log-table.tsx` — a client component wrapping `data-table` that displays audit log entries with columns: date, actor, action, resource type, resource ID. Follow the pattern of `admin-users-table.tsx`.

- [ ] **Step 3: Create admin audit page**

Create `src/app/[locale]/(admin)/admin/audit/page.tsx`:

```typescript
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/shared/components/data/page-header";
import { requireAdmin } from "@/features/auth/guards";
import { getAuditLogs } from "@/features/audit/queries";
import { AuditLogTable } from "@/features/audit/components/audit-log-table";

export default async function AuditPage() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const logs = await getAuditLogs();

  return (
    <div className="space-y-6">
      <PageHeader title={t("auditLog")} description={t("auditLogDescription")} />
      <AuditLogTable logs={logs} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/audit/ src/app/\[locale\]/\(admin\)/admin/audit/
git commit -m "feat: add admin audit log page with data table"
```

---

### Task 14: Feature flags admin page + API/webhook settings page

**Files:**
- Create: `src/features/feature-flags/components/flag-admin-table.tsx`
- Create: `src/app/[locale]/(admin)/admin/features/page.tsx`
- Create: `src/features/api-keys/components/api-key-list.tsx`
- Create: `src/features/api-keys/components/create-key-modal.tsx`
- Create: `src/features/webhooks/components/webhook-list.tsx`
- Create: `src/features/webhooks/components/create-webhook-modal.tsx`
- Create: `src/app/[locale]/(app)/settings/api/page.tsx`

These are UI components. Follow existing patterns from `src/features/feedback/components/` and `src/shared/components/data/data-table.tsx`. Each component should:
- Use shadcn/ui primitives (Button, Card, Dialog, Table)
- Use `useTranslations()` for i18n
- Follow the "use client" pattern where interactivity is needed

- [ ] **Step 1: Create flag admin table** — Client component with toggle switches for each flag, edit dialog for rules.

- [ ] **Step 2: Create admin features page**

```typescript
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/shared/components/data/page-header";
import { requireAdmin } from "@/features/auth/guards";
import { getAllFeatureFlags } from "@/features/feature-flags/queries";
import { FlagAdminTable } from "@/features/feature-flags/components/flag-admin-table";

export default async function FeaturesPage() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const flags = await getAllFeatureFlags();

  return (
    <div className="space-y-6">
      <PageHeader title={t("featureFlags")} description={t("featureFlagsDescription")} />
      <FlagAdminTable flags={flags} />
    </div>
  );
}
```

- [ ] **Step 3: Create API key and webhook UI components** — Follow existing modal patterns.

- [ ] **Step 4: Create settings API page**

```typescript
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/shared/components/data/page-header";
import { requireAuth } from "@/features/auth/guards";
import { getApiKeysForOrg } from "@/features/api-keys/queries";
import { getWebhookEndpointsForOrg } from "@/features/webhooks/queries";
import { ApiKeyList } from "@/features/api-keys/components/api-key-list";
import { WebhookList } from "@/features/webhooks/components/webhook-list";

export default async function ApiSettingsPage() {
  const session = await requireAuth();
  const t = await getTranslations("settings");
  // TODO: resolve orgId from active organization
  const orgId = ""; // Will be resolved from session context
  const apiKeys = await getApiKeysForOrg(orgId);
  const webhooks = await getWebhookEndpointsForOrg(orgId);

  return (
    <div className="space-y-8">
      <PageHeader title={t("api")} description={t("apiDescription")} />
      <ApiKeyList keys={apiKeys} orgId={orgId} userId={session.user.id} />
      <WebhookList endpoints={webhooks} orgId={orgId} userId={session.user.id} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/feature-flags/components/ src/features/api-keys/components/ src/features/webhooks/components/ src/app/\[locale\]/\(admin\)/admin/features/ src/app/\[locale\]/\(app\)/settings/api/
git commit -m "feat: add feature flags admin, API keys, and webhooks settings UI"
```

---

## CHECKPOINT: Review Lot 3

Pause here. Verify:
- `npx tsc --noEmit` passes
- `npm run lint` passes
- All new pages render without errors
- Feature flag helpers work correctly

---

## CHECKPOINT: Lot 4 — Câblage & Polish

### Task 15: Wire settings pages

**Files:**
- Create: `src/features/settings/actions.ts`
- Modify: `src/app/[locale]/(app)/settings/profile/page.tsx`
- Modify: `src/app/[locale]/(app)/settings/notifications/page.tsx`
- Modify: `src/app/[locale]/(app)/settings/danger/page.tsx`

- [ ] **Step 1: Create settings server actions**

Create `src/features/settings/actions.ts`:

```typescript
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import { requireAuth } from "@/features/auth/guards";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  image: z.string().url().optional().or(z.literal("")),
});

export async function updateProfile(input: z.infer<typeof updateProfileSchema>) {
  const session = await requireAuth();
  const parsed = updateProfileSchema.parse(input);

  await db
    .update(user)
    .set({
      name: parsed.name,
      image: parsed.image || null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id));

  revalidatePath("/settings/profile");
}

export async function deleteAccount() {
  const session = await requireAuth();

  // 1. Cancel Stripe subscription if active
  const { subscription } = await import("@/models/subscription");
  const { organizationMember } = await import("@/models/organization");
  const { and, eq: eqOp } = await import("drizzle-orm");

  // Find orgs where user is sole owner
  const ownedOrgs = await db.query.organizationMember.findMany({
    where: and(
      eqOp(organizationMember.userId, session.user.id),
      eqOp(organizationMember.role, "owner"),
    ),
  });

  for (const membership of ownedOrgs) {
    // Check if org has other members
    const otherMembers = await db.query.organizationMember.findMany({
      where: and(
        eqOp(organizationMember.organizationId, membership.organizationId),
      ),
    });

    if (otherMembers.length <= 1) {
      // Sole member — cancel subscription and delete org (cascade handles rest)
      const sub = await db.query.subscription.findFirst({
        where: eqOp(subscription.organizationId, membership.organizationId),
      });

      if (sub?.stripeSubscriptionId) {
        try {
          const { getStripe } = await import("@/features/billing/stripe");
          await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
        } catch {
          // Stripe cancellation is best-effort
        }
      }
    } else {
      // Multi-member org — transfer ownership to the next admin or oldest member
      const nextOwner = otherMembers.find(
        (m) => m.userId !== session.user.id && m.role === "admin",
      ) ?? otherMembers.find((m) => m.userId !== session.user.id);

      if (nextOwner) {
        await db
          .update(organizationMember)
          .set({ role: "owner" })
          .where(eqOp(organizationMember.id, nextOwner.id));
      }
    }
  }

  // 2. Delete user account (cascades handle members, notifications, etc.)
  await db.delete(user).where(eq(user.id, session.user.id));

  revalidatePath("/");
}
```

- [ ] **Step 2: Wire profile, notifications, and danger pages** — Connect the forms in each page to the server actions above. Read each page first to understand its current structure, then add form submission logic using the existing react-hook-form + zod pattern.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/ src/app/\[locale\]/\(app\)/settings/
git commit -m "feat: wire settings pages (profile, notifications, danger zone)"
```

---

### Task 16: Real dashboard

**Files:**
- Create: `src/features/dashboard/queries.ts`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard queries**

Create `src/features/dashboard/queries.ts`:

```typescript
"use server";

import { count, eq } from "drizzle-orm";
import { notification, organizationMember, subscription, upload } from "@/models";
import { db } from "@/shared/lib/DB";

export async function getDashboardStats(orgId: string) {
  const [membersResult] = await db
    .select({ count: count() })
    .from(organizationMember)
    .where(eq(organizationMember.organizationId, orgId));

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  const [uploadsResult] = await db
    .select({ count: count() })
    .from(upload)
    .where(eq(upload.organizationId, orgId));

  return {
    members: membersResult?.count ?? 0,
    plan: sub?.planId ?? "free",
    status: sub?.status ?? "active",
    uploads: uploadsResult?.count ?? 0,
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const { and } = await import("drizzle-orm");
  const [result] = await db
    .select({ count: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));

  return result?.count ?? 0;
}
```

- [ ] **Step 2: Wire dashboard page** — Read the current dashboard page, then replace static data with calls to `getDashboardStats()` and `getUnreadNotificationCount()`. Get orgId from session via active organization context.

- [ ] **Step 3: Commit**

```bash
git add src/features/dashboard/ src/app/\[locale\]/\(app\)/dashboard/
git commit -m "feat: wire dashboard with real data queries"
```

---

### Task 17: Changelog admin

**Files:**
- Create: `src/features/changelog/actions.ts`
- Create: `src/app/[locale]/(admin)/admin/changelog/page.tsx`

- [ ] **Step 1: Create changelog actions**

Create `src/features/changelog/actions.ts`:

```typescript
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changelogEntry } from "@/models/changelog";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const changelogSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  publishedAt: z.date().optional(),
});

export async function createChangelogEntry(input: z.infer<typeof changelogSchema>) {
  const parsed = changelogSchema.parse(input);

  await db.insert(changelogEntry).values({
    id: generateId(),
    ...parsed,
  });

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}

export async function updateChangelogEntry(
  entryId: string,
  input: Partial<z.infer<typeof changelogSchema>>,
) {
  await db
    .update(changelogEntry)
    .set(input)
    .where(eq(changelogEntry.id, entryId));

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}

export async function deleteChangelogEntry(entryId: string) {
  await db.delete(changelogEntry).where(eq(changelogEntry.id, entryId));

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}
```

- [ ] **Step 2: Create admin changelog page** — Data table with create/edit forms. Follow the pattern of the admin users page.

- [ ] **Step 3: Commit**

```bash
git add src/features/changelog/ src/app/\[locale\]/\(admin\)/admin/changelog/
git commit -m "feat: add changelog admin page with CRUD actions"
```

---

### Task 18: i18n translations

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/fr.json`

- [ ] **Step 1: Add English translations**

Add to `src/locales/en.json` in the `admin` section:

```json
"auditLog": "Audit Log",
"auditLogDescription": "View all actions performed in the system",
"featureFlags": "Feature Flags",
"featureFlagsDescription": "Manage feature flags and rollout rules"
```

Add new `settings` keys:

```json
"api": "API & Webhooks",
"apiDescription": "Manage API keys and webhook endpoints",
"apiKeys": "API Keys",
"createApiKey": "Create API Key",
"revokeApiKey": "Revoke",
"webhookEndpoints": "Webhook Endpoints",
"createWebhook": "Create Webhook",
"webhookUrl": "Endpoint URL",
"webhookEvents": "Events",
"webhookSecret": "Signing Secret"
```

- [ ] **Step 2: Add French translations** — Same keys in French.

- [ ] **Step 3: Commit**

```bash
git add src/locales/
git commit -m "feat: add i18n translations for audit, features, API settings"
```

---

### Task 19: Update admin navigation

**Files:**
- Modify: `src/app/[locale]/(admin)/layout.tsx` (or sidebar component)

- [ ] **Step 1: Add nav links** — Read the admin layout/sidebar and add links for `/admin/audit`, `/admin/features`, `/admin/changelog`.

- [ ] **Step 2: Commit**

```bash
git add src/
git commit -m "feat: add audit, features, changelog links to admin navigation"
```

---

### Task 20: Example tests

**Files:**
- Create: `tests/unit/actions/feedback.test.ts`
- Create: `tests/unit/queries/notifications.test.ts`
- Create: `tests/unit/webhook-handler.test.ts`
- Create: `tests/unit/webhook-matching.test.ts` (already done in Task 9)

- [ ] **Step 1: Create feedback action test**

Create `tests/unit/actions/feedback.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * Example test: Server action with Zod validation.
 *
 * This demonstrates how to test server actions:
 * 1. Mock the database
 * 2. Validate inputs with Zod schemas
 * 3. Test both happy path and validation errors
 */

// Schema matching the one used in the actual action
const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "other"]),
  message: z.string().min(1).max(5000),
});

describe("feedback action validation", () => {
  it("accepts valid feedback input", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      message: "Something is broken",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty message", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = feedbackSchema.safeParse({
      type: "invalid",
      message: "Some message",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message exceeding max length", () => {
    const result = feedbackSchema.safeParse({
      type: "feature",
      message: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Create notification query test**

Create `tests/unit/queries/notifications.test.ts` — Test with mocked DB.

- [ ] **Step 3: Create webhook handler test**

Create `tests/unit/webhook-handler.test.ts` — Test Stripe webhook signature validation and handler dispatch with mocks.

- [ ] **Step 4: Create onboarding E2E test**

Create `tests/e2e/onboarding.e2e.ts`:

```typescript
import { expect, test } from "@playwright/test";

/**
 * Example E2E test: Full onboarding flow.
 * Demonstrates how to test a multi-step user journey.
 */
test.describe("Onboarding flow", () => {
  test("new user completes sign-up and onboarding", async ({ page }) => {
    // Step 1: Navigate to sign-up
    await page.goto("/en/sign-up");
    await expect(page.getByRole("heading", { name: /sign up/i })).toBeVisible();

    // Step 2: Fill sign-up form
    await page.getByLabel("Email").fill(`test-${Date.now()}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
    await page.getByLabel("Confirm Password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign up/i }).click();

    // Note: In a real test, you'd verify the email or bypass verification.
    // This test demonstrates the pattern — adapt to your auth flow.
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `npm run test`
Expected: All unit tests pass

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "feat: add example tests for actions, queries, webhook handlers, and onboarding e2e"
```

---

### Task 21: Storybook stories

**Files:**
- Create: `src/shared/components/ui/button.stories.tsx`
- Create: `src/shared/components/data/data-table.stories.tsx`

- [ ] **Step 1: Create Button story**

Create `src/shared/components/ui/button.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Button" },
};

export const Destructive: Story = {
  args: { children: "Delete", variant: "destructive" },
};

export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
};

export const Ghost: Story = {
  args: { children: "Ghost", variant: "ghost" },
};
```

- [ ] **Step 2: Create DataTable story** — A story with sample data showing the table component.

- [ ] **Step 3: Create FeedbackModal story** — A story for the feedback modal component at `src/features/feedback/components/feedback-modal.tsx`.

- [ ] **Step 4: Create PricingTable story** — A story for the pricing table component at `src/features/billing/components/pricing-table.tsx`.

- [ ] **Step 5: Verify storybook builds**

Run: `npx storybook build --quiet`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/ui/button.stories.tsx src/shared/components/data/data-table.stories.tsx src/features/feedback/components/feedback-modal.stories.tsx src/features/billing/components/pricing-table.stories.tsx
git commit -m "feat: add Storybook stories for Button and DataTable"
```

---

### Task 22: A11y tests

**Files:**
- Create: `tests/e2e/a11y.e2e.ts`

- [ ] **Step 1: Create a11y test**

Create `tests/e2e/a11y.e2e.ts`:

```typescript
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility tests using axe-core.
 * Runs automated WCAG 2.1 checks on critical pages.
 */

test.describe("Accessibility", () => {
  test("landing page has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
  });

  test("sign-in page has no critical a11y violations", async ({ page }) => {
    await page.goto("/en/sign-in");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/a11y.e2e.ts
git commit -m "feat: add a11y tests with axe-core for critical pages"
```

---

## CHECKPOINT: Final Review

Pause here. Full verification:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] `npx storybook build --quiet` passes
- [ ] All new models are in `src/models/index.ts`
- [ ] All new env vars are in `env.ts` and `.env.example`
- [ ] All new pages have i18n translations (en + fr)
- [ ] Admin navigation includes new links
