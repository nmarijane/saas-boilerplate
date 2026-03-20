<div align="center">

# SaaS Boilerplate

**Stop rebuilding auth, billing, and multi-tenancy for every new SaaS.**

Every project starts the same way. Your AI agents burn tokens regenerating the same foundation.
Clone this once, and go straight to building what makes your product unique.

[![CI](https://github.com/nmarijane/saas-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/nmarijane/saas-boilerplate/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/nmarijane/saas-boilerplate/main/.github/badges/coverage.json)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

**20+ features** -- Auth, Stripe, RBAC, API keys, webhooks, feature flags, admin panel, and more.
**Zero config** -- `npm install && npm run dev`. PGlite in-memory DB, no setup needed.
**AI-native** -- `CLAUDE.md` + `docs/SETUP.md` included so your agents have full context from day one.

</div>

---

> [!TIP]
> **Setup with Claude Code**
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

Open [http://localhost:3000](http://localhost:3000). See the full [Setup Guide](docs/SETUP.md) for env vars, feature removal, and deployment.

---

## Built With

<p>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://ui.shadcn.com"><img src="https://img.shields.io/badge/shadcn/ui-000000?style=for-the-badge&logo=shadcnui&logoColor=white" alt="shadcn/ui" /></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://orm.drizzle.team"><img src="https://img.shields.io/badge/Drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black" alt="Drizzle ORM" /></a>
  <a href="https://stripe.com"><img src="https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" /></a>
  <a href="https://sentry.io"><img src="https://img.shields.io/badge/Sentry-362D59?style=for-the-badge&logo=sentry&logoColor=white" alt="Sentry" /></a>
  <a href="https://storybook.js.org"><img src="https://img.shields.io/badge/Storybook-FF4785?style=for-the-badge&logo=storybook&logoColor=white" alt="Storybook" /></a>
  <a href="https://vitest.dev"><img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" /></a>
  <a href="https://playwright.dev"><img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" /></a>
  <a href="https://www.docker.com"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="https://eslint.org"><img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint" /></a>
  <a href="https://prettier.io"><img src="https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black" alt="Prettier" /></a>
  <a href="https://github.com/features/actions"><img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" /></a>
  <a href="https://www.inngest.com"><img src="https://img.shields.io/badge/Inngest-5D5AFF?style=for-the-badge&logoColor=white" alt="Inngest" /></a>
</p>

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
| **CI/CD** | GitHub Actions + Dependabot + Claude Code Review |

---

## Features

**Core** -- Authentication (email, Google, GitHub, MFA), multi-tenancy (orgs, RBAC), Stripe billing (checkout, portal, webhooks), onboarding wizard

**Platform** -- Dashboard with real-time stats, admin panel (users, orgs, audit log, feature flags, changelog, metrics), settings (profile, team, billing, API keys, webhooks), in-app notifications

**Developer** -- API keys (SHA-256 hashed, scoped), webhooks (HMAC-SHA256 signed, delivery log), feature flags (plan/org gating), event bus (17 types), audit log, file upload (local + S3), rate limiting (memory/Redis/Upstash), feedback widget, email templates, health check

**Security** -- Security headers (CSP, HSTS, X-Frame-Options), Zod validation, session-based API auth, role-based access control, `safeAction` error wrapper

**CI/CD** -- 6 parallel jobs (lint, typecheck, test, build, storybook, audit), automatic coverage badge, Dependabot weekly updates, and **Claude Code AI reviewer** that reviews every PR for security, quality, and convention adherence. Mention `@claude` in any PR comment to get AI assistance.

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
