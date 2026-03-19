# Production Readiness — Design Spec

**Date:** 2026-03-19
**Scope:** Robustesse & production-readiness — top 5 corrections + bonus
**Status:** Approved

---

## Context

Le boilerplate SaaS est fonctionnellement complet (22+ features) mais un audit de production-readiness a révélé des failles de sécurité et des problèmes de robustesse. Ce spec couvre les 5 corrections prioritaires plus un bonus identifié lors de la review.

---

## 1. Authentification des API Routes (CRITIQUE)

### Problème

Les routes API acceptent `userId` et `orgId` depuis le request body ou les query params sans vérifier la session. Un attaquant peut lire/écrire les données de n'importe quel utilisateur.

### Solution

**A. Créer un helper `requireApiAuth()`** dans `src/features/auth/api-auth.ts` :

```typescript
import { auth } from "@/features/auth/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type AuthResult =
  | { authenticated: true; session: Session }
  | { authenticated: false; response: NextResponse };

export async function requireApiAuth(): Promise<AuthResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authenticated: true, session };
}
```

Discriminated union avec `authenticated` pour forcer le narrowing TypeScript — impossible d'oublier le check.

**B. Modifier chaque route API :**

| Route | Méthodes | Changements |
|-------|----------|-------------|
| `/api/feedback` | POST, GET, PATCH | Retirer userId/orgId du body, utiliser session. **PATCH : ajouter vérification admin** (updateFeedbackStatus est admin-only) |
| `/api/notifications` | GET, PATCH | Retirer userId des query params. **markAsRead : ajouter filtre `AND userId = session.user.id`** pour empêcher l'IDOR |
| `/api/upload` | POST | Retirer userId/orgId du FormData, utiliser session + org active |
| `/api/upload/[id]` | GET, DELETE | Ajouter session + **vérification ownership** (upload.userId === session.user.id ou upload.organizationId dans les orgs de l'utilisateur) |

**C. `/api/features/[key]` (GET)** — Reste public volontairement. Les feature flags sont des données non sensibles (clé + enabled). Ajouter un commentaire explicite dans le code pour documenter ce choix.

### Changements aux actions notifications

Les fonctions `markAsRead`, `markAllRead` et `deleteNotification` dans `src/features/notifications/actions.ts` doivent obtenir le `userId` depuis la session (pas en paramètre) et vérifier l'ownership :

```typescript
export async function markAsRead(notifId: string) {
  const session = await requireAuth();
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.id, notifId), eq(notification.userId, session.user.id)));
  revalidatePath("/");
}

export async function markAllRead() {
  const session = await requireAuth();
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.userId, session.user.id), eq(notification.read, false)));
  revalidatePath("/");
}

export async function deleteNotification(notifId: string) {
  const session = await requireAuth();
  await db
    .delete(notification)
    .where(and(eq(notification.id, notifId), eq(notification.userId, session.user.id)));
  revalidatePath("/");
}
```

---

## 2. Contexte Organisation Active (CRITIQUE)

### Problème

Les Server Components n'ont aucun moyen de connaître l'org active. 2 pages settings ont des placeholders (`orgId = ""` et `"placeholder-org-id"`). La page billing n'appelle même pas `requireAuth()`.

### Solution

Better Auth stocke déjà `activeOrganizationId` sur la session quand le plugin organization est activé. Quand le client appelle `authClient.organization.setActive()`, Better Auth persiste l'org active sur le token de session côté serveur.

**A. Helper serveur** — `src/features/auth/organization/active-org.ts` :

```typescript
import { requireAuth } from "@/features/auth/guards";
import { getUserOrganizations } from "./queries";

export async function getActiveOrgId(): Promise<string | null> {
  const session = await requireAuth();

  // Better Auth stores activeOrganizationId on the session
  // when the organization() plugin is active
  const activeOrgId = session.session.activeOrganizationId;

  if (activeOrgId) return activeOrgId;

  // Fallback: première org de l'utilisateur
  const orgs = await getUserOrganizations(session.user.id);
  return orgs[0]?.id ?? null;
}
```

Le type `Session` exporté via `auth.$Infer.Session` inclut `activeOrganizationId` quand le plugin organization est configuré — pas de cast nécessaire.

**B. Modifier les pages settings :**

- `src/app/[locale]/(app)/settings/api/page.tsx` — remplacer `const orgId = ""` par `const orgId = await getActiveOrgId()`. Ajouter un guard si null : redirect vers `/dashboard`.
- `src/app/[locale]/(app)/settings/billing/page.tsx` — supprimer `getCurrentOrgId()`, utiliser `getActiveOrgId()`. Ajouter `requireAuth()` qui manque actuellement.

---

## 3. Headers de Sécurité (HAUT)

### Problème

Aucun header de sécurité configuré. Vulnérable au clickjacking, MIME sniffing, etc.

### Solution

Ajouter dans `next.config.ts` la propriété `headers()` sur l'objet `nextConfig` (avant les wrappers withSentryConfig/withNextIntl) :

```typescript
const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Start with Report-Only, switch to Content-Security-Policy
            // after validation in staging
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://api.stripe.com https://*.sentry.io",
              "frame-src https://js.stripe.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};
```

Notes :
- `frame-ancestors 'none'` renforce X-Frame-Options pour les navigateurs modernes
- `X-DNS-Prefetch-Control: on` améliore la performance perçue
- CSP en `Report-Only` au départ — passer en enforce après tests staging
- `unsafe-inline` nécessaire pour les styles inline de shadcn/ui
- `unsafe-eval` peut être retiré après validation (Next.js dev mode en a besoin)

---

## 4. Error Handling des Server Actions (MOYEN)

### Problème

Les server actions lancent des erreurs brutes au client (`throw new Error("Unauthorized")`). De plus, les actions org (`removeMember`, `changeRole`, `deleteOrganization`) vérifient l'authentification mais **pas le rôle** — n'importe quel utilisateur authentifié peut supprimer n'importe quelle organisation (escalade de privilèges).

### Solution

**A. Créer un wrapper `safeAction()`** dans `src/shared/lib/safe-action.ts` :

```typescript
import { getLogger } from "@logtape/logtape";
import { ZodError } from "zod";

const logger = getLogger(["safe-action"]);

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; validationErrors?: Record<string, string[]> };

export async function safeAction<T>(
  fn: () => Promise<T>,
  errorMessage = "An unexpected error occurred",
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const path = issue.path.join(".");
        validationErrors[path] ??= [];
        validationErrors[path].push(issue.message);
      }
      return { success: false, error: "Validation failed", validationErrors };
    }

    logger.error`Server action failed: ${error}`;
    return { success: false, error: errorMessage };
  }
}
```

Gestion spéciale des `ZodError` pour retourner les erreurs de validation par champ, au lieu du message générique.

**B. Appliquer aux server actions** — wrapper seulement les actions appelées depuis des composants client (pas celles appelées depuis les API routes, pour éviter le changement de type retour) :

Actions à wrapper :
- `src/features/auth/organization/actions.ts` — createOrganization, inviteMember, removeMember, changeRole, deleteOrganization
- `src/features/settings/actions.ts` — updateProfile, deleteAccount
- `src/features/feedback/actions.ts` — submitFeedback, updateFeedbackStatus
- `src/features/notifications/actions.ts` — markAsRead, markAllRead, deleteNotification

Actions dans `src/features/billing/helpers.ts` (createCheckoutSession, createPortalSession) — ne pas wrapper car appelées depuis des API routes et des composants. Le error handling sera fait au call site.

**C. Ajouter les vérifications de rôle** aux actions org :

Les actions `inviteMember`, `removeMember`, `changeRole`, `deleteOrganization` doivent appeler `requireRole(orgId, userId, "admin")` (ou "owner" pour delete) avant d'exécuter l'opération. Le helper `requireRole` existe déjà dans `src/features/auth/guards.ts` mais n'est jamais appelé par ces actions. Note : Better Auth peut enforcer certaines permissions via `createInvitation`, mais on ajoute une vérification explicite par sécurité (defense in depth).

**D. Adapter les composants client** — vérifier `result.success` au lieu de try-catch.

**E. Corriger `global-error.tsx`** — Remplacer `error.message` par un message générique pour ne pas exposer d'informations internes. Le digest est déjà disponible pour le debug côté Sentry.

---

## 5. Index Manquant — `subscription.organizationId` (MOYEN)

### Problème

La colonne `subscription.organizationId` est utilisée dans 4+ requêtes WHERE (`billing/helpers.ts` : createCheckoutSession, createPortalSession, checkPlanLimit, getSubscriptionForOrg) mais n'a pas d'index.

### Solution

Modifier `src/models/subscription.ts` en utilisant le format callback de Drizzle (cohérent avec le reste du codebase) :

```typescript
export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  // ... autres colonnes
}, (t) => [
  index("subscription_org_id_idx").on(t.organizationId),
]);
```

Puis : `npm run db:generate` pour créer la migration.

---

## Ordre d'implémentation

1. **`safeAction` wrapper + `requireApiAuth` helper** — fondations utilisées par les étapes suivantes
2. **Vérifications de rôle dans les actions org** — corrige l'escalade de privilèges
3. **Active org helper** — `getActiveOrgId()` basé sur la session Better Auth
4. **Auth API routes** — modifier les 4 routes pour utiliser requireApiAuth + active org + ownership checks
5. **Pages settings** — wire org context avec `getActiveOrgId()`
6. **`global-error.tsx`** — masquer error.message
7. **Security headers** — `next.config.ts`
8. **Index DB** — migration Drizzle

---

## Hors scope

- JSON-LD sur les pages marketing (priorité basse)
- Consolidation des 47 accès `process.env` directs (priorité basse, pas un risque de sécurité)
- Tests pour les nouvelles fonctionnalités (à ajouter après implémentation)
