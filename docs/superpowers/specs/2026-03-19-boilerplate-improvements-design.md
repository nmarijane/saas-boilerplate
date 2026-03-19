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

### 1.2 Audit Log

**Modèle DB :**
```sql
audit_log (
  id            UUID PK
  org_id        UUID FK → organization
  actor_id      UUID FK → user (nullable pour les actions système)
  action        TEXT       -- "member.invited", "subscription.upgraded"
  resource_type TEXT       -- "member", "subscription", "organization"
  resource_id   UUID       -- ID de la ressource concernée
  metadata      JSONB      -- Données contextuelles libres
  ip_address    TEXT
  user_agent    TEXT
  created_at    TIMESTAMP
)
```

Index sur `(org_id, created_at)` pour les requêtes filtrées par org.

**Admin UI :** Page `/admin/audit` avec `data-table` filtrable (par org, par action, par acteur, par date). Réutilise le composant `data-table` existant.

**Rétention :** Config dans `env.ts` (`AUDIT_LOG_RETENTION_DAYS`, défaut 90). Un job Inngest planifié (cron) purge les vieux logs.

### 1.3 Rate Limiting distribué

**Architecture adapter :**
```
src/shared/lib/rate-limit/
  adapter.ts        # Interface RateLimitAdapter { check(key): { allowed, remaining, resetAt } }
  memory.ts         # Implémentation mémoire (dev/fallback)
  redis.ts          # Implémentation Redis classique (ioredis)
  upstash.ts        # Implémentation Upstash (@upstash/ratelimit)
  index.ts          # Factory: lit env RATE_LIMIT_ADAPTER pour choisir
```

**Config env :**
- `RATE_LIMIT_ADAPTER` : `"memory" | "redis" | "upstash"` (défaut `"memory"`)
- `REDIS_URL` : pour l'adapter Redis
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` : pour Upstash

**Intégration middleware :** Remplace le rate limiter in-memory actuel dans `src/middleware.ts` par un appel au nouvel adapter. Algo sliding window, 100 req/min sur les routes API par défaut, configurable.

### 1.4 CI/CD GitHub Actions

**Workflow unique `.github/workflows/ci.yml` :**

- Trigger: push main + pull_request
- 4 jobs parallèles : lint, typecheck, test, build
- Matrix: Node 22
- DB: Service container PostgreSQL 16 pour les tests
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

**Impact existant :** Les appels directs à `sendEmail()` dans les server actions sont remplacés par `inngest.send("jobs/send-email", { ... })`. L'email devient non-bloquant.

### 2.2 Monitoring (Sentry + Healthcheck)

**Sentry :**
- Package `@sentry/nextjs` avec instrumentation automatique (errors, performance, replay)
- Config dans `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `instrumentation.ts` pour le hook Next.js
- Variables env : `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Source maps uploadées au build via le plugin webpack Sentry

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

Check DB = `SELECT 1`. Check Inngest = ping client. Si un check fail → status `"degraded"` + HTTP 503.

---

## Lot 3 — Features SaaS avancées

### 3.1 API Keys

**Modèle DB :**
```sql
api_key (
  id          UUID PK
  org_id      UUID FK → organization
  name        TEXT          -- "Production key", "CI key"
  prefix      TEXT          -- "sk_live_abc1" (8 chars, stocké en clair pour identification)
  hash        TEXT          -- SHA-256 du key complet
  scopes      TEXT[]        -- ["read", "write"] ou ["*"]
  last_used   TIMESTAMP
  expires_at  TIMESTAMP     -- nullable = jamais
  created_at  TIMESTAMP
  revoked_at  TIMESTAMP     -- nullable = active
)
```

Le key complet (`sk_live_xxxxxxxxxxxxxxxxxxxx`) n'est affiché qu'une seule fois à la création. Seul le hash est stocké.

**Middleware API :** Route group `/api/v1/*` protégée par middleware validant le key via hash. Rate limiting par key.

### 3.2 Webhooks sortants

**Modèle DB :**
```sql
webhook_endpoint (
  id          UUID PK
  org_id      UUID FK → organization
  url         TEXT
  secret      TEXT          -- Généré automatiquement, HMAC-SHA256
  events      TEXT[]        -- ["member.invited", "subscription.*"]
  active      BOOLEAN
  created_at  TIMESTAMP
)
```

**UI Settings :** Page `/settings/api` pour gérer API keys (créer, révoquer, voir usage) et webhook endpoints (créer, tester, voir logs).

**Livraison :** `emitEvent()` → handler webhook query les endpoints matchants → job Inngest par endpoint. Payload signé HMAC-SHA256 dans le header `X-Webhook-Signature`.

### 3.3 Feature Flags

**Modèle DB :**
```sql
feature_flag (
  id          UUID PK
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

**Cache :** Flags cachés en mémoire avec TTL 60s.

**Admin UI :** Page `/admin/features` — data-table avec toggle, édition rules, création/suppression.

**Composant conditionnel :**
```tsx
<FeatureGate flag="new-dashboard" fallback={<OldDashboard />}>
  <NewDashboard />
</FeatureGate>
```

---

## Lot 4 — Câblage & Polish

### 4.1 Settings câblées

- `settings/profile` → server action `updateProfile()` (nom, avatar, email)
- `settings/notifications` → server action `updateNotificationPreferences()` (toggle par type)
- `settings/danger` → `deleteAccount()` avec confirmation modale

### 4.2 Dashboard réel

- Query `getDashboardStats(orgId)` : membres, plan actuel, notifications non lues, uploads récents
- Remplacement des données statiques par vraies queries

### 4.3 Changelog admin

- Page `/admin/changelog` avec data-table + formulaire create/edit
- Server actions `createChangelogEntry()`, `updateChangelogEntry()`

### 4.4 Tests exemplaires

- `tests/unit/actions/feedback.test.ts` — Server action avec validation Zod
- `tests/unit/queries/notifications.test.ts` — Query
- `tests/unit/webhook-handler.test.ts` — Stripe webhook handler
- `tests/e2e/onboarding.e2e.ts` — Parcours sign-up → onboarding → dashboard
- Chaque test commenté pour servir de modèle

### 4.5 Storybook

Stories pour 3-4 composants clés : Button, DataTable, FeedbackModal, PricingTable.

### 4.6 A11y

Test Playwright avec `@axe-core/playwright` sur pages critiques (landing, sign-in, dashboard).

---

## Décisions techniques

| Choix | Décision | Raison |
|-------|----------|--------|
| Rate limiting | Adapter pattern (memory/redis/upstash) | Cohérent avec upload (local/S3), l'utilisateur choisit |
| Background jobs | Inngest | Standard Next.js serverless, zero infra, DX excellent |
| Monitoring | Sentry + healthcheck maison | Sentry = standard industrie, healthcheck = pragmatique |
| Feature flags | Table DB + helper maison | Self-hosted, zero dépendance, couvre plan-gating + rollout |
| API keys | Hash SHA-256, préfixe identifiable | Pattern standard (Stripe, OpenAI) |
| Webhooks sortants | Via Inngest | Réutilise l'infra jobs, retry/backoff gratuit |
| CI/CD | 1 workflow, 4 jobs parallèles | Agnostique déploiement |
| Audit log | Event sourcing léger | Centralise events → audit + webhooks + notifications |
| Tests | Exemplaires, pas exhaustifs | Boilerplate = montrer comment, pas tout tester |
