# Engagement Features: User Presence + Achievements

**Date:** 2026-04-01
**Approche retenue:** Deux features indépendantes (Approche A)
**Transport temps réel:** SSE (Server-Sent Events) + heartbeat POST

---

## Vue d'ensemble

Deux features modulaires pour améliorer l'engagement et la rétention :

1. **User Presence** — Statut en ligne/idle/offline temps réel des membres d'une organisation, avec indication de la page courante
2. **Achievements** — Système de badges/achievements persistant basé sur l'usage (streaks de connexion, actions réalisées), visible dans le profil

Les deux features sont indépendantes et supprimables. L'event bus existant sert de pont : la présence émet `presence.changed`, que les achievements écoutent pour calculer les streaks.

---

## Feature 1 : User Presence

### Modèle de données

Table `user_presence` :

| Colonne          | Type                                | Description                                  |
| ---------------- | ----------------------------------- | -------------------------------------------- |
| id               | uuid PK                             |                                              |
| userId           | text FK -> user                     |                                              |
| organizationId   | text FK -> organization             |                                              |
| currentPage      | text                                | Path de la page courante (ex: `/dashboard`)  |
| status           | enum `online` / `idle` / `offline`  | Calculé côté serveur                         |
| lastSeenAt       | timestamp                           | Mis à jour à chaque heartbeat                |

Index : `(organizationId, status)` pour requêter les membres en ligne d'une org.

### Flux

1. **Heartbeat (POST `/api/presence/heartbeat`)** — le client envoie `{ page }` toutes les 30s. Le serveur upsert `user_presence` avec `lastSeenAt = now()` et `status = online`.
2. **SSE (GET `/api/presence/stream`)** — le client ouvre une connexion SSE au mount. Le serveur poll la table toutes les 5s et pousse les changements (diff) aux connectés de la même org.
3. **Expiration** — un user sans heartbeat depuis 60s passe `idle`, depuis 120s passe `offline`. Le calcul se fait au moment du poll SSE (pas de cron).
4. **Cleanup** — à chaque poll, les entrées `offline` depuis >24h sont supprimées.

### API

- `POST /api/presence/heartbeat` — Body: `{ page: string }`. Auth requise. Upsert la présence du user dans son org active.
- `GET /api/presence/stream` — SSE. Auth requise. Retourne les events `presence-update` avec la liste des membres et leur statut pour l'org active.

### Composants

- **`PresenceProvider`** (`src/features/presence/components/presence-provider.tsx`) — Context React qui gère le heartbeat + SSE, expose `usePresence()`. Wrappé dans le layout `(app)`.
- **`PresenceIndicator`** (`src/features/presence/components/presence-indicator.tsx`) — Point vert/jaune/gris à côté d'un avatar. Props: `userId`, `size`.
- **`PresenceList`** (`src/features/presence/components/presence-list.tsx`) — Liste des membres en ligne dans la sidebar, avec la page où ils se trouvent.
- **`usePresence()`** (`src/features/presence/hooks/use-presence.ts`) — Hook : retourne `{ onlineMembers, currentUserStatus }`.

### Intégration event bus

Émet `presence.changed` avec payload `{ userId, organizationId, status, previousStatus }` quand un user change de statut. Les achievements écoutent cet event pour les streaks.

### Structure fichiers

```
src/features/presence/
  components/
    presence-provider.tsx
    presence-indicator.tsx
    presence-list.tsx
  hooks/
    use-presence.ts
  queries.ts          # getPresenceForOrg()
  actions.ts          # upsertPresence()
  helpers.ts          # calcul expiration, diff
```

```
src/app/api/presence/
  heartbeat/route.ts
  stream/route.ts
```

---

## Feature 2 : Achievements

### Modèle de données

Table `achievement` (définitions) :

| Colonne     | Type                                                 | Description                               |
| ----------- | ---------------------------------------------------- | ----------------------------------------- |
| id          | uuid PK                                              |                                           |
| key         | text unique                                          | Identifiant machine (ex: `team-builder`)  |
| name        | text                                                 | Nom affiché                               |
| description | text                                                 | Condition en langage naturel              |
| icon        | text                                                 | Nom d'icône Lucide                        |
| category    | enum `onboarding` / `social` / `usage` / `streak`   | Pour grouper dans l'UI                    |
| threshold   | integer                                              | Nombre requis pour débloquer              |
| points      | integer                                              | Points attribués au unlock                |
| createdAt   | timestamp                                            |                                           |

Table `user_achievement` (unlocks) :

| Colonne       | Type                    | Description                                   |
| ------------- | ----------------------- | --------------------------------------------- |
| id            | uuid PK                 |                                               |
| userId        | text FK -> user         |                                               |
| achievementId | uuid FK -> achievement  |                                               |
| progress      | integer default 0       | Progression actuelle vers le threshold        |
| unlockedAt    | timestamp nullable      | null = en cours, date = débloqué              |
| createdAt     | timestamp               |                                               |

Index unique : `(userId, achievementId)`.

Table `user_streak` :

| Colonne       | Type                | Description                          |
| ------------- | ------------------- | ------------------------------------ |
| id            | uuid PK             |                                      |
| userId        | text FK -> user     |                                      |
| lastLoginDate | date                | Dernier jour de connexion            |
| currentStreak | integer default 0   | Nombre de jours consécutifs          |

Index unique : `(userId)`.

### Achievements de base (seed)

| Key                | Catégorie   | Condition                         | Threshold | Points |
| ------------------ | ----------- | --------------------------------- | --------- | ------ |
| `first-login`      | onboarding  | Première connexion                | 1         | 10     |
| `profile-complete` | onboarding  | Profil complété (nom + avatar)    | 1         | 20     |
| `team-builder`     | social      | Inviter des membres               | 5         | 50     |
| `feedback-giver`   | usage       | Envoyer des feedbacks             | 3         | 30     |
| `api-creator`      | usage       | Créer des clés API                | 1         | 20     |
| `streak-3`         | streak      | 3 jours consécutifs connecté      | 3         | 30     |
| `streak-7`         | streak      | 7 jours consécutifs               | 7         | 70     |
| `streak-30`        | streak      | 30 jours consécutifs              | 30        | 300    |

### Moteur de progression

Un handler `achievement` est ajouté à l'event bus (à côté de audit-log, webhook, notification) :

```
Event reçu
  -> lookup quels achievements sont liés à cet event type
  -> incrémenter progress sur user_achievement (upsert)
  -> si progress >= threshold et unlockedAt est null
    -> set unlockedAt = now()
    -> émettre event achievement.unlocked
```

Mapping events -> achievements :

| Event              | Achievement(s)                    |
| ------------------ | --------------------------------- |
| `member.invited`   | `team-builder`                    |
| `feedback.created` | `feedback-giver`                  |
| `api-key.created`  | `api-creator`                     |
| `presence.changed` | `streak-3`, `streak-7`, `streak-30` (via calcul streak) |

Pour `first-login` et `profile-complete`, le check se fait au login et à la mise à jour du profil respectivement.

### Logique des streaks

À chaque event `presence.changed` avec `status = online` :

1. Lookup `user_streak` pour le userId
2. Si `lastLoginDate` = hier -> `currentStreak++`
3. Si `lastLoginDate` = aujourd'hui -> rien
4. Sinon -> `currentStreak = 1`
5. Update `lastLoginDate = today`
6. Check achievements streak-3/7/30 selon le nouveau `currentStreak`

### API

- `GET /api/achievements` — Liste tous les achievements avec la progression du user connecté.

### Composants

- **`AchievementToast`** (`src/features/achievements/components/achievement-toast.tsx`) — Toast animé (via Sonner) quand un badge est débloqué.
- **`AchievementGrid`** (`src/features/achievements/components/achievement-grid.tsx`) — Grille de badges organisée par catégorie. Badges verrouillés grisés avec barre de progression.
- **`AchievementBadge`** (`src/features/achievements/components/achievement-badge.tsx`) — Badge individuel avec icône Lucide, nom, état (locked/unlocked/in-progress).
- **`AchievementSummary`** (`src/features/achievements/components/achievement-summary.tsx`) — Widget sidebar : "5/8 badges - 120 pts".

### Pages

- `/settings/achievements` — Page complète avec grille par catégorie + stats (total points, badges débloqués, streak en cours).

### Structure fichiers

```
src/features/achievements/
  components/
    achievement-toast.tsx
    achievement-grid.tsx
    achievement-badge.tsx
    achievement-summary.tsx
  hooks/
    use-achievements.ts
  queries.ts           # getAchievements(), getUserAchievements(), getUserStreak()
  actions.ts           # progressAchievement(), checkStreak()
  helpers.ts           # mapping events->achievements, calcul streak
  handler.ts           # handler event bus
  seed.ts              # données de seed des achievements de base
```

```
src/app/[locale]/(app)/settings/achievements/page.tsx
```

---

## Intégration entre les features

```
[Heartbeat POST] -> upsertPresence() -> event bus: presence.changed
                                              |
                                              v
[SSE stream] <- poll presence table     [Achievement handler]
                                              |
                                              v
                                        checkStreak() -> user_streak update
                                              |
                                              v
                                        progressAchievement() -> event bus: achievement.unlocked
                                              |
                                              v
                                        [AchievementToast via SSE ou polling]
```

Les deux features communiquent uniquement via l'event bus. Supprimer `presence/` désactive les streaks mais les autres achievements continuent de fonctionner. Supprimer `achievements/` n'impacte pas la présence.

---

## Nouveaux events à ajouter au bus

| Event                | Payload                                                 |
| -------------------- | ------------------------------------------------------- |
| `presence.changed`   | `{ userId, organizationId, status, previousStatus }`   |
| `achievement.unlocked` | `{ userId, achievementId, achievementKey, points }`   |

---

## i18n

Toutes les chaînes UI (noms de badges, descriptions, labels) passent par next-intl. Les clés de traduction sont ajoutées dans `src/locales/en.json` et `src/locales/fr.json` sous les namespaces `presence` et `achievements`.

---

## Tests

- **Vitest** : logique streak (calcul jours consécutifs), moteur de progression (threshold, idempotence), helpers de présence (expiration, diff)
- **Storybook** : AchievementBadge (3 états), AchievementGrid, PresenceIndicator (3 statuts), PresenceList
- **Playwright** : flow complet heartbeat -> présence visible, déblocage d'un achievement
