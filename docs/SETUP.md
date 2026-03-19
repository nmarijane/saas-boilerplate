# New SaaS Project Setup Guide

This guide is designed for LLMs (Claude Code, Cursor, etc.) bootstrapping a new SaaS project from this boilerplate. Follow each phase in order.

## Phase 1: Clone & Initialize

```bash
git clone https://github.com/nmarijane/saas-boilerplate.git my-project
cd my-project
rm -rf .git
git init
npm install
```

Update `package.json`:
- Change `"name"` to your project name
- Update `"version"` to `"0.1.0"`

## Phase 2: Configure Environment

```bash
cp .env.example .env.local
```

### Required for local dev (minimum)

Nothing. The app runs out of the box with PGlite (in-memory DB) and sensible defaults.

### Required for production

| Variable | How to get it | Used by |
|----------|--------------|---------|
| `DATABASE_URL` | Create a PostgreSQL database (Neon, Supabase, Railway, or self-hosted). Format: `postgresql://user:password@host:5432/dbname` | Database |
| `BETTER_AUTH_SECRET` | Generate: `openssl rand -hex 32` | Auth sessions |
| `BETTER_AUTH_URL` | Your deployed app URL (e.g. `https://my-app.com`) | Auth callbacks |
| `NEXT_PUBLIC_APP_URL` | Same as BETTER_AUTH_URL | Links, metadata |

### Required for billing (Stripe)

| Variable | How to get it | Used by |
|----------|--------------|---------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard > Developers > API keys > Secret key | Server-side Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Developers > Webhooks > Add endpoint (`/api/stripe/webhook`) > Signing secret | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard > Developers > API keys > Publishable key | Client-side Stripe.js |

### Required for email

| Variable | How to get it | Used by |
|----------|--------------|---------|
| `SMTP_HOST` | Your SMTP provider (Resend: `smtp.resend.com`, SendGrid: `smtp.sendgrid.net`, Postmark: `smtp.postmarkapp.com`) | Email sending |
| `SMTP_PORT` | Usually `587` (TLS) or `465` (SSL) | Email sending |
| `SMTP_USER` | From your SMTP provider dashboard | Email sending |
| `SMTP_PASS` | From your SMTP provider dashboard (API key or password) | Email sending |
| `EMAIL_FROM` | Your verified sender email (e.g. `hello@my-app.com`) | Email "From" field |

### Optional: OAuth providers

| Variable | How to get it |
|----------|--------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console > APIs & Services > Credentials > Create OAuth 2.0 Client. Redirect URI: `{APP_URL}/api/auth/callback/google` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub > Settings > Developer settings > OAuth Apps > New. Callback URL: `{APP_URL}/api/auth/callback/github` |

### Optional: File storage (S3)

Default is local filesystem. For S3:

```env
STORAGE_ADAPTER=s3
S3_BUCKET=my-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=secret...
```

### Optional: Rate limiting (Redis)

Default is in-memory (single instance only). For distributed:

```env
# Option A: Self-hosted Redis
RATE_LIMIT_ADAPTER=redis
REDIS_URL=redis://localhost:6379

# Option B: Upstash (serverless, Edge-compatible)
RATE_LIMIT_ADAPTER=upstash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...
```

### Optional: Error tracking (Sentry)

```env
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=my-org
SENTRY_PROJECT=my-project
```

### Optional: Background jobs (Inngest)

Auto-detected in dev. For production, sign up at inngest.com:

```env
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

## Phase 3: Remove Unused Features

Each feature module in `src/features/` is self-contained. To remove a feature:

1. Delete its directory from `src/features/`
2. Delete its model from `src/models/` (if it has one)
3. Delete its API routes from `src/app/api/`
4. Delete its pages from `src/app/[locale]/`
5. Remove imports from `src/models/index.ts`
6. Run `npm run lint` to find and fix any remaining references
7. Run `npm run db:generate` to update migrations

### Feature dependency map

```
auth (core - DO NOT remove)
  billing (requires: auth, stripe)
  onboarding (requires: auth)
  notifications (requires: auth)
  feedback (requires: auth, optional: upload)
  upload (requires: auth, optional: s3)
  api-keys (requires: auth)
  webhooks (requires: auth, events)
  feature-flags (requires: auth)
  audit (requires: auth, events)
  changelog (requires: auth)
  admin (requires: auth)
  dashboard (requires: auth)
  settings (requires: auth)
  email (standalone templates, used by: auth, billing, webhooks)
  events (event bus, used by: audit, webhooks, notifications)
  jobs (background tasks, used by: email, webhooks, audit)
```

### Common removal scenarios

**No billing needed:**
```
Delete: src/features/billing/
Delete: src/models/subscription.ts
Delete: src/app/api/stripe/
Delete: src/app/[locale]/(app)/settings/billing/
Delete: src/app/[locale]/(marketing)/pricing/
Remove: subscription from src/models/index.ts
Remove: STRIPE_* from src/shared/lib/env.ts
```

**No file upload needed:**
```
Delete: src/features/upload/
Delete: src/models/upload.ts
Delete: src/app/api/upload/
Remove: upload from src/models/index.ts
Remove: S3_*, STORAGE_ADAPTER, UPLOAD_MAX_SIZE from src/shared/lib/env.ts
```

**No notifications needed:**
```
Delete: src/features/notifications/
Delete: src/models/notification.ts
Delete: src/app/api/notifications/
Delete: src/app/[locale]/(app)/settings/notifications/
Remove: notification from src/models/index.ts
Remove: notification handler from src/features/events/handlers/
```

## Phase 4: Customize the Project

### Branding

- Replace `public/assets/images/logo.png` with your logo
- Update `src/app/[locale]/(marketing)/page.tsx` (landing page)
- Update `src/shared/lib/seo.ts` (site name, description, OG images)
- Update `src/locales/en.json` and `src/locales/fr.json` (translations)

### Database models

Add your business models in `src/models/`. Follow the existing pattern:

```typescript
// src/models/my-model.ts
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const myModel = pgTable("my_model", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("my_model_org_id_idx").on(t.organizationId),
]);
```

Then export it from `src/models/index.ts` and run `npm run db:generate`.

### New features

Create a new feature module following the pattern:

```
src/features/my-feature/
  actions.ts       # Server Actions (mutations, "use server")
  queries.ts       # Server queries (reads, "use server")
  components/      # React components
  hooks/           # Client-side hooks
```

## Phase 5: Initialize Database

```bash
# Generate migrations from your schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Seed with default plans and admin user
npm run db:seed
```

The seed creates:
- 3 billing plans (Free, Pro, Enterprise)
- 1 admin user (admin@example.com)

## Phase 6: Verify Everything Works

```bash
npm run dev          # Start dev server
npm run lint         # Should be 0 errors
npm run check:types  # Should be 0 errors
npm run test         # All tests should pass
npm run build        # Production build should succeed
```

## Phase 7: Deploy

### Vercel (recommended)

1. Push to GitHub
2. Import in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Docker

```bash
npm run docker:up
```

### Post-deploy checklist

- [ ] Set all production environment variables
- [ ] Run `npm run db:migrate` on production database
- [ ] Run `npm run db:seed` for initial data
- [ ] Configure Stripe webhook endpoint: `https://your-app.com/api/stripe/webhook`
- [ ] Configure OAuth redirect URIs with your production URL
- [ ] Test sign-up, sign-in, and email flows
- [ ] Switch CSP from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `next.config.ts` after verification
