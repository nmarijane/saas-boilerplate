# SaaS Boilerplate

[![CI](https://github.com/nmarijane/saas-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/nmarijane/saas-boilerplate/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/nmarijane/saas-boilerplate/main/.github/badges/coverage.json)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

A production-ready, modular Next.js boilerplate for building SaaS applications fast.
Self-hosted auth, Stripe billing, multi-tenancy, and 20+ features out of the box.

---

> [!TIP]
> ### Setup with Claude Code
>
> The fastest way to start a new project from this boilerplate is with [**saas-forge**](https://github.com/nmarijane/saas-forge) — a Claude Code plugin that brainstorms your idea, scaffolds the project, removes what you don't need, and generates your business logic automatically.
>
> ```bash
> # Install the plugin
> npx skills add nmarijane/saas-forge
>
> # Create your SaaS
> /saas-forge:saas A project management tool for freelancers
> ```
>
> saas-forge will:
> 1. **Brainstorm** your idea — data model, user flows, which features to keep or remove
> 2. **Scaffold** the project — clone, customize, clean up unused features
> 3. **Generate** your business code — Drizzle models, server actions, components, pages
>
> No manual setup. No guessing which files to delete. Just describe your app and go.

---

## Quick Start (manual)

```bash
# Clone
git clone https://github.com/nmarijane/saas-boilerplate.git my-saas
cd my-saas

# Install
npm install

# Start dev server (PGlite, no DB setup needed)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Auth** | Better Auth (self-hosted, not Clerk) |
| **Database** | Drizzle ORM + PostgreSQL (PGlite for local dev) |
| **Payments** | Stripe (checkout, portal, webhooks) |
| **Emails** | React Email + Nodemailer (SMTP) |
| **Jobs** | Inngest (background tasks, retries) |
| **i18n** | next-intl (en, fr) |
| **Monitoring** | Sentry + LogTape |
| **Testing** | Vitest + Playwright + Storybook |
| **CI/CD** | GitHub Actions + Dependabot |

---

## Features

### Core

- **Authentication** -- Email/password, Google, GitHub, MFA (TOTP), email verification, password reset
- **Multi-tenancy** -- Organizations, member roles (owner/admin/member), team invitations
- **Billing** -- Stripe checkout, subscription management, customer portal, webhook handlers
- **Onboarding** -- 3-step wizard (profile, organization, team invite)

### Platform

- **Dashboard** -- Real-time stats, notifications, data tables
- **Admin Panel** -- Users, organizations, audit log, feature flags, changelog, metrics (MRR)
- **Settings** -- Profile, notifications, team, billing, API keys, webhooks, danger zone
- **Notifications** -- In-app notifications with bell icon, mark as read, notification types

### Developer

- **API Keys** -- SHA-256 hashed, scoped, with usage tracking
- **Webhooks** -- HMAC-SHA256 signed, pattern matching, delivery log with retries
- **Feature Flags** -- Plan/org-based gating, in-memory cache (60s TTL), admin UI
- **Event Bus** -- Central emitter, 17 event types, drives audit log + webhooks + notifications
- **Audit Log** -- Full trail with retention policy and purge job
- **File Upload** -- Adapter pattern (local + S3), validation, ownership checks
- **Rate Limiting** -- Memory, Redis, or Upstash adapters (Edge-compatible)
- **Feedback Widget** -- User feedback with screenshot support, admin review
- **Email Templates** -- Welcome, verify, reset, invitation, payment, cancellation
- **Health Check** -- `/api/health` endpoint with DB + service checks

### Security

- **Security headers** -- CSP, HSTS, X-Frame-Options, nosniff, Permissions-Policy
- **Input validation** -- Zod on all server actions
- **API route auth** -- Session-based with ownership verification
- **Role-based access** -- Server-side permission checks on all mutations
- **Error handling** -- `safeAction` wrapper, no internal error leaks

---

## Project Structure

```
src/
  app/                    # Next.js routes (App Router)
    [locale]/             # i18n routing (en, fr)
      (marketing)/        # Public pages (landing, pricing, about)
      (auth)/             # Sign-in, sign-up, verify, forgot password
      (app)/              # Protected app (dashboard, settings)
      (admin)/            # Admin panel
    api/                  # API routes
  features/               # Feature modules (isolated)
    auth/                 # Better Auth, organizations, RBAC
    billing/              # Stripe, plans, webhooks
    notifications/        # In-app notifications
    feedback/             # Feedback widget
    upload/               # File upload (local + S3)
    email/                # Email templates
    onboarding/           # Wizard
    api-keys/             # API key management
    webhooks/             # Webhook delivery
    feature-flags/        # Feature flag system
    events/               # Event bus
  shared/                 # Shared code
    components/           # shadcn/ui + reusable components
    hooks/                # React hooks
    lib/                  # DB, env, logger, i18n, SEO, rate-limit
  models/                 # Drizzle ORM schemas
  locales/                # Translation files (en.json, fr.json)
```

---

## Commands

```bash
# Development
npm run dev              # Start dev server (PGlite, hot reload)
npm run storybook        # Start Storybook on port 6006
npm run email:dev        # Preview email templates

# Quality
npm run lint             # ESLint
npm run check:types      # TypeScript type check
npm run check:deps       # Unused dependencies (Knip)
npm run format           # Prettier

# Testing
npm run test             # Vitest (unit + integration)
npm run test:watch       # Vitest in watch mode
npm run test:e2e         # Playwright E2E tests

# Database
npm run db:generate      # Generate Drizzle migration
npm run db:migrate       # Apply migrations
npm run db:studio        # Open Drizzle Studio
npm run db:seed          # Seed database (plans, admin user)

# Production
npm run build            # Production build
npm start                # Start production server
npm run docker:up        # Start with Docker Compose
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
# Required for production
DATABASE_URL=              # PostgreSQL connection string
BETTER_AUTH_SECRET=        # Auth secret (generate with openssl rand -hex 32)
BETTER_AUTH_URL=           # Your app URL (https://your-app.com)
STRIPE_SECRET_KEY=         # Stripe secret key
STRIPE_WEBHOOK_SECRET=     # Stripe webhook signing secret

# Optional
NEXT_PUBLIC_APP_URL=       # App URL (default: http://localhost:3000)
GOOGLE_CLIENT_ID=          # Google OAuth
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=          # GitHub OAuth
GITHUB_CLIENT_SECRET=
SMTP_HOST=                 # Email SMTP
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
SENTRY_DSN=                # Sentry error tracking
S3_BUCKET=                 # S3 file storage (optional, local by default)
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

> For local development, no environment variables are needed. The app uses PGlite (in-memory DB) and falls back to sensible defaults.

---

## Deployment

### Docker

```bash
npm run docker:up
```

### Vercel / Railway / Fly.io

1. Connect your repository
2. Set environment variables
3. Build command: `npm run build`
4. Start command: `npm start`

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
4. Push and create a Pull Request

Pre-commit hooks enforce linting, type checking, and commit message format.

---

## License

MIT
