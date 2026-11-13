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
      (marketing)/        # Pages publiques (accueil, pricing, about, blog, changelog, legal, waitlist)
      (auth)/             # Connexion : sign-in, sign-up, verify-email, forgot-password, reset-password
      (app)/              # App connectée
        (shell)/          # Pages dans la coque : dashboard, projects, ai, settings, admin
        onboarding/       # Parcours d'accueil, sans la coque
    api/                  # Routes API (hors locale)
  features/               # Modules métier isolés
    registry.ts           # Les features installées, une ligne chacune
    app-shell.ts          # Données de la coque et titres de page (appPageMetadata)
    admin/                # Panel admin (users, orgs, metrics)
    ai/                   # Assistant IA (chat, crédits)
    api-keys/             # Gestion des clés API
    audit/                # Audit log
    auth/                 # Better Auth, organizations, RBAC
    billing/              # Stripe, plans, webhooks
    blog/                 # Blog (articles MDX dans content/blog)
    changelog/            # Changelog produit
    dashboard/            # Accueil de l'espace (activité, premières étapes)
    email/                # Templates React Email
    events/               # Event bus central
    feature-flags/        # Feature flags (plan/org gating)
    feedback/             # Widget feedback
    jobs/                 # Background jobs (Inngest)
    notifications/        # Notifs in-app
    onboarding/           # Wizard d'onboarding
    projects/             # Entité d'exemple (liste, page, réglages)
    settings/             # Settings utilisateur/org
    upload/               # Upload fichiers (local + S3)
    waitlist/             # Liste d'attente
    webhooks/             # Webhook delivery + signatures
  shared/                 # Code partagé entre features (n'importe jamais une feature)
    components/           # ui (primitives), data (en-têtes, états), shell (coque), foundations (stories des fondations), layout, marketing
    config/               # APP_NAME, HELP_URL, préfixes protégés, anciennes adresses
    hooks/                # Hooks React partagés
    lib/                  # DB, env, logger, i18n, SEO, rate-limit
    shell/                # Contrat FeatureShell et assemblage de la vue de la coque
    types/                # Types globaux
    utils/                # Helpers génériques
  models/                 # Schemas Drizzle ORM
  locales/                # Fichiers de traduction (en, fr)
  styles/                 # Tokens (theme.css), mapping Tailwind (global.css), polices (fonts.ts)
  proxy.ts                # Proxy (ex-middleware) — rate limiting, i18n, auth guards
```

## Conventions

- **Feature pattern:** Chaque feature dans `features/` a : `actions.ts`, `queries.ts`, `hooks/`, `components/`, et un `shell.ts` quand elle apparaît dans la coque (ce qu'elle y ajoute)
- **Queries:** `import "server-only"`, **jamais** `"use server"`, retournent des données depuis Drizzle. Appelées par des pages, route handlers ou actions qui ont déjà vérifié la session
- **Actions:** Server Actions avec validation Zod, wrappées dans `safeAction()` pour les mutations client. Chaque fonction exportée commence par une garde (voir Sécurité) et ne renvoie que les champs utiles à l'UI
- **Erreurs de Next dans un `catch`:** `redirect()` et `notFound()` lancent des erreurs que Next attrape plus haut pour envoyer la personne ailleurs (session perdue, rôle insuffisant) ; un `catch` qui entoure un appel au serveur (une action, une garde, le code d'une feature) commence par `unstable_rethrow(error)` (`next/navigation`) et ne les prend jamais pour un échec à annoncer ou à signaler. `tests/unit/redirect-conventions.test.ts` lit chaque `catch` de `src` dont le `try` contient un `await` et échoue s'il ne commence pas par `unstable_rethrow(error)`, sauf si son fichier figure dans la liste du test avec ce qu'il attend (client de Better Auth, `fetch`, presse-papiers, Stripe, journal, base de données, route qui répond du JSON) : un appel au serveur s'attend donc dans un `try`, il ne s'enchaîne pas avec `.catch(`, que le test ne lit pas ; chaque flux a son cas dans son propre fichier de test, avec les vraies erreurs (`tests/helpers/next-errors.ts`). Une action appelée depuis un clic passe par `safeAction()` ou renvoie `{ error }` (comme `createApiKeyAction`), jamais `notFound()` : il ne s'afficherait nulle part (Next ne dessine la page introuvable que pour un rejet relancé pendant un rendu) ; `safeAction` en fait un refus
- **Opérations internes** (event bus, webhooks, jobs) : `service.ts` en `import "server-only"`, jamais exposées comme action
- **Composants:** React Server Components par défaut, Client Components quand nécessaire (`"use client"`)
- **Nommage fichiers:** kebab-case pour les fichiers, PascalCase pour les composants
- **Imports:** absolus avec prefix `@/` (ex: `@/features/auth/auth`)
- **Commits:** conventional commits (commitlint)
- **Ne pas utiliser Clerk** — toujours Better Auth
- **Proxy:** `src/proxy.ts` (pas `middleware.ts` — convention Next.js 16). Il vérifie seulement qu'un cookie de session existe, pour les pages dont le premier segment est dans `APP_PATH_PREFIXES` (`src/shared/config/app.ts`) : une nouvelle page protégée y ajoute son préfixe. Il ne protège rien à lui seul (un cookie falsifié ou expiré passe, et son matcher saute `_next` et les fichiers à extension connue, dont la liste est dans son matcher) : toute page qui lit des données appelle d'abord une garde, `requireAuth`, `requireWorkspace`, `requireAdmin` ou `requireRole`
- **Redirections localisées :** une page se demande avec sa langue (`/fr/sign-in`) ; une redirection vers `/sign-in` nu laisse le proxy ajouter la langue, un second saut pour le navigateur. Une page ou un layout (qui reçoit `params`) appelle le `redirect` localisé de `@/shared/lib/i18n-navigation` avec `locale`, une garde ou une action appelle `redirectTo(href)` (`src/features/auth/redirect-to.ts`), qui lit la langue de la requête (`getLocale()`, posée par le proxy aussi pour les actions). Aucun fichier de `src` n'importe `redirect` ni `permanentRedirect` de `next/navigation` (`tests/unit/localized-redirects.test.ts`) : le seul redirect nu de l'app est `NextResponse.redirect` du proxy, qui construit son adresse avec la langue de l'URL. Un route handler répond en JSON, il ne redirige pas
- **Coque :** une feature qui apparaît dans l'app connectée (liens, quotas, premières étapes, blocs de l'accueil, cloche) le déclare dans son `shell.ts`, un `FeatureShell` (`src/shared/shell/contract.ts`), et `src/features/registry.ts` liste ces features. Ce qu'elle garde pour un espace hors de ses lignes (un abonnement chez Stripe, des fichiers stockés) se nettoie avant la suppression de l'espace : `onWorkspaceDelete`, dans le même `shell.ts`. `src/shared` n'importe rien de `src/features` (`tests/unit/shell/boundaries.test.ts`). Retirer une feature, c'est son dossier et, si elle a un `shell.ts`, sa ligne du registre, plus ce que la Phase 3 de `docs/SETUP.md` liste
- **Boutique (facturation) :** `src/features/billing/plans.ts` (`PLANS`) est la seule source des prix, limites, essais et crédits mensuels (`limits.aiCredits`) : aucune page, aucun composant n'écrit un montant ni un nom de plan (les montants se formatent dans la langue de la page, la devise vient de `BILLING_CURRENCY`). Le navigateur nomme un plan et une période (ou un pack), jamais un prix : `price-ids.ts` les convertit en ids Stripe (`STRIPE_PRICE_*`). Une limite du plan se fait respecter sur le serveur, dans l'action qui crée : `withPlanLimit` (verrou de l'espace, création dans la même transaction : projets, fichiers) ou `assertWithinPlan` (invitations, que Better Auth écrit), de `src/features/plan-limits.ts`, qui ne nomme aucune feature (le registre donne le plan et les compteurs `limits` des `shell.ts`) ; un refus est une `PlanLimitError` que `safeAction` rend `{ success: false, error: "limit_reached", limit }`, et la page affiche `PlanLock` / `LimitNotice` à partir de lui. Le webhook Stripe vérifie la signature, réclame l'événement dans `stripe_event` avant de le traiter (rejoué, il ne change rien) et relit l'abonnement chez Stripe au lieu de croire l'ordre d'arrivée (`syncSubscription`) ; ses tests, comme ceux du paiement, utilisent un client Stripe simulé et des charges signées, jamais le vrai Stripe. Les crédits IA sont deux seaux dans `ai_credit_ledger` (`allocation` du mois UTC, accordée au premier usage et jamais cumulée, `pack` qui n'expire pas), débités dans cet ordre (`src/features/ai/service.ts`)
- **Marque :** `APP_NAME` et `HELP_URL` (`null` retire l'entrée Aide) se règlent dans `src/shared/config/app.ts`
- **Base locale (PGlite) :** un seul processus à la fois sur un dossier PGlite, deux le cassent pour de bon (le suivant échoue sur `RuntimeError: Aborted()`). `src/shared/lib/DB.ts` n'ouvre son client qu'à la première requête : charger le code n'ouvre rien, et les workers de `next dev` et de `next build` chargent les pages sans les interroger. `openPglite()` (`src/shared/lib/pglite-open.ts`) prend d'abord le verrou du dossier (`process-<pid>.lock`, `pglite-lock.ts`) et refuse, en nommant l'autre processus, un dossier déjà tenu ; tout script qui ouvre PGlite passe par lui (`tests/unit/pglite-openers.test.ts` échoue sinon). Un processus a un seul client par dossier : un second `openPglite()` du même dossier rend le même client, partagé avec `DB.ts`, donc on ne le ferme que quand le processus en a fini avec le dossier. Une page que le build dessine ne lit pas la base : le changelog public est en `dynamic = "force-dynamic"` pour cela. Un `local.db` cassé se répare en arrêtant dev, en le supprimant et en relançant `npm run db:seed` (`docs/SETUP.md`, Phase 5)

> **Règle :** `queries.ts` = `import "server-only"`, jamais `"use server"` ; `actions.ts` = `"use server"`, avec une garde en première ligne de chaque fonction. Toute fonction exportée d'un module `"use server"` est appelable par n'importe quel navigateur (POST direct, arguments au choix). `tests/unit/server-action-conventions.test.ts` fait échouer la CI sinon.

## Interface

L'apparence est un jeu de jetons (le thème neutre Graphite) qu'un projet rebrande dans un seul fichier : `src/styles/theme.css` porte la marque, l'encre, les surfaces, les tons, les rayons, les ombres et les polices (`.dark` pour le mode sombre), `src/styles/global.css` les associe aux utilitaires Tailwind, `src/styles/fonts.ts` charge les polices. Les composants vivent dans `src/shared/components/` ; la plupart ont une story (`npm run storybook`). Le rebranding est décrit dans `docs/SETUP.md` (Phase 4).

- **Des primitives, jamais de couleurs brutes.** Construire avec `src/shared/components/ui` (`Button`, `Badge`, `Card`, `Field`, `ProgressBar`...) et les utilitaires de jetons (`bg-surface`, `text-ink-muted`, `bg-success-bg`, `text-danger-text`). Jamais de couleur de la palette Tailwind (`bg-gray-100`, `text-white`), de hex ni de `font-family` dans un composant : ajouter un jeton. `tests/unit/ui/no-raw-palette.test.ts` échoue sinon : il lit tout `src/shared`, `src/features` et `src/app` pour les couleurs, et tout `src` pour les polices. Ses exceptions, chacune avec sa raison dans le test : les logos de services tiers (`social-buttons.tsx`, `connected-accounts.tsx`), la seconde marque de la story « Other brand » (`other-brand.ts`), les pages rendues hors du thème (`global-error.tsx`, `not-found.tsx`), les gabarits d'e-mail (`src/features/email/templates`) et les deux fichiers qui nomment les polices (`theme.css`, `fonts.ts`). Garder les noms shadcn (`bg-primary`, `text-muted-foreground`) : ils sont associés aux jetons, et les composants ajoutés par `npx shadcn add` prennent le thème.
- **Un seul bouton principal par zone** (`Button`, variante par défaut). Les autres actions sont des boutons `outline` ou `ghost`, ou vont dans le menu « ⋯ » de `PageHeader` (`moreActions`, qui demande un composant client : ses handlers sont des fonctions).
- **Pages de l'app connectée.** `PageHeader` coiffe une page de l'app, `EntityHeader` la page d'une chose qui vit dans une liste (jamais les deux), et `SettingsNav` dessine les onglets des réglages (`tests/unit/settings/settings-family.test.ts`). Chaque page porte un titre d'onglet par `appPageMetadata()` (`@/features/app-shell`), un `loading.tsx` (squelette dans `LoadingRegion`) et un `error.tsx` (`RouteError`, `retry`, `useReportError(error)`) dans son dossier ou au-dessus ; le `not-found.tsx` reste dans la coque. `tests/unit/app/route-states.test.ts` lit les dossiers et échoue sinon
- **Listes longues** : une liste se lit par pages, jamais en entier. `pageFrom`, `totalPagesOf` et `clampPage` (`src/shared/utils/pagination.ts`) lisent la page de l'adresse (une page au-delà de la dernière montre la dernière), `Pagination` (`src/shared/components/data`) dessine le pied de liste avec des liens, comme la liste d'attente de l'admin et la liste des projets (`PROJECTS_PAGE_SIZE`).
- **Toasts sur téléphone** : sous 480 px, `Toaster` les place au-dessus de la barre d'onglets, par `--tab-bar-height` (`src/styles/global.css`, posé sur la page quand la coque y est, `0px` sinon) : la hauteur de la barre s'écrit là, une fois, et le défilement et la coque la lisent aussi.
- **États vides, d'erreur et de chargement** : ils viennent de `src/shared/components/data` (`EmptyState`, `ErrorState`, les squelettes). Une page faite de squelettes se place dans `LoadingRegion`, qui annonce « Loading » une seule fois.
- **Textes** : toute chaîne visible va dans `src/locales/en.json` et dans `src/locales/fr.json`.
- **Markdown** : `className="markdown"` (utilitaire de `src/styles/global.css`) dessine le markdown d'un texte que l'app n'écrit pas, comme les réponses de l'assistant et les articles du blog (`mdx-content.tsx`, qui y ajoute sa mesure, `--markdown-heading-gap` et `scroll-mt`) : paragraphes, titres, listes, citations, code, tableaux, avec les jetons du thème. La base de Tailwind remet tout cela à zéro et aucun plugin typographie n'est installé (`prose` ne dessine rien). Un bloc de code ou un tableau qui défile prend le focus (`chat-message.tsx`).
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
  - Un test qui vérifie qu'un type refuse une valeur lit le type avec `expectTypeOf<Accepts<Props, Valeur>>().toEqualTypeOf<false>()` (`tests/helpers/types.ts`, lu par `npm run check:types`), ou envoie à l'action un objet gardé dans une variable (un champ en trop n'est refusé que sur un littéral) ; jamais un `@ts-expect-error`
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
curl http://localhost:3088/api/agent-docs | jq '.endpoints[].path'
```

## Setup d'un nouveau projet

Le guide complet pour initialiser un nouveau SaaS depuis ce boilerplate est dans `docs/SETUP.md`.
Il couvre : clonage, configuration des env vars (avec où les obtenir), suppression des modules inutiles (billing, notifications, upload, entité d'exemple), personnalisation (marque, coque, captures du README), base de données et comptes de démonstration, déploiement.

## Commandes

```bash
# Dev
npm run dev              # Dev local (PGlite + hot reload)
npm run storybook        # Storybook sur port 6006
npm run email:dev        # Preview des templates email
npm run screenshots      # Captures du README dans docs/screenshots (arrêter npm run dev avant ; npx playwright install chromium une fois)

# Qualité
npm run lint             # ESLint
npm run check:types      # TypeScript type check
npm run check:deps       # Dépendances inutiles (Knip)
npm run format           # Prettier

# Tests
npm run test             # Vitest (unit + integration)
npm run test:watch       # Vitest en watch mode
npm run test:e2e         # Playwright E2E : build, serveur sur le port 3090, base PGlite jetable ensemencée (`.e2e/`) ; ne touche ni `npm run dev` ni `./local.db`

# Base de données
npm run db:generate      # Générer migration Drizzle
npm run db:migrate       # Appliquer migrations à PostgreSQL (DATABASE_URL) ; PGlite : db:seed
npm run db:studio        # Drizzle Studio
npm run db:seed          # Applique les migrations (PGlite compris) puis seed (plans, admin, dev user, espace de démo Acme et Northwind hors production) ; relançable (arrêter npm run dev avant : il tient ./local.db, et le seed refuse un dossier qu'un autre processus tient). Les comptes (mot de passe connu) ne sont créés ni en production ni sur une base qui n'est pas locale (localhost, 127.0.0.1), sauf avec SEED_DEMO=1 ; le seed affiche la base visée. PGlite écrit dans ./local.db, ou dans PGLITE_DATA_DIR. Le seed, db:migrate et db:generate lisent `.env.local` comme l'app (une variable déjà posée, même vide, l'emporte)

# Production
npm run build            # Build production
npm start                # Serveur production
npm run docker:up        # Docker Compose
```
