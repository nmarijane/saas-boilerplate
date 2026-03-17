# SaaS Boilerplate — Design Document

**Date:** 2026-03-17
**Status:** Approved
**Approach:** Monolithe modulaire (feature-based)

---

## Overview

Boilerplate Next.js réutilisable pour développer rapidement de nouvelles applications SaaS. Inspiré de [ixartz/Next-js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate), avec Better Auth au lieu de Clerk, Stripe pour le paiement, et zéro service externe payant requis au démarrage.

### Principes

- **Zéro coût récurrent** — aucun service externe payant nécessaire pour démarrer
- **Modulaire** — features isolées, faciles à ajouter/supprimer selon le SaaS
- **Self-hosted first** — tout fonctionne sans dépendance à des services tiers
- **DX first** — TypeScript strict, linting, testing, hot reload

---

## Tech Stack

| Catégorie | Choix |
|---|---|
| Framework | Next.js 16 + App Router + TypeScript + React 19 |
| UI | Tailwind CSS 4 + shadcn/ui + next-themes (dark/light mode) |
| Auth | Better Auth (self-hosted) |
| DB | Drizzle ORM + PostgreSQL (PGlite en local) |
| Paiement | Stripe (plans, checkout, portail client) |
| i18n | next-intl |
| Emails | React Email + Nodemailer (SMTP) |
| Logging | LogTape |
| Testing | Vitest + Playwright + Storybook |
| DX | ESLint (Antfu), Prettier, Lefthook, Commitlint, Knip, T3 Env |
| Déploiement | Vercel + Docker |

---

## Architecture — Structure du projet

```
boilerplate/
├── public/
│   ├── assets/images/
│   ├── favicon.ico
│   └── llms.txt                        # GEO
├── migrations/                          # Drizzle migrations
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (marketing)/             # Landing, pricing, about, changelog, legal
│   │   │   │   ├── page.tsx
│   │   │   │   ├── pricing/
│   │   │   │   ├── about/
│   │   │   │   ├── changelog/
│   │   │   │   ├── legal/
│   │   │   │   │   ├── terms/
│   │   │   │   │   ├── privacy/
│   │   │   │   │   └── mentions/
│   │   │   │   └── layout.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── sign-in/
│   │   │   │   ├── sign-up/
│   │   │   │   ├── forgot-password/
│   │   │   │   ├── verify-email/
│   │   │   │   └── layout.tsx
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── settings/
│   │   │   │   │   ├── profile/
│   │   │   │   │   ├── billing/
│   │   │   │   │   ├── notifications/
│   │   │   │   │   ├── team/
│   │   │   │   │   └── danger/
│   │   │   │   ├── onboarding/
│   │   │   │   └── layout.tsx
│   │   │   ├── (admin)/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── users/
│   │   │   │   │   ├── organizations/
│   │   │   │   │   └── metrics/
│   │   │   │   └── layout.tsx
│   │   │   ├── layout.tsx
│   │   │   └── api/
│   │   │       ├── auth/[...all]/
│   │   │       ├── stripe/webhook/
│   │   │       ├── upload/
│   │   │       ├── notifications/
│   │   │       └── feedback/
│   │   ├── global-error.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── features/
│   │   ├── auth/
│   │   ├── billing/
│   │   ├── dashboard/
│   │   ├── admin/
│   │   ├── notifications/
│   │   ├── onboarding/
│   │   ├── feedback/
│   │   ├── upload/
│   │   └── email/
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── utils/
│   ├── models/
│   ├── locales/
│   │   ├── en.json
│   │   └── fr.json
│   ├── styles/
│   │   └── global.css
│   └── middleware.ts
├── tests/
│   ├── e2e/
│   └── integration/
├── emails/
├── .storybook/
├── .vscode/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── drizzle.config.ts
├── next.config.ts
├── eslint.config.mjs
├── commitlint.config.ts
├── lefthook.yml
├── knip.config.ts
├── tsconfig.json
├── vitest.config.mts
├── playwright.config.ts
└── package.json
```

**Route groups :**
- `(marketing)` — pages publiques avec header/footer marketing
- `(auth)` — pages auth avec layout centré
- `(app)` — app protégée avec sidebar + header
- `(admin)` — panel admin, accès restreint

---

## Authentification (Better Auth)

### Configuration

- Better Auth initialisé dans `features/auth/auth.ts` avec Drizzle adapter
- Routes API via catch-all `api/auth/[...all]/route.ts`
- Session côté serveur via cookies

### Providers

- Email/mot de passe
- Magic links (passwordless)
- Social login : Google, GitHub (extensible)
- MFA (TOTP)

### Tables DB (gérées par Better Auth)

- `user` — profil utilisateur
- `session` — sessions actives
- `account` — providers liés
- `verification` — tokens de vérification

### Fonctionnalités

- Sign up, sign in, sign out
- Email verification via Nodemailer
- Forgot/reset password
- Update profil, update mot de passe
- Delete account (danger zone)
- Guards middleware : redirection auto selon l'état auth

### Structure `features/auth/`

```
features/auth/
  ├── auth.ts              # Config Better Auth serveur
  ├── auth-client.ts       # Client Better Auth (hooks React)
  ├── guards.ts            # Middleware helpers (requireAuth, requireRole)
  ├── hooks/
  │   └── use-session.ts
  ├── components/
  │   ├── sign-in-form.tsx
  │   ├── sign-up-form.tsx
  │   ├── social-buttons.tsx
  │   ├── forgot-password-form.tsx
  │   └── user-menu.tsx
  └── organization/
      ├── queries.ts
      ├── actions.ts
      ├── hooks/
      │   ├── use-organization.ts
      │   └── use-members.ts
      └── components/
          ├── org-switcher.tsx
          ├── invite-modal.tsx
          ├── members-list.tsx
          └── role-badge.tsx
```

### Middleware (`src/middleware.ts`)

3 responsabilités dans cet ordre :
1. **i18n** — détection/redirection de locale via next-intl
2. **Auth** — protection des routes `(app)` et `(admin)`
3. **Rate limiting** — compteur en mémoire par IP sur les routes API

---

## Base de données (Drizzle ORM)

### Setup

- Drizzle ORM avec driver `pg`
- PGlite en local (fichier `local.db`, zéro config)
- Migrations via Drizzle Kit
- Drizzle Studio pour exploration en dev

### Schemas (`models/`)

```
models/
  ├── Schema.ts
  ├── user.ts
  ├── organization.ts
  ├── subscription.ts
  ├── notification.ts
  ├── feedback.ts
  ├── upload.ts
  └── changelog.ts
```

### Tables principales

| Table | Champs principaux | Rôle |
|---|---|---|
| `organization` | id, name, slug, logo, plan, createdAt | Tenant / équipe |
| `organization_member` | userId, orgId, role (owner/admin/member) | RBAC |
| `subscription` | orgId, stripeCustomerId, stripeSubscriptionId, status, planId, currentPeriodEnd | Lien Stripe |
| `plan` | id, name, stripePriceId, features (JSON), limits | Définition des plans |
| `notification` | id, userId, title, body, read, type, link, createdAt | Notifs in-app |
| `feedback` | id, userId, orgId, type, message, status, createdAt | Feedback widget |
| `upload` | id, userId, orgId, filename, mimetype, size, storageKey, createdAt | Fichiers uploadés |
| `changelog_entry` | id, title, content, version, publishedAt | Changelog public |

### Connexion DB

- `shared/lib/DB.ts` — singleton Drizzle, détecte PGlite (dev) vs PostgreSQL (prod) via `DATABASE_URL`
- T3 Env pour validation des variables d'env

---

## Paiement (Stripe)

### Architecture

- Abonnement lié à l'**organisation** (pas à l'utilisateur)
- Plan gratuit par défaut à la création de l'orga
- Upgrade/downgrade via Stripe Checkout Session
- Gestion via Stripe Customer Portal

### Plans préconfigurés

| Plan | Usage |
|---|---|
| Free | Limites basiques |
| Pro | Limites étendues |
| Enterprise | Illimité / custom |

Plans définis en DB (table `plan`) + fichier `features/billing/plans.ts`.

### Webhook (`api/stripe/webhook/`)

Événements gérés :
- `checkout.session.completed` — activation abonnement
- `invoice.paid` — renouvellement réussi
- `invoice.payment_failed` — paiement échoué (notification user)
- `customer.subscription.updated` — changement de plan
- `customer.subscription.deleted` — annulation

### Structure `features/billing/`

```
features/billing/
  ├── stripe.ts
  ├── plans.ts
  ├── helpers.ts
  ├── webhook-handlers.ts
  ├── hooks/
  │   └── use-subscription.ts
  └── components/
      ├── pricing-table.tsx
      ├── plan-badge.tsx
      ├── upgrade-button.tsx
      └── billing-settings.tsx
```

### Garde par plan

Helper `checkPlanLimit(orgId, feature)` pour vérifier les accès côté serveur.

---

## Multi-tenancy & RBAC

### Multi-tenancy

- Utilisateur peut créer/rejoindre plusieurs organisations
- Organisation personnelle créée automatiquement à l'inscription
- Données scopées par `orgId`
- Sélecteur d'organisation dans la sidebar
- Invitation par email (token + expiration)

### RBAC (3 rôles)

| Rôle | Permissions |
|---|---|
| **owner** | Tout (billing, suppression orga, transfert ownership) |
| **admin** | Gestion membres, accès toutes features |
| **member** | Accès features app uniquement |

### Implémentation

- Rôle stocké dans `organization_member.role`
- Helper `requireRole(orgId, userId, minRole)` côté serveur
- Hook `useOrganization()` côté client (orga courante + rôle)
- Affichage conditionnel selon le rôle

### Onboarding (3 étapes)

1. **Profil** — nom, avatar
2. **Organisation** — nom, slug
3. **Invitation** — coéquipiers (optionnel)

Flag `user.onboardingCompleted` pour contrôler l'accès.

### Structure `features/onboarding/`

```
features/onboarding/
  ├── steps.ts
  ├── hooks/
  │   └── use-onboarding.ts
  └── components/
      ├── onboarding-wizard.tsx
      ├── profile-step.tsx
      ├── organization-step.tsx
      └── invite-step.tsx
```

---

## UI & Layouts

### Design system

- shadcn/ui dans `shared/components/ui/`
- Dark/light mode via `next-themes`
- Palette configurable via CSS variables shadcn

### 3 layouts

**Marketing** (`(marketing)/layout.tsx`) — header nav + footer, contenu centré
**Auth** (`(auth)/layout.tsx`) — centré vertical/horizontal, logo + formulaire
**App** (`(app)/layout.tsx`) — sidebar collapsible + header (breadcrumb, notifs, feedback) + main. Responsive : drawer sur mobile.

### Pages marketing

| Page | Contenu |
|---|---|
| Landing | Hero, features grid, social proof, CTA, FAQ |
| Pricing | Tableau comparatif, toggle mensuel/annuel |
| About | Template basique |
| Changelog | Entrées depuis la DB |
| Legal (x3) | CGU, confidentialité, mentions légales |

### Dashboard

Cards de stats, composants réutilisables : `StatCard`, `DataTable`, `EmptyState`, `PageHeader`.

### Admin panel

Users, organizations, métriques (MRR). Accès via flag `isAdmin` sur `user`.

### Structure `shared/components/`

```
shared/components/
  ├── ui/
  ├── layout/
  │   ├── sidebar.tsx
  │   ├── header.tsx
  │   ├── footer.tsx
  │   ├── breadcrumb.tsx
  │   └── theme-toggle.tsx
  ├── marketing/
  │   ├── hero.tsx
  │   ├── features-grid.tsx
  │   ├── faq.tsx
  │   └── cta-section.tsx
  └── data/
      ├── stat-card.tsx
      ├── data-table.tsx
      ├── empty-state.tsx
      └── page-header.tsx
```

---

## Emails, Notifications & Feedback

### Emails transactionnels

- React Email (templating) + Nodemailer (envoi SMTP)
- Preview server local via `email dev`

**Templates :**

| Template | Déclencheur |
|---|---|
| Welcome | Inscription |
| Verify email | Inscription / changement d'email |
| Reset password | Forgot password |
| Invitation | Invitation à rejoindre une orga |
| Payment success | `invoice.paid` |
| Payment failed | `invoice.payment_failed` |
| Subscription cancelled | Annulation Stripe |

### Structure `features/email/`

```
features/email/
  ├── send.ts
  ├── transporter.ts
  └── templates/
      ├── base-layout.tsx
      ├── welcome.tsx
      ├── verify-email.tsx
      ├── reset-password.tsx
      ├── invitation.tsx
      ├── payment-success.tsx
      ├── payment-failed.tsx
      └── subscription-cancelled.tsx
```

### Notifications in-app

- Stockées en DB (table `notification`)
- Cloche + badge dans le header
- Dropdown + page historique
- Helper `createNotification(userId, { title, body, type, link })`

### Structure `features/notifications/`

```
features/notifications/
  ├── actions.ts
  ├── queries.ts
  ├── hooks/
  │   └── use-notifications.ts
  └── components/
      ├── notification-bell.tsx
      ├── notification-dropdown.tsx
      └── notification-list.tsx
```

### Feedback widget

- Bouton dans le header de l'app
- Modal : type (bug/feature/autre) + message + screenshot optionnel
- Stocké en DB, gérable dans l'admin panel (statuts : new/reviewed/done)

### Structure `features/feedback/`

```
features/feedback/
  ├── actions.ts
  ├── queries.ts
  └── components/
      ├── feedback-button.tsx
      ├── feedback-modal.tsx
      └── feedback-admin-list.tsx
```

---

## File Upload

### Architecture

- Adaptateur de stockage interchangeable (pattern Strategy)
- Par défaut : stockage local (`uploads/`)
- Adaptateur S3-compatible prêt à brancher

### Fonctionnement

- Upload via `api/upload/` avec validation (taille max, MIME types)
- Métadonnées en DB (table `upload`)
- Serveur de fichiers via `api/upload/[id]/` avec vérification de permissions
- Fichiers scopés par organisation

### Structure `features/upload/`

```
features/upload/
  ├── storage/
  │   ├── adapter.ts
  │   ├── local.ts
  │   └── s3.ts
  ├── validation.ts
  ├── actions.ts
  ├── queries.ts
  ├── hooks/
  │   └── use-upload.ts
  └── components/
      ├── file-dropzone.tsx
      ├── file-list.tsx
      └── upload-button.tsx
```

### Variables d'env

- `STORAGE_ADAPTER=local|s3`
- `UPLOAD_MAX_SIZE=10485760` (10MB par défaut)
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

---

## SEO & GEO

### SEO

- Metadata dynamique via `generateMetadata()` sur chaque page
- JSON-LD par type : `Organization`, `WebSite`, `FAQPage`, `Product`, `Offer`, `Article`, `WebPage`
- `sitemap.ts` dynamique (pages publiques + locales)
- `robots.ts` (autorise marketing, bloque app/admin)
- Canoniques automatiques via next-intl
- Images optimisées via `next/image`

### Helpers

```
shared/lib/
  ├── seo.ts       # generatePageMetadata(page, locale)
  └── jsonld.ts    # Builders JSON-LD par type
```

### GEO (Generative Engine Optimization)

| Élément | Implémentation |
|---|---|
| `llms.txt` | Fichier statique dans `public/`, template à personnaliser |
| Crawlers IA | `robots.ts` autorise GPTBot, ClaudeBot, PerplexityBot, Google-Extended |
| Contenu citable | Paragraphes courts, listes, définitions claires |
| Données structurées | JSON-LD exhaustif pour AI Overviews |
| Passage-level citability | Headings sémantiques, format question/réponse dans FAQ |

```
shared/lib/
  └── geo.ts       # Meta tags spécifiques GEO

public/
  └── llms.txt
```

---

## Testing & DX

### Testing

| Couche | Outil | Scope |
|---|---|---|
| Unit | Vitest + Browser mode | Composants, helpers, hooks |
| Integration | Vitest | Routes API, actions, queries DB |
| E2E | Playwright | Flows complets |
| Composants | Storybook | Catalogue visuel, tests a11y |

### DX

| Outil | Rôle |
|---|---|
| ESLint (Antfu) | Linting TS, React, Tailwind, a11y |
| Prettier | Formatage |
| Lefthook | Git hooks (pre-commit, commit-msg) |
| Commitlint | Conventional commits |
| Knip | Code mort, dépendances inutilisées |
| T3 Env | Validation variables d'env |
| TypeScript strict | Mode strict |

### VSCode

- Extensions recommandées
- Debug configs (Next.js, Vitest, Playwright)
- Settings (format on save)

---

## Déploiement

### Vercel

- Déploiement natif Next.js
- Variables d'env via dashboard
- `vercel.json` minimal

### Docker

```
docker/
  ├── Dockerfile              # Multi-stage (deps → build → production, node:22-alpine)
  ├── docker-compose.yml      # App + PostgreSQL + volume uploads
  └── .dockerignore
```

Services docker-compose :
- App Next.js (port 3000)
- PostgreSQL (port 5432, volume persistant)
- Volume pour uploads locaux

### Scripts npm

| Script | Action |
|---|---|
| `dev` | Dev local (PGlite + hot reload) |
| `build` | Build production + migration DB |
| `start` | Serveur production |
| `lint` | ESLint |
| `check:types` | TypeScript check |
| `check:deps` | Knip |
| `test` | Vitest |
| `test:e2e` | Playwright |
| `db:generate` | Générer migration Drizzle |
| `db:migrate` | Appliquer migrations |
| `db:studio` | Drizzle Studio |
| `email:dev` | Preview React Email |
| `storybook` | Storybook dev |
| `docker:up` | docker-compose up |
