# Boilerplate Improvements — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Overview

Améliorations du SaaS boilerplate pour combler les manques identifiés. Découpé en 4 lots par priorité.

---

## Lot 1 — Fondations

### 1.1 Bus d'événements

Pièce centrale connectant audit log, webhooks sortants et notifications.

**Structure :**
```
src/features/events/
  emitter.ts          # emitEvent() — point d'entrée unique
  types.ts            # Types d'événements (member.invited, subscription.created, etc.)
  handlers/
    audit-log.ts      # Écrit dans la table audit_log
    webhook.ts        # Envoie via Inngest aux endpoints enregistrés
    notification.ts   # Crée une notification in-app si règle match
```

**Flow :**
```
Server Action → emitEvent("member.invited", { orgId, actorId, data })
                 ├─→ audit_log INSERT (synchrone)
                 ├─→ inngest.send("webhook/deliver", { ... }) (async)
                 └─→ notification INSERT si règle match (synchrone)
```

`emitEvent()` est synchrone pour l'audit log (garantie d'écriture), async pour les webhooks (via Inngest). Les notifications sont synchrones (simple INSERT).

**Gestion d'erreurs :** Chaque handler s'exécute indépendamment (pas de transaction partagée). L'audit log est critique : si son INSERT échoue, l'erreur remonte au caller. Les handlers webhook et notification sont non-critiques : en cas d'échec, l'erreur est loggée (LogTape) mais ne bloque pas l'action appelante. Cela garantit que l'action métier ne fail pas à cause d'une notification manquée.

### 1.2 Audit Log

**Modèle DB :**
```sql
audit_log (
  id            TEXT PK        -- nanoid
  org_id        TEXT FK → organization
  actor_id      TEXT FK → user (nullable pour les actions système)
  action        TEXT           -- "member.invited", "subscription.upgraded"
  resource_type TEXT           -- "member", "subscription", "organization"
  resource_id   TEXT           -- ID de la ressource concernée
  metadata      JSONB          -- Données contextuelles libres
  ip_address    TEXT
  user_agent    TEXT
  created_at    TIMESTAMP
)
```

**Note :** Tous les IDs sont `TEXT` pour rester cohérent avec le schéma existant (Better Auth utilise des IDs texte).

**Index :** `(org_id, created_at)` pour les requêtes filtrées par org + date. Index additionnel sur `(org_id, action)` pour le filtrage par type d'action dans l'admin UI.

**Admin UI :** Page `/admin/audit` avec `data-table` filtrable (par org, par action, par acteur, par date). Réutilise le composant `data-table` existant.

**Rétention :** Config dans `env.ts` (`AUDIT_LOG_RETENTION_DAYS`, défaut 90). Un job Inngest planifié (cron) purge les vieux logs.

### 1.3 Rate Limiting distribué

**Architecture adapter :**
```
src/shared/lib/rate-limit/
  adapter.ts        # Interface RateLimitAdapter { check(key, limit, window): { allowed, remaining, resetAt } }
  memory.ts         # Implémentation mémoire (dev/fallback)
  redis.ts          # Implémentation Redis classique (ioredis) — Node.js runtime uniquement
  upstash.ts        # Implémentation Upstash (@upstash/ratelimit) — Edge compatible
  index.ts          # Factory: lit env RATE_LIMIT_ADAPTER pour choisir
```

**Interface adapter :** La méthode `check(key, limit, window)` accepte `limit` (nombre de requêtes) et `window` (durée en secondes) pour supporter des limites différentes par route (ex: 10 req/min sur `/api/auth/sign-in` vs 100 req/min sur les routes API générales).

**Contrainte Edge Runtime :** Le middleware Next.js tourne en Edge Runtime. L'adapter `redis` (ioredis) utilise le module Node.js `net` et n'est **pas compatible Edge**. Dans le middleware, seuls `memory` et `upstash` sont utilisables. L'adapter `redis` est disponible pour les API route handlers et server actions (Node.js runtime). La factory dans `index.ts` expose deux fonctions : `getRateLimiter()` (pour routes/actions, tous adapters) et `getEdgeRateLimiter()` (pour middleware, memory/upstash uniquement, throw si redis configuré).

**Config env :**
- `RATE_LIMIT_ADAPTER` : `"memory" | "redis" | "upstash"` (défaut `"memory"`)
- `REDIS_URL` : pour l'adapter Redis
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` : pour Upstash

**Intégration middleware :** Remplace le rate limiter in-memory actuel dans `src/middleware.ts` par un appel à `getEdgeRateLimiter()`. Algo sliding window, 100 req/min sur les routes API par défaut, configurable.

### 1.4 CI/CD GitHub Actions

**Workflow unique `.github/workflows/ci.yml` :**

- Trigger: push main + pull_request
- 5 jobs parallèles : lint, typecheck, test (Vitest + PGlite), build, storybook-build
- Matrix: Node 22
- Tests unitaires/intégration utilisent PGlite (pas besoin de service PostgreSQL)
- Tests a11y (axe-core) inclus dans le job test
- Cache: npm cache + Next.js build cache

Pas de deploy — l'utilisateur branche sa plateforme.

---

## Lot 2 — Background Jobs & Monitoring

### 2.1 Inngest (Background Jobs)

**Structure :**
```
src/shared/lib/inngest/
  client.ts         # Inngest client singleton
src/features/jobs/
  functions/
    send-email.ts         # Job envoi d'email (retry 3x backoff)
    deliver-webhook.ts    # Job livraison webhook sortant (retry 5x)
    purge-audit-logs.ts   # Cron daily: purge selon rétention
  index.ts                # Export toutes les functions
src/app/api/inngest/route.ts  # Route handler Inngest (serve)
```

**Impact existant :** Les appels à `sendEmail()` dans les **server actions** (ex: invitation, feedback response) sont remplacés par `inngest.send("jobs/send-email", { ... })`. L'email devient non-bloquant.

**Exception : callbacks Better Auth.** Les fonctions `sendResetPassword` et `sendVerificationEmail` dans `src/features/auth/auth.ts` sont des callbacks synchrones appelés par le framework Better Auth. Ces appels restent **synchrones** (appel direct à `sendEmail()`) car Better Auth attend un retour immédiat. Seuls les emails déclenchés depuis nos propres server actions passent par Inngest.

### 2.2 Monitoring (Sentry + Healthcheck)

**Sentry :**
- Package `@sentry/nextjs` avec instrumentation automatique (errors, performance, replay)
- Config dans `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `instrumentation.ts` pour le hook Next.js
- Variables env : `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Source maps : upload via `@sentry/nextjs` withSentryConfig dans `next.config.ts`. Compatible webpack (build par défaut de Next.js 15). Si Turbopack est utilisé en dev, Sentry fonctionne sans source maps upload (dev uniquement). En production build, webpack est utilisé.

**Healthcheck (`src/app/api/health/route.ts`) :**
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "inngest": "ok"
  },
  "version": "1.0.0",
  "timestamp": "2026-03-19T..."
}
```

Check DB = `SELECT 1`. Check Inngest = vérifie que les variables env `INNGEST_EVENT_KEY` et `INNGEST_SIGNING_KEY` sont définies et que le client peut être instancié (pas de ping réseau, juste un health check de configuration). Si un check fail → status `"degraded"` + HTTP 503.

---

## Lot 3 — Features SaaS avancées

### 3.1 API Keys

**Modèle DB :**
```sql
api_key (
  id          TEXT PK        -- nanoid
  org_id      TEXT FK → organization
  created_by  TEXT FK → user -- utilisateur qui a créé la key
  name        TEXT           -- "Production key", "CI key"
  prefix      TEXT           -- "sk_live_abc1" (8 chars, stocké en clair pour identification)
  hash        TEXT           -- SHA-256 du key complet
  scopes      TEXT[]         -- ["read", "write"] ou ["*"]
  last_used   TIMESTAMP
  expires_at  TIMESTAMP      -- nullable = jamais
  created_at  TIMESTAMP
  revoked_at  TIMESTAMP      -- nullable = active
)
```

Le key complet (`sk_live_xxxxxxxxxxxxxxxxxxxx`) n'est affiché qu'une seule fois à la création. Seul le hash est stocké.

**Sécurité du hash :** SHA-256 est un choix délibéré : les API keys sont générées avec 32 bytes aléatoires (crypto.randomBytes), ce qui donne 256 bits d'entropie — rendant le brute-force infaisable même avec SHA-256. Contrairement aux mots de passe (faible entropie, dictionnaire), les API keys n'ont pas besoin de bcrypt/argon2. SHA-256 permet un lookup O(1) sans coût CPU significatif.

**Middleware API :** Route group `/api/v1/*` protégée par un middleware qui valide le key via le hash. Rate limiting par key.

### 3.2 Webhooks sortants

**Modèle DB :**
```sql
webhook_endpoint (
  id          TEXT PK        -- nanoid
  org_id      TEXT FK → organization
  url         TEXT
  secret      TEXT           -- Généré automatiquement, HMAC-SHA256
  events      TEXT[]         -- ["member.invited", "subscription.*"]
  active      BOOLEAN
  created_at  TIMESTAMP
)

webhook_delivery (
  id              TEXT PK        -- nanoid
  endpoint_id     TEXT FK → webhook_endpoint
  event           TEXT           -- "member.invited"
  payload         JSONB          -- Corps envoyé
  status_code     INTEGER        -- Code HTTP de réponse (nullable si timeout)
  response_body   TEXT           -- Corps de réponse (tronqué à 1KB)
  attempted_at    TIMESTAMP
  next_retry_at   TIMESTAMP      -- nullable si succès ou max retries atteint
  attempt_number  INTEGER        -- 1 à 5
)
```

**Matching des événements :** Pattern glob simple — `*` remplace un segment (ex: `subscription.*` match `subscription.created`, `subscription.cancelled` mais pas `subscription.payment.failed`). `**` match tout (wildcard total). L'algorithme split sur `.` et compare segment par segment.

**UI Settings :** Page `/settings/api` pour gérer API keys (créer, révoquer, voir usage) et webhook endpoints (créer, tester, voir logs de livraison depuis `webhook_delivery`).

**Livraison :** `emitEvent()` → handler webhook query les endpoints matchants → job Inngest par endpoint. Payload signé HMAC-SHA256 dans le header `X-Webhook-Signature`.

### 3.3 Feature Flags

**Modèle DB :**
```sql
feature_flag (
  id          TEXT PK        -- nanoid
  key         TEXT UNIQUE    -- "new-dashboard", "ai-assistant"
  description TEXT
  enabled     BOOLEAN        -- Toggle global
  rules       JSONB          -- [{ type: "plan", value: "pro" }, { type: "org", value: "uuid" }]
  created_at  TIMESTAMP
  updated_at  TIMESTAMP
)
```

**Helper :**
```ts
const enabled = await isFeatureEnabled("new-dashboard", { orgId, planId })
```

Logique : `enabled` = false → toujours off. Si true, vérifie `rules` : vide → tous, sinon match par plan ou org.

**Cache :** Flags cachés en mémoire avec TTL 60s. L'action admin `updateFeatureFlag()` invalide le cache local immédiatement après l'update DB. En multi-instance, les autres instances convergent dans un délai max de 60s (acceptable pour un boilerplate).

**Admin UI :** Page `/admin/features` — data-table avec toggle, édition rules, création/suppression.

**Composant conditionnel (RSC uniquement) :**
```tsx
// React Server Component — utilise isFeatureEnabled() en async
<FeatureGate flag="new-dashboard" fallback={<OldDashboard />}>
  <NewDashboard />
</FeatureGate>
```

`FeatureGate` est un **React Server Component** (async). Pour les Client Components, utiliser le hook `useFeatureFlag(flag)` qui fetch le flag via une API route `/api/features/[key]` (cachée côté serveur).

---

## Lot 4 — Câblage & Polish

### 4.1 Settings câblées

- `settings/profile` → server action `updateProfile()` (nom, avatar, email). Appelle `requireAuth()` et vérifie `session.user.id`.
- `settings/notifications` → server action `updateNotificationPreferences()` (toggle par type). Protégé par `requireAuth()`.
- `settings/danger` → `deleteAccount()` avec confirmation modale. Séquence : (1) annuler l'abonnement Stripe si actif, (2) transférer la propriété des orgs dont l'utilisateur est seul owner (ou supprimer l'org si pas d'autres membres), (3) supprimer le compte (les cascades DB nettoient members, notifications, etc.).

### 4.2 Dashboard réel

- Query `getDashboardStats(orgId)` : membres, plan actuel, notifications non lues, uploads récents
- L'`orgId` est résolu depuis la session via Better Auth organization plugin (`getActiveOrganization()` ou cookie `active-org`)
- Remplacement des données statiques par vraies queries

### 4.3 Changelog admin

- Page `/admin/changelog` avec data-table + formulaire create/edit
- Server actions `createChangelogEntry()`, `updateChangelogEntry()`

### 4.4 Tests exemplaires

- `tests/unit/actions/feedback.test.ts` — Server action avec validation Zod
- `tests/unit/queries/notifications.test.ts` — Query
- `tests/unit/webhook-handler.test.ts` — Stripe webhook handler
- `tests/e2e/onboarding.e2e.ts` — Parcours sign-up → onboarding → dashboard

**Stratégie DB pour les tests :** Les tests unitaires et d'intégration utilisent **PGlite en mémoire** (cohérent avec l'approche dev local du boilerplate). Les migrations sont appliquées au setup du test. Pas besoin de service PostgreSQL externe pour les tests.

Chaque test commenté pour servir de modèle.

### 4.5 Storybook

Stories pour 3-4 composants clés : Button, DataTable, FeedbackModal, PricingTable.

### 4.6 A11y

Test Playwright avec `@axe-core/playwright` sur pages critiques (landing, sign-in, dashboard). Inclus dans le job CI `test`.

---

## Variables d'environnement (nouvelles)

Toutes à déclarer dans `src/shared/lib/env.ts` (T3 Env) :

| Variable | Required | Default | Usage |
|----------|----------|---------|-------|
| `RATE_LIMIT_ADAPTER` | Non | `"memory"` | Adapter rate limit |
| `REDIS_URL` | Si adapter=redis | — | Redis classique |
| `UPSTASH_REDIS_REST_URL` | Si adapter=upstash | — | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Si adapter=upstash | — | Upstash token |
| `AUDIT_LOG_RETENTION_DAYS` | Non | `90` | Rétention audit log |
| `SENTRY_DSN` | Non | — | Sentry error tracking |
| `SENTRY_ORG` | Non | — | Sentry org (build) |
| `SENTRY_PROJECT` | Non | — | Sentry project (build) |
| `INNGEST_EVENT_KEY` | Non | — | Inngest event key |
| `INNGEST_SIGNING_KEY` | Non | — | Inngest signing key |

Toutes optionnelles — le boilerplate fonctionne sans elles (fallback memory rate limit, pas de Sentry, Inngest en mode dev).

## Migrations DB

5 nouvelles tables : `audit_log`, `api_key`, `webhook_endpoint`, `webhook_delivery`, `feature_flag`. Ajout des modèles dans `src/models/` et export depuis `src/models/index.ts`. Migration générée via `npm run db:generate`.

## i18n

Nouvelles clés de traduction à ajouter dans `src/locales/en.json` et `src/locales/fr.json` pour :
- Pages admin : `/admin/audit`, `/admin/features`, `/admin/changelog`
- Page settings : `/settings/api`
- Feature flags : labels, descriptions
- API keys : création, révocation, scopes
- Webhooks : endpoints, delivery status

---

## Décisions techniques

| Choix | Décision | Raison |
|-------|----------|--------|
| Rate limiting | Adapter pattern (memory/redis/upstash) | Cohérent avec upload (local/S3), l'utilisateur choisit |
| Background jobs | Inngest | Standard Next.js serverless, zero infra, DX excellent |
| Monitoring | Sentry + healthcheck maison | Sentry = standard industrie, healthcheck = pragmatique |
| Feature flags | Table DB + helper maison | Self-hosted, zero dépendance, couvre plan-gating + rollout |
| API keys | SHA-256 + 32 bytes random | Pattern standard, entropie suffisante pour SHA-256 |
| Webhooks sortants | Via Inngest + delivery log | Réutilise l'infra jobs, retry/backoff gratuit, traçabilité |
| CI/CD | 1 workflow, 5 jobs parallèles | Agnostique déploiement, inclut storybook build |
| Audit log | Event sourcing léger | Centralise events → audit + webhooks + notifications |
| Tests | Exemplaires + PGlite | Boilerplate = montrer comment, PGlite = zero infra test |
| IDs | TEXT (nanoid) | Cohérent avec le schéma existant (Better Auth) |
