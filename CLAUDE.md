# SaaS Boilerplate

## Overview

Boilerplate Next.js réutilisable pour développer rapidement des applications SaaS.
Architecture monolithe modulaire (feature-based).

## Tech Stack

- **Framework:** Next.js 16 + App Router + TypeScript + React 19
- **UI:** Tailwind CSS 4 + shadcn/ui + next-themes (dark/light mode)
- **Auth:** Better Auth (self-hosted) — PAS Clerk
- **DB:** Drizzle ORM + PostgreSQL (PGlite en local)
- **Paiement:** Stripe
- **i18n:** next-intl
- **Emails:** React Email + Nodemailer (SMTP)
- **Logging:** LogTape
- **Testing:** Vitest + Playwright + Storybook
- **DX:** ESLint (Antfu), Prettier, Lefthook, Commitlint, Knip, T3 Env

## Architecture

```
src/
  app/                    # Routes Next.js (App Router)
    [locale]/             # Routes localisées
      (marketing)/        # Pages publiques
      (auth)/             # Pages auth
      (app)/              # App protégée (dashboard, settings)
      (admin)/            # Panel admin
    api/                  # Routes API (hors locale)
  features/               # Modules métier isolés
    auth/                 # Better Auth, organizations, RBAC
    billing/              # Stripe, plans, webhooks
    onboarding/           # Wizard d'onboarding
    notifications/        # Notifs in-app
    feedback/             # Widget feedback
    upload/               # Upload fichiers
    email/                # Templates React Email
  shared/                 # Code partagé entre features
    components/           # shadcn/ui + composants réutilisables
    hooks/                # Hooks React partagés
    lib/                  # DB, env, logger, i18n, SEO configs
    types/                # Types globaux
    utils/                # Helpers génériques
  models/                 # Schemas Drizzle ORM
  locales/                # Fichiers de traduction (en, fr)
  styles/                 # CSS global
```

## Conventions

- **Feature pattern:** Chaque feature dans `features/` a : `actions.ts`, `queries.ts`, `hooks/`, `components/`
- **Queries:** server-only (`"use server"`), retournent des données depuis Drizzle
- **Actions:** Server Actions avec validation Zod
- **Composants:** React Server Components par défaut, Client Components quand nécessaire (`"use client"`)
- **Nommage fichiers:** kebab-case pour les fichiers, PascalCase pour les composants
- **Imports:** absolus avec prefix `@/` (ex: `@/features/auth/auth`)
- **Commits:** conventional commits (commitlint)
- **Ne pas utiliser Clerk** — toujours Better Auth

## Design doc

Le design complet est dans `docs/superpowers/specs/2026-03-17-saas-boilerplate-design.md`

## Commandes

```bash
npm run dev          # Dev local (PGlite + hot reload)
npm run build        # Build production + migration DB
npm run lint         # ESLint
npm run test         # Vitest
npm run test:e2e     # Playwright
npm run db:generate  # Générer migration Drizzle
npm run db:migrate   # Appliquer migrations
npm run db:studio    # Drizzle Studio
npm run db:seed      # Seed DB (plans, admin)
```
