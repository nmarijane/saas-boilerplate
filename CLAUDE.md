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
- **Jobs:** Inngest (background tasks, retries)
- **Logging:** LogTape
- **Monitoring:** Sentry
- **Testing:** Vitest + Playwright + Storybook
- **CI/CD:** GitHub Actions + Dependabot + Claude Code Review
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
    admin/                # Panel admin (users, orgs, metrics)
    api-keys/             # Gestion des clés API
    audit/                # Audit log
    auth/                 # Better Auth, organizations, RBAC
    billing/              # Stripe, plans, webhooks
    changelog/            # Changelog produit
    dashboard/            # Dashboard avec stats
    email/                # Templates React Email
    events/               # Event bus central (17 types)
    feature-flags/        # Feature flags (plan/org gating)
    feedback/             # Widget feedback
    jobs/                 # Background jobs (Inngest)
    notifications/        # Notifs in-app
    onboarding/           # Wizard d'onboarding
    settings/             # Settings utilisateur/org
    upload/               # Upload fichiers (local + S3)
    webhooks/             # Webhook delivery + signatures
  shared/                 # Code partagé entre features
    components/           # shadcn/ui + composants réutilisables
    hooks/                # Hooks React partagés
    lib/                  # DB, env, logger, i18n, SEO, rate-limit
    types/                # Types globaux
    utils/                # Helpers génériques
  models/                 # Schemas Drizzle ORM
  locales/                # Fichiers de traduction (en, fr)
  styles/                 # Tokens (theme.css), mapping Tailwind (global.css), polices (fonts.ts)
  proxy.ts                # Proxy (ex-middleware) — rate limiting, i18n, auth guards
```

## Conventions

- **Feature pattern:** Chaque feature dans `features/` a : `actions.ts`, `queries.ts`, `hooks/`, `components/`
- **Queries:** `import "server-only"`, **jamais** `"use server"`, retournent des données depuis Drizzle. Appelées par des pages, route handlers ou actions qui ont déjà vérifié la session
- **Actions:** Server Actions avec validation Zod, wrappées dans `safeAction()` pour les mutations client. Chaque fonction exportée commence par une garde (voir Sécurité) et ne renvoie que les champs utiles à l'UI
- **Opérations internes** (event bus, webhooks, jobs) : `service.ts` en `import "server-only"`, jamais exposées comme action
- **Composants:** React Server Components par défaut, Client Components quand nécessaire (`"use client"`)
- **Nommage fichiers:** kebab-case pour les fichiers, PascalCase pour les composants
- **Imports:** absolus avec prefix `@/` (ex: `@/features/auth/auth`)
- **Commits:** conventional commits (commitlint)
- **Ne pas utiliser Clerk** — toujours Better Auth
- **Proxy:** `src/proxy.ts` (pas `middleware.ts` — convention Next.js 16)

> **Règle :** `queries.ts` = `import "server-only"`, jamais `"use server"` ; `actions.ts` = `"use server"`, avec une garde en première ligne de chaque fonction. Toute fonction exportée d'un module `"use server"` est appelable par n'importe quel navigateur (POST direct, arguments au choix). `tests/unit/server-action-conventions.test.ts` fait échouer la CI sinon.

## Interface

L'apparence est un jeu de jetons (le thème neutre Graphite) qu'un projet rebrande dans un seul fichier : `src/styles/theme.css` porte la marque, l'encre, les surfaces, les tons, les rayons, les ombres et les polices (`.dark` pour le mode sombre), `src/styles/global.css` les associe aux utilitaires Tailwind, `src/styles/fonts.ts` charge les polices. Les composants vivent dans `src/shared/components/` ; la plupart ont une story (`npm run storybook`). Le rebranding est décrit dans `docs/SETUP.md` (Phase 4).

- **Des primitives, jamais de couleurs brutes.** Construire avec `src/shared/components/ui` (`Button`, `Badge`, `Card`, `Field`, `ProgressBar`...) et les utilitaires de jetons (`bg-surface`, `text-ink-muted`, `bg-success-bg`, `text-danger-text`). Jamais de couleur de la palette Tailwind (`bg-gray-100`, `text-white`), de hex ni de `font-family` dans un composant : ajouter un jeton. `tests/unit/ui/no-raw-palette.test.ts` échoue sinon. Garder les noms shadcn (`bg-primary`, `text-muted-foreground`) : ils sont associés aux jetons, et les composants ajoutés par `npx shadcn add` prennent le thème.
- **Un seul bouton principal par zone** (`Button`, variante par défaut). Les autres actions sont des boutons `outline` ou `ghost`, ou vont dans le menu « ⋯ » de `PageHeader` (`moreActions`, qui demande un composant client : ses handlers sont des fonctions).
- **États vides, d'erreur et de chargement** : ils viennent de `src/shared/components/data` (`EmptyState`, `ErrorState`, les squelettes). Une page faite de squelettes se place dans `LoadingRegion`, qui annonce « Loading » une seule fois.
- **Textes** : toute chaîne visible va dans `src/locales/en.json` et dans `src/locales/fr.json`.
- **Cibles et libellés.** Les commandes portent `tap-target` (une zone de clic de 44 px) : les empiler à au moins 12 px d'écart, sinon leurs couches se volent les clics. Un lien au milieu d'une phrase n'a pas de `tap-target` ; un lien seul sur sa ligne l'ajoute (`className="tap-target"`). Garder des libellés de bouton courts : `Button` ne passe pas à la ligne.
- **Mode sombre et contraste.** Un nouveau jeton de couleur reçoit aussi une valeur dans `.dark`. Lancer `npx vitest run tests/unit/ui/theme-contrast.test.ts` après toute modification de `theme.css` (texte 4,5:1, commandes 3:1, dans les deux modes).

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
- Gardes (`src/features/auth/guards.ts`), en première ligne de chaque server action : `requireAdmin()` pour l'admin de la plateforme, `requireRole(orgId, minRole)` pour une organisation, `requireAuth()` pour les ressources de l'utilisateur. L'utilisateur vient toujours de la session, jamais d'un `userId` reçu du client ; une ressource se lit ou s'écrit filtrée par son `orgId` ou son `userId`
- Les pages admin appellent elles-mêmes `requireAdmin()` : le layout ne suffit pas (il n'est pas rejoué à chaque navigation)
- Une action publique par nature (ex. `joinWaitlist`) est déclarée dans `PUBLIC_ACTIONS` avec sa justification, valide ses entrées avec Zod et appelle `enforceActionRateLimit()`

### Future-proof
- Privilégier les API stables et les patterns recommandés par la documentation officielle
- Utiliser les dernières versions LTS de Node.js et les versions stables des frameworks
- Éviter les `experimental` features sauf si elles sont en voie de stabilisation
- Écrire du code qui n'aura pas besoin d'être réécrit à la prochaine version majeure
- Préférer les standards web natifs (Fetch API, Web Crypto, Web Streams) aux abstractions tierces quand c'est possible

## Agent-Readable API Schema

This boilerplate exposes a machine-readable API schema for AI coding agents at:

```
GET /api/agent-docs
```

No authentication required. Returns a JSON schema of all available endpoints, their auth requirements, request/response shapes, and auth instructions. Designed to be consumed by agents (Claude Code, Codex, etc.) when building integrations or testing API calls against this SaaS.

Example:
```bash
curl http://localhost:3000/api/agent-docs | jq '.endpoints[].path'
```

## Setup d'un nouveau projet

Le guide complet pour initialiser un nouveau SaaS depuis ce boilerplate est dans `docs/SETUP.md`.
Il couvre : clonage, configuration des env vars (avec où les obtenir), suppression des modules inutiles, personnalisation, déploiement.

## Commandes

```bash
# Dev
npm run dev              # Dev local (PGlite + hot reload)
npm run storybook        # Storybook sur port 6006
npm run email:dev        # Preview des templates email

# Qualité
npm run lint             # ESLint
npm run check:types      # TypeScript type check
npm run check:deps       # Dépendances inutiles (Knip)
npm run format           # Prettier

# Tests
npm run test             # Vitest (unit + integration)
npm run test:watch       # Vitest en watch mode
npm run test:e2e         # Playwright E2E

# Base de données
npm run db:generate      # Générer migration Drizzle
npm run db:migrate       # Appliquer migrations
npm run db:studio        # Drizzle Studio
npm run db:seed          # Seed DB (plans, admin, dev user)

# Production
npm run build            # Build production
npm start                # Serveur production
npm run docker:up        # Docker Compose
```
