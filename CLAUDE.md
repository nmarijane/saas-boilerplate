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

## Règles strictes de qualité

### Zéro deprecated
- **JAMAIS** utiliser d'API, de méthode, de package ou de pattern deprecated
- Si une dépendance est deprecated, la remplacer immédiatement par son successeur officiel
- Toujours utiliser la version stable la plus récente des API et des packages
- Vérifier les changelogs et les guides de migration avant de choisir une approche

### Zéro warning ignoré
- **JAMAIS** ignorer les warnings (TypeScript, ESLint, React, Next.js, build)
- **JAMAIS** utiliser `@ts-ignore`, `@ts-expect-error`, `eslint-disable` ou `// @ts-nocheck` — corriger le problème à la source
- **JAMAIS** utiliser `any` — toujours typer correctement, utiliser `unknown` si le type est inconnu puis narrower
- Les warnings sont des bugs en attente — les traiter comme des erreurs
- Si un warning semble impossible à résoudre, documenter pourquoi et proposer une solution

### Sécurité
- Valider toutes les entrées utilisateur (Zod côté serveur, jamais faire confiance au client)
- Utiliser des requêtes paramétrées (Drizzle ORM gère ça nativement, ne jamais construire du SQL à la main)
- Protéger contre XSS, CSRF, injection SQL et les autres vulnérabilités OWASP Top 10
- Toujours vérifier les permissions côté serveur (ne jamais se fier à des vérifications côté client uniquement)
- Ne jamais exposer de secrets, clés API ou données sensibles côté client
- Utiliser des headers de sécurité appropriés (CSP, HSTS, etc.)

### Future-proof
- Privilégier les API stables et les patterns recommandés par la documentation officielle
- Utiliser les dernières versions LTS de Node.js et les versions stables des frameworks
- Éviter les `experimental` features sauf si elles sont en voie de stabilisation
- Écrire du code qui n'aura pas besoin d'être réécrit à la prochaine version majeure
- Préférer les standards web natifs (Fetch API, Web Crypto, Web Streams) aux abstractions tierces quand c'est possible

## Setup d'un nouveau projet

Le guide complet pour initialiser un nouveau SaaS depuis ce boilerplate est dans `docs/SETUP.md`.
Il couvre : clonage, configuration des env vars (avec où les obtenir), suppression des modules inutiles, personnalisation, déploiement.

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
