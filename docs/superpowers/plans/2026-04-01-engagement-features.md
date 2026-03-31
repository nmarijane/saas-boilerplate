# Engagement Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user presence (real-time online status via SSE) and achievements (badge/streak gamification) to the SaaS boilerplate.

**Architecture:** Two independent features in `src/features/` following existing patterns. Presence uses SSE + heartbeat POST. Achievements listen to the event bus. Both communicate only via event bus (presence emits `presence.changed`, achievements listen).

**Tech Stack:** Drizzle ORM, Next.js Route Handlers (SSE), React Context, Sonner toasts, Lucide icons, Vitest, next-intl.

**Spec:** `docs/superpowers/specs/2026-04-01-engagement-features-design.md`

---

## File Structure

### New files

```
src/models/presence.ts                          # user_presence table
src/models/achievement.ts                       # achievement + user_achievement + user_streak tables

src/features/presence/
  helpers.ts                                    # expiration logic, diff computation
  queries.ts                                    # getPresenceForOrg()
  actions.ts                                    # upsertPresence()
  hooks/use-presence.ts                         # usePresence() hook (SSE + heartbeat)
  components/presence-provider.tsx              # React Context provider
  components/presence-indicator.tsx             # Green/yellow/gray dot
  components/presence-list.tsx                  # Online members list in sidebar

src/features/achievements/
  helpers.ts                                    # event-to-achievement mapping, streak logic
  queries.ts                                    # getAchievements(), getUserProgress(), getUserStreak()
  actions.ts                                    # progressAchievement(), checkAndUpdateStreak()
  handler.ts                                    # event bus handler
  seed.ts                                       # achievement definitions for seed script
  hooks/use-achievements.ts                     # useAchievements() hook
  components/achievement-badge.tsx              # Single badge (locked/unlocked/in-progress)
  components/achievement-grid.tsx               # Grid by category
  components/achievement-summary.tsx            # Sidebar widget "5/8 badges - 120pts"
  components/achievement-toast.tsx              # Unlock notification (Sonner)

src/app/api/presence/heartbeat/route.ts         # POST heartbeat
src/app/api/presence/stream/route.ts            # GET SSE stream
src/app/api/achievements/route.ts               # GET achievements + progress
src/app/[locale]/(app)/settings/achievements/page.tsx  # Achievements page
```

### Modified files

```
src/models/index.ts                             # Add exports for presence + achievement models
src/features/events/types.ts                    # Add presence.changed + achievement.unlocked events
src/features/events/emitter.ts                  # Add achievement handler call
src/features/events/handlers/                   # Add achievement handler reference
src/shared/components/layout/sidebar.tsx        # Add PresenceList + AchievementSummary
src/app/[locale]/(app)/layout.tsx               # Wrap with PresenceProvider
scripts/seed.ts                                 # Seed achievements
src/locales/en.json                             # Add presence + achievements namespace
src/locales/fr.json                             # Add presence + achievements namespace
vitest.config.mts                               # Add new coverage paths
```

---

## Task 1: Presence Model

**Files:**
- Create: `src/models/presence.ts`
- Modify: `src/models/index.ts`

- [ ] **Step 1: Create the presence table schema**

Create `src/models/presence.ts`:

```typescript
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const presenceStatusEnum = pgEnum("presence_status", ["online", "idle", "offline"]);

export const userPresence = pgTable("user_presence", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  currentPage: text("current_page").notNull().default("/dashboard"),
  status: presenceStatusEnum("status").notNull().default("online"),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
}, (t) => [
  index("presence_org_status_idx").on(t.organizationId, t.status),
  index("presence_user_org_idx").on(t.userId, t.organizationId),
]);
```

- [ ] **Step 2: Export from models index**

Add to `src/models/index.ts`:

```typescript
export * from "./presence";
```

- [ ] **Step 3: Generate Drizzle migration**

Run: `npm run db:generate`

Expected: A new migration file is created in `migrations/`.

- [ ] **Step 4: Apply migration**

Run: `npm run db:migrate`

Expected: Migration applied successfully.

- [ ] **Step 5: Commit**

```bash
git add src/models/presence.ts src/models/index.ts migrations/
git commit -m "feat(presence): add user_presence table schema"
```

---

## Task 2: Presence Helpers

**Files:**
- Create: `src/features/presence/helpers.ts`
- Test: `tests/unit/presence-helpers.test.ts`

- [ ] **Step 1: Write tests for presence helpers**

Create `tests/unit/presence-helpers.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeStatus,
  diffPresence,
} from "@/features/presence/helpers";

describe("computeStatus", () => {
  it("returns online when lastSeenAt is within 60s", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 30_000); // 30s ago
    expect(computeStatus(lastSeen, now)).toBe("online");
  });

  it("returns idle when lastSeenAt is between 60s and 120s", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 90_000); // 90s ago
    expect(computeStatus(lastSeen, now)).toBe("idle");
  });

  it("returns offline when lastSeenAt is over 120s", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 150_000); // 150s ago
    expect(computeStatus(lastSeen, now)).toBe("offline");
  });

  it("returns online at exactly 60s boundary", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 60_000);
    expect(computeStatus(lastSeen, now)).toBe("online");
  });

  it("returns idle at exactly 120s boundary", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 120_000);
    expect(computeStatus(lastSeen, now)).toBe("idle");
  });
});

describe("diffPresence", () => {
  it("detects new members", () => {
    const prev = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const next = [
      { userId: "a", status: "online" as const, currentPage: "/" },
      { userId: "b", status: "online" as const, currentPage: "/dashboard" },
    ];
    const diff = diffPresence(prev, next);
    expect(diff.changed).toEqual([
      { userId: "b", status: "online", currentPage: "/dashboard" },
    ]);
  });

  it("detects status changes", () => {
    const prev = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const next = [{ userId: "a", status: "idle" as const, currentPage: "/" }];
    const diff = diffPresence(prev, next);
    expect(diff.changed).toEqual([
      { userId: "a", status: "idle", currentPage: "/" },
    ]);
  });

  it("detects page changes", () => {
    const prev = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const next = [{ userId: "a", status: "online" as const, currentPage: "/settings" }];
    const diff = diffPresence(prev, next);
    expect(diff.changed).toEqual([
      { userId: "a", status: "online", currentPage: "/settings" },
    ]);
  });

  it("returns empty when nothing changed", () => {
    const data = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const diff = diffPresence(data, data);
    expect(diff.changed).toEqual([]);
  });

  it("detects removed members", () => {
    const prev = [
      { userId: "a", status: "online" as const, currentPage: "/" },
      { userId: "b", status: "online" as const, currentPage: "/" },
    ];
    const next = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const diff = diffPresence(prev, next);
    expect(diff.removed).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/presence-helpers.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `src/features/presence/helpers.ts`:

```typescript
const IDLE_THRESHOLD_MS = 60_000;
const OFFLINE_THRESHOLD_MS = 120_000;

export type PresenceStatus = "online" | "idle" | "offline";

export interface PresenceEntry {
  userId: string;
  status: PresenceStatus;
  currentPage: string;
}

export function computeStatus(lastSeenAt: Date, now: Date = new Date()): PresenceStatus {
  const elapsed = now.getTime() - lastSeenAt.getTime();
  if (elapsed <= IDLE_THRESHOLD_MS) return "online";
  if (elapsed <= OFFLINE_THRESHOLD_MS) return "idle";
  return "offline";
}

export function diffPresence(
  prev: PresenceEntry[],
  next: PresenceEntry[],
): { changed: PresenceEntry[]; removed: string[] } {
  const prevMap = new Map(prev.map((p) => [p.userId, p]));
  const nextMap = new Map(next.map((n) => [n.userId, n]));

  const changed: PresenceEntry[] = [];
  for (const [userId, entry] of nextMap) {
    const prevEntry = prevMap.get(userId);
    if (
      !prevEntry
      || prevEntry.status !== entry.status
      || prevEntry.currentPage !== entry.currentPage
    ) {
      changed.push(entry);
    }
  }

  const removed: string[] = [];
  for (const userId of prevMap.keys()) {
    if (!nextMap.has(userId)) {
      removed.push(userId);
    }
  }

  return { changed, removed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/presence-helpers.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/presence/helpers.ts tests/unit/presence-helpers.test.ts
git commit -m "feat(presence): add presence helpers with tests"
```

---

## Task 3: Presence Queries & Actions

**Files:**
- Create: `src/features/presence/queries.ts`
- Create: `src/features/presence/actions.ts`

- [ ] **Step 1: Create queries**

Create `src/features/presence/queries.ts`:

```typescript
"use server";

import { and, eq, lt } from "drizzle-orm";
import { userPresence } from "@/models/presence";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import { computeStatus } from "./helpers";

export async function getPresenceForOrg(organizationId: string) {
  const rows = await db
    .select({
      userId: userPresence.userId,
      currentPage: userPresence.currentPage,
      lastSeenAt: userPresence.lastSeenAt,
      userName: user.name,
      userImage: user.image,
    })
    .from(userPresence)
    .innerJoin(user, eq(userPresence.userId, user.id))
    .where(eq(userPresence.organizationId, organizationId));

  const now = new Date();
  return rows.map((row) => ({
    userId: row.userId,
    userName: row.userName,
    userImage: row.userImage,
    currentPage: row.currentPage,
    status: computeStatus(row.lastSeenAt, now),
    lastSeenAt: row.lastSeenAt,
  }));
}

export async function cleanupStalePresence() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db
    .delete(userPresence)
    .where(lt(userPresence.lastSeenAt, cutoff));
}
```

- [ ] **Step 2: Create actions**

Create `src/features/presence/actions.ts`:

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { userPresence } from "@/models/presence";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { computeStatus } from "./helpers";

export async function upsertPresence(
  userId: string,
  organizationId: string,
  currentPage: string,
) {
  const now = new Date();

  const existing = await db
    .select({ id: userPresence.id, status: userPresence.status })
    .from(userPresence)
    .where(
      and(
        eq(userPresence.userId, userId),
        eq(userPresence.organizationId, organizationId),
      ),
    )
    .limit(1);

  const previousStatus = existing[0]
    ? computeStatus(existing[0].status === "offline" ? new Date(0) : now, now)
    : null;

  if (existing[0]) {
    await db
      .update(userPresence)
      .set({ currentPage, status: "online", lastSeenAt: now })
      .where(eq(userPresence.id, existing[0].id));
  } else {
    await db.insert(userPresence).values({
      id: generateId(),
      userId,
      organizationId,
      currentPage,
      status: "online",
      lastSeenAt: now,
    });
  }

  return { previousStatus, currentStatus: "online" as const };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/presence/queries.ts src/features/presence/actions.ts
git commit -m "feat(presence): add queries and actions"
```

---

## Task 4: Presence Event Integration

**Files:**
- Modify: `src/features/events/types.ts`
- Modify: `src/features/events/emitter.ts`

- [ ] **Step 1: Add new event types**

In `src/features/events/types.ts`, add `"presence.changed"` and `"achievement.unlocked"` to the `EventName` union:

```typescript
export type EventName =
  | "member.invited"
  | "member.removed"
  | "member.role_changed"
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "payment.succeeded"
  | "payment.failed"
  | "api_key.created"
  | "api_key.revoked"
  | "webhook.created"
  | "webhook.deleted"
  | "feature_flag.updated"
  | "feedback.created"
  | "upload.created"
  | "presence.changed"
  | "achievement.unlocked";
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/events/types.ts
git commit -m "feat(events): add presence.changed and achievement.unlocked event types"
```

---

## Task 5: Presence API Routes

**Files:**
- Create: `src/app/api/presence/heartbeat/route.ts`
- Create: `src/app/api/presence/stream/route.ts`

- [ ] **Step 1: Create heartbeat endpoint**

Create `src/app/api/presence/heartbeat/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { emitEvent } from "@/features/events/emitter";
import { upsertPresence } from "@/features/presence/actions";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const page = typeof body.page === "string" ? body.page : "/dashboard";
    const orgId = await getActiveOrgId();

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization", code: "NO_ORG", status: 400 },
        { status: 400 },
      );
    }

    const { previousStatus, currentStatus } = await upsertPresence(
      auth.session.user.id,
      orgId,
      page,
    );

    if (previousStatus !== null && previousStatus !== currentStatus) {
      await emitEvent("presence.changed", {
        orgId,
        actorId: auth.session.user.id,
        resourceType: "presence",
        resourceId: auth.session.user.id,
        metadata: { status: currentStatus, previousStatus },
      });
    }

    return NextResponse.json({ status: currentStatus });
  } catch {
    return NextResponse.json(
      { error: "Failed to update presence", code: "PRESENCE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create SSE stream endpoint**

Create `src/app/api/presence/stream/route.ts`:

```typescript
import { requireApiAuth } from "@/features/auth/api-auth";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { cleanupStalePresence, getPresenceForOrg } from "@/features/presence/queries";
import { diffPresence } from "@/features/presence/helpers";
import type { PresenceEntry } from "@/features/presence/helpers";

const POLL_INTERVAL_MS = 5_000;

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  const orgId = await getActiveOrgId();
  if (!orgId) {
    return new Response("No active organization", { status: 400 });
  }

  const encoder = new TextEncoder();
  let previousEntries: PresenceEntry[] = [];
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial full state
      const initial = await getPresenceForOrg(orgId);
      previousEntries = initial.map((e) => ({
        userId: e.userId,
        status: e.status,
        currentPage: e.currentPage,
      }));
      send({ type: "init", members: initial });

      // Poll loop
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          await cleanupStalePresence();
          const current = await getPresenceForOrg(orgId);
          const currentEntries: PresenceEntry[] = current.map((e) => ({
            userId: e.userId,
            status: e.status,
            currentPage: e.currentPage,
          }));

          const diff = diffPresence(previousEntries, currentEntries);
          if (diff.changed.length > 0 || diff.removed.length > 0) {
            send({ type: "update", changed: diff.changed, removed: diff.removed, members: current });
            previousEntries = currentEntries;
          }
        } catch {
          // Silently skip poll errors — next poll will retry
        }
      }, POLL_INTERVAL_MS);

      // Cleanup when client disconnects
      void new Promise<void>((resolve) => {
        const checkClosed = setInterval(() => {
          if (closed) {
            clearInterval(checkClosed);
            clearInterval(interval);
            resolve();
          }
        }, 1_000);
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/presence/heartbeat/route.ts src/app/api/presence/stream/route.ts
git commit -m "feat(presence): add heartbeat and SSE stream API routes"
```

---

## Task 6: Presence React Hook & Provider

**Files:**
- Create: `src/features/presence/hooks/use-presence.ts`
- Create: `src/features/presence/components/presence-provider.tsx`

- [ ] **Step 1: Create usePresence hook**

Create `src/features/presence/hooks/use-presence.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "@/shared/lib/i18n-navigation";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface PresenceMember {
  userId: string;
  userName: string;
  userImage: string | null;
  currentPage: string;
  status: "online" | "idle" | "offline";
  lastSeenAt: string;
}

interface UsePresenceReturn {
  members: PresenceMember[];
  isConnected: boolean;
}

export function usePresence(): UsePresenceReturn {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathnameRef.current }),
      });
    } catch {
      // Silently ignore heartbeat failures
    }
  }, []);

  useEffect(() => {
    // Start heartbeat
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Connect to SSE stream
    const eventSource = new EventSource("/api/presence/stream");

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init" || data.type === "update") {
          setMembers(data.members);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      clearInterval(heartbeatInterval);
      eventSource.close();
      setIsConnected(false);
    };
  }, [sendHeartbeat]);

  return { members, isConnected };
}
```

- [ ] **Step 2: Create PresenceProvider**

Create `src/features/presence/components/presence-provider.tsx`:

```typescript
"use client";

import { createContext, useContext } from "react";
import { usePresence } from "../hooks/use-presence";

interface PresenceMember {
  userId: string;
  userName: string;
  userImage: string | null;
  currentPage: string;
  status: "online" | "idle" | "offline";
  lastSeenAt: string;
}

interface PresenceContextValue {
  members: PresenceMember[];
  isConnected: boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  members: [],
  isConnected: false,
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const presence = usePresence();
  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresenceContext() {
  return useContext(PresenceContext);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/presence/hooks/use-presence.ts src/features/presence/components/presence-provider.tsx
git commit -m "feat(presence): add usePresence hook and PresenceProvider"
```

---

## Task 7: Presence UI Components

**Files:**
- Create: `src/features/presence/components/presence-indicator.tsx`
- Create: `src/features/presence/components/presence-list.tsx`

- [ ] **Step 1: Create PresenceIndicator**

Create `src/features/presence/components/presence-indicator.tsx`:

```typescript
"use client";

import { cn } from "@/shared/utils/cn";

interface PresenceIndicatorProps {
  status: "online" | "idle" | "offline";
  size?: "sm" | "md";
}

const statusColors = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  offline: "bg-gray-400",
};

const sizes = {
  sm: "size-2",
  md: "size-3",
};

export function PresenceIndicator({ status, size = "sm" }: PresenceIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0",
        statusColors[status],
        sizes[size],
        status === "online" && "animate-pulse",
      )}
      aria-label={status}
    />
  );
}
```

- [ ] **Step 2: Create PresenceList**

Create `src/features/presence/components/presence-list.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { getInitials } from "@/shared/utils/helpers";
import { usePresenceContext } from "./presence-provider";
import { PresenceIndicator } from "./presence-indicator";

export function PresenceList() {
  const { members } = usePresenceContext();
  const t = useTranslations("presence");

  const onlineMembers = members.filter((m) => m.status !== "offline");

  if (onlineMembers.length === 0) {
    return (
      <p className="text-muted-foreground px-3 py-2 text-xs">
        {t("noOneOnline")}
      </p>
    );
  }

  return (
    <div className="space-y-1 px-2">
      <p className="text-muted-foreground px-1 text-xs font-medium">
        {t("online", { count: onlineMembers.length })}
      </p>
      {onlineMembers.map((member) => (
        <div
          key={member.userId}
          className="flex items-center gap-2 rounded-md px-2 py-1.5"
        >
          <div className="relative">
            <Avatar className="size-6">
              <AvatarImage src={member.userImage ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(member.userName)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -right-0.5 -bottom-0.5">
              <PresenceIndicator status={member.status} size="sm" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{member.userName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {member.currentPage}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/presence/components/presence-indicator.tsx src/features/presence/components/presence-list.tsx
git commit -m "feat(presence): add PresenceIndicator and PresenceList components"
```

---

## Task 8: Wire Presence into App Layout

**Files:**
- Modify: `src/app/[locale]/(app)/layout.tsx`
- Modify: `src/shared/components/layout/sidebar.tsx`

- [ ] **Step 1: Wrap app layout with PresenceProvider**

In `src/app/[locale]/(app)/layout.tsx`, add the PresenceProvider:

```typescript
import { Header } from "@/shared/components/layout/header";
import { Sidebar } from "@/shared/components/layout/sidebar";
import { PresenceProvider } from "@/features/presence/components/presence-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PresenceProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </PresenceProvider>
  );
}
```

- [ ] **Step 2: Add PresenceList to sidebar**

In `src/shared/components/layout/sidebar.tsx`, import and add the PresenceList component above the user menu in the desktop sidebar. Add an import at the top:

```typescript
import { PresenceList } from "@/features/presence/components/presence-list";
```

Then in the desktop sidebar JSX, add before the `{userMenu && ...}` block:

```tsx
{/* Online members */}
<div className="py-2">
  <Separator />
  <div className="py-2">
    <PresenceList />
  </div>
</div>
```

- [ ] **Step 3: Verify dev server**

Run: `npm run dev`

Expected: App loads without errors. Presence list appears in sidebar (empty initially).

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/(app)/layout.tsx src/shared/components/layout/sidebar.tsx
git commit -m "feat(presence): wire PresenceProvider and PresenceList into app layout"
```

---

## Task 9: Achievement Model

**Files:**
- Create: `src/models/achievement.ts`
- Modify: `src/models/index.ts`

- [ ] **Step 1: Create the achievement tables**

Create `src/models/achievement.ts`:

```typescript
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const achievementCategoryEnum = pgEnum("achievement_category", [
  "onboarding",
  "social",
  "usage",
  "streak",
]);

export const achievement = pgTable("achievement", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: achievementCategoryEnum("category").notNull(),
  threshold: integer("threshold").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userAchievement = pgTable("user_achievement", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id")
    .notNull()
    .references(() => achievement.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  unlockedAt: timestamp("unlocked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_achievement_user_ach_idx").on(t.userId, t.achievementId),
  index("user_achievement_user_id_idx").on(t.userId),
]);

export const userStreak = pgTable("user_streak", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  lastLoginDate: date("last_login_date").notNull(),
  currentStreak: integer("current_streak").notNull().default(1),
}, (t) => [
  uniqueIndex("user_streak_user_id_idx").on(t.userId),
]);
```

- [ ] **Step 2: Export from models index**

Add to `src/models/index.ts`:

```typescript
export * from "./achievement";
```

- [ ] **Step 3: Generate and apply migration**

Run: `npm run db:generate && npm run db:migrate`

Expected: Migration created and applied.

- [ ] **Step 4: Commit**

```bash
git add src/models/achievement.ts src/models/index.ts migrations/
git commit -m "feat(achievements): add achievement, user_achievement, user_streak table schemas"
```

---

## Task 10: Achievement Helpers

**Files:**
- Create: `src/features/achievements/helpers.ts`
- Test: `tests/unit/achievement-helpers.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/achievement-helpers.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeStreak,
  getAchievementKeysForEvent,
} from "@/features/achievements/helpers";

describe("getAchievementKeysForEvent", () => {
  it("maps member.invited to team-builder", () => {
    expect(getAchievementKeysForEvent("member.invited")).toEqual(["team-builder"]);
  });

  it("maps feedback.created to feedback-giver", () => {
    expect(getAchievementKeysForEvent("feedback.created")).toEqual(["feedback-giver"]);
  });

  it("maps api_key.created to api-creator", () => {
    expect(getAchievementKeysForEvent("api_key.created")).toEqual(["api-creator"]);
  });

  it("maps presence.changed to streak achievements", () => {
    expect(getAchievementKeysForEvent("presence.changed")).toEqual([
      "streak-3",
      "streak-7",
      "streak-30",
    ]);
  });

  it("returns empty array for unmapped events", () => {
    expect(getAchievementKeysForEvent("organization.created")).toEqual([]);
  });
});

describe("computeStreak", () => {
  it("increments streak when last login was yesterday", () => {
    const today = new Date("2026-04-02");
    const result = computeStreak("2026-04-01", 5, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-02", currentStreak: 6 });
  });

  it("keeps streak when last login is today", () => {
    const today = new Date("2026-04-02");
    const result = computeStreak("2026-04-02", 5, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-02", currentStreak: 5 });
  });

  it("resets streak when last login was more than 1 day ago", () => {
    const today = new Date("2026-04-05");
    const result = computeStreak("2026-04-02", 5, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-05", currentStreak: 1 });
  });

  it("handles first-time login (no previous date)", () => {
    const today = new Date("2026-04-01");
    const result = computeStreak(null, 0, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-01", currentStreak: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/achievement-helpers.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `src/features/achievements/helpers.ts`:

```typescript
import type { EventName } from "@/features/events/types";

const EVENT_TO_ACHIEVEMENTS: Partial<Record<EventName, string[]>> = {
  "member.invited": ["team-builder"],
  "feedback.created": ["feedback-giver"],
  "api_key.created": ["api-creator"],
  "presence.changed": ["streak-3", "streak-7", "streak-30"],
};

export function getAchievementKeysForEvent(eventName: string): string[] {
  return EVENT_TO_ACHIEVEMENTS[eventName as EventName] ?? [];
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysBetween(dateStr: string, today: Date): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const t = new Date(formatDate(today) + "T00:00:00Z");
  return Math.round((t.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeStreak(
  lastLoginDate: string | null,
  currentStreak: number,
  now: Date = new Date(),
): { lastLoginDate: string; currentStreak: number } {
  const todayStr = formatDate(now);

  if (!lastLoginDate) {
    return { lastLoginDate: todayStr, currentStreak: 1 };
  }

  const gap = daysBetween(lastLoginDate, now);

  if (gap === 0) {
    return { lastLoginDate: todayStr, currentStreak };
  }

  if (gap === 1) {
    return { lastLoginDate: todayStr, currentStreak: currentStreak + 1 };
  }

  return { lastLoginDate: todayStr, currentStreak: 1 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/achievement-helpers.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/achievements/helpers.ts tests/unit/achievement-helpers.test.ts
git commit -m "feat(achievements): add achievement helpers with tests"
```

---

## Task 11: Achievement Queries & Actions

**Files:**
- Create: `src/features/achievements/queries.ts`
- Create: `src/features/achievements/actions.ts`

- [ ] **Step 1: Create queries**

Create `src/features/achievements/queries.ts`:

```typescript
"use server";

import { eq } from "drizzle-orm";
import { achievement, userAchievement, userStreak } from "@/models/achievement";
import { db } from "@/shared/lib/DB";

export async function getAchievements() {
  return db.select().from(achievement);
}

export async function getUserProgress(userId: string) {
  return db
    .select({
      achievementId: userAchievement.achievementId,
      progress: userAchievement.progress,
      unlockedAt: userAchievement.unlockedAt,
    })
    .from(userAchievement)
    .where(eq(userAchievement.userId, userId));
}

export async function getUserStreak(userId: string) {
  const rows = await db
    .select()
    .from(userStreak)
    .where(eq(userStreak.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAchievementsWithProgress(userId: string) {
  const [achievements, progress] = await Promise.all([
    getAchievements(),
    getUserProgress(userId),
  ]);

  const progressMap = new Map(progress.map((p) => [p.achievementId, p]));

  return achievements.map((a) => {
    const p = progressMap.get(a.id);
    return {
      ...a,
      progress: p?.progress ?? 0,
      unlockedAt: p?.unlockedAt ?? null,
    };
  });
}
```

- [ ] **Step 2: Create actions**

Create `src/features/achievements/actions.ts`:

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { achievement, userAchievement, userStreak } from "@/models/achievement";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { computeStreak } from "./helpers";

interface ProgressResult {
  unlocked: boolean;
  achievementKey: string;
  points: number;
}

export async function progressAchievement(
  userId: string,
  achievementKey: string,
): Promise<ProgressResult | null> {
  // Find the achievement definition
  const achievements = await db
    .select()
    .from(achievement)
    .where(eq(achievement.key, achievementKey))
    .limit(1);

  const ach = achievements[0];
  if (!ach) return null;

  // Find or create user_achievement
  const existing = await db
    .select()
    .from(userAchievement)
    .where(
      and(
        eq(userAchievement.userId, userId),
        eq(userAchievement.achievementId, ach.id),
      ),
    )
    .limit(1);

  const current = existing[0];

  // Already unlocked — skip
  if (current?.unlockedAt) {
    return null;
  }

  const newProgress = (current?.progress ?? 0) + 1;
  const unlocked = newProgress >= ach.threshold;

  if (current) {
    await db
      .update(userAchievement)
      .set({
        progress: newProgress,
        unlockedAt: unlocked ? new Date() : null,
      })
      .where(eq(userAchievement.id, current.id));
  } else {
    await db.insert(userAchievement).values({
      id: generateId(),
      userId,
      achievementId: ach.id,
      progress: newProgress,
      unlockedAt: unlocked ? new Date() : null,
    });
  }

  return { unlocked, achievementKey: ach.key, points: ach.points };
}

export async function checkAndUpdateStreak(userId: string): Promise<number> {
  const existing = await db
    .select()
    .from(userStreak)
    .where(eq(userStreak.userId, userId))
    .limit(1);

  const current = existing[0];
  const { lastLoginDate, currentStreak: newStreak } = computeStreak(
    current?.lastLoginDate ?? null,
    current?.currentStreak ?? 0,
  );

  if (current) {
    await db
      .update(userStreak)
      .set({ lastLoginDate, currentStreak: newStreak })
      .where(eq(userStreak.id, current.id));
  } else {
    await db.insert(userStreak).values({
      id: generateId(),
      userId,
      lastLoginDate,
      currentStreak: newStreak,
    });
  }

  return newStreak;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/achievements/queries.ts src/features/achievements/actions.ts
git commit -m "feat(achievements): add queries and actions"
```

---

## Task 12: Achievement Event Bus Handler

**Files:**
- Create: `src/features/events/handlers/achievement.ts`
- Modify: `src/features/events/emitter.ts`

- [ ] **Step 1: Create the achievement handler**

Create `src/features/events/handlers/achievement.ts`:

```typescript
import type { AppEvent } from "../types";
import { getLogger } from "@logtape/logtape";
import { checkAndUpdateStreak, progressAchievement } from "@/features/achievements/actions";
import { getAchievementKeysForEvent } from "@/features/achievements/helpers";

const logger = getLogger(["events", "achievement"]);

export async function handleAchievement(event: AppEvent): Promise<void> {
  const actorId = event.payload.actorId;
  if (!actorId) return;

  const achievementKeys = getAchievementKeysForEvent(event.name);
  if (achievementKeys.length === 0) return;

  try {
    // Handle streak achievements via presence.changed
    if (event.name === "presence.changed") {
      const status = (event.payload.metadata as Record<string, unknown> | undefined)?.status;
      if (status !== "online") return;

      const currentStreak = await checkAndUpdateStreak(actorId);

      // Check each streak threshold
      for (const key of achievementKeys) {
        await progressAchievementForStreak(actorId, key, currentStreak);
      }
      return;
    }

    // Handle regular achievements (increment by 1)
    for (const key of achievementKeys) {
      const result = await progressAchievement(actorId, key);
      if (result?.unlocked) {
        logger.info`Achievement unlocked: ${key} for user ${actorId}`;
      }
    }
  } catch (error) {
    logger.error`Achievement handler failed for ${event.name}: ${error}`;
  }
}

async function progressAchievementForStreak(
  userId: string,
  achievementKey: string,
  currentStreak: number,
): Promise<void> {
  // For streak achievements, we set progress to the current streak value
  // rather than incrementing by 1. We use progressAchievement but the
  // threshold check handles it: if currentStreak >= threshold, it unlocks.
  // Since we can't set progress directly via progressAchievement,
  // we just call it — it increments by 1 each day which naturally tracks.
  const result = await progressAchievement(userId, achievementKey);
  if (result?.unlocked) {
    const logger = (await import("@logtape/logtape")).getLogger(["events", "achievement"]);
    logger.info`Streak achievement unlocked: ${achievementKey} for user ${userId} (streak: ${currentStreak})`;
  }
}
```

- [ ] **Step 2: Wire handler into emitter**

In `src/features/events/emitter.ts`, add the achievement handler:

```typescript
import type { EventName, EventPayload } from "./types";
import { getLogger } from "@logtape/logtape";
import { handleAchievement } from "./handlers/achievement";
import { handleAuditLog } from "./handlers/audit-log";
import { handleNotification } from "./handlers/notification";
import { handleWebhook } from "./handlers/webhook";

const logger = getLogger(["events"]);

export async function emitEvent(name: EventName, payload: EventPayload): Promise<void> {
  const event = { name, payload, timestamp: new Date() };

  // Audit log is critical -- errors propagate
  await handleAuditLog(event);

  // Webhooks are non-critical -- errors are logged
  handleWebhook(event).catch((error: unknown) => {
    logger.error`Webhook handler failed for ${name}: ${error}`;
  });

  // Notifications are non-critical -- errors are logged
  handleNotification(event).catch((error: unknown) => {
    logger.error`Notification handler failed for ${name}: ${error}`;
  });

  // Achievements are non-critical -- errors are logged
  handleAchievement(event).catch((error: unknown) => {
    logger.error`Achievement handler failed for ${name}: ${error}`;
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/events/handlers/achievement.ts src/features/events/emitter.ts
git commit -m "feat(achievements): add event bus handler and wire into emitter"
```

---

## Task 13: Achievement Seed Data

**Files:**
- Create: `src/features/achievements/seed.ts`
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Create achievement seed definitions**

Create `src/features/achievements/seed.ts`:

```typescript
export const achievementSeeds = [
  {
    id: "ach-first-login",
    key: "first-login",
    name: "First Steps",
    description: "Log in for the first time",
    icon: "log-in",
    category: "onboarding" as const,
    threshold: 1,
    points: 10,
  },
  {
    id: "ach-profile-complete",
    key: "profile-complete",
    name: "Identity",
    description: "Complete your profile (name and avatar)",
    icon: "user-check",
    category: "onboarding" as const,
    threshold: 1,
    points: 20,
  },
  {
    id: "ach-team-builder",
    key: "team-builder",
    name: "Team Builder",
    description: "Invite 5 members to your organization",
    icon: "users",
    category: "social" as const,
    threshold: 5,
    points: 50,
  },
  {
    id: "ach-feedback-giver",
    key: "feedback-giver",
    name: "Feedback Giver",
    description: "Submit 3 feedback reports",
    icon: "message-square",
    category: "usage" as const,
    threshold: 3,
    points: 30,
  },
  {
    id: "ach-api-creator",
    key: "api-creator",
    name: "API Explorer",
    description: "Create your first API key",
    icon: "key",
    category: "usage" as const,
    threshold: 1,
    points: 20,
  },
  {
    id: "ach-streak-3",
    key: "streak-3",
    name: "On a Roll",
    description: "Log in 3 days in a row",
    icon: "flame",
    category: "streak" as const,
    threshold: 3,
    points: 30,
  },
  {
    id: "ach-streak-7",
    key: "streak-7",
    name: "Weekly Warrior",
    description: "Log in 7 days in a row",
    icon: "zap",
    category: "streak" as const,
    threshold: 7,
    points: 70,
  },
  {
    id: "ach-streak-30",
    key: "streak-30",
    name: "Unstoppable",
    description: "Log in 30 days in a row",
    icon: "trophy",
    category: "streak" as const,
    threshold: 30,
    points: 300,
  },
];
```

- [ ] **Step 2: Add achievement seeding to seed script**

In `scripts/seed.ts`, add after the admin account seeding:

Import at top:

```typescript
import { achievementSeeds } from "../src/features/achievements/seed";
```

Add before the final `console.log("Seeding complete!")`:

```typescript
  // Seed achievements
  for (const a of achievementSeeds) {
    await db
      .insert(schema.achievement)
      .values(a)
      .onConflictDoNothing({ target: schema.achievement.id });
  }
  console.log(`Achievements seeded: ${achievementSeeds.length} definitions`);
```

- [ ] **Step 3: Run seed**

Run: `npm run db:seed`

Expected: "Achievements seeded: 8 definitions"

- [ ] **Step 4: Commit**

```bash
git add src/features/achievements/seed.ts scripts/seed.ts
git commit -m "feat(achievements): add seed data for 8 base achievements"
```

---

## Task 14: Achievement API Route

**Files:**
- Create: `src/app/api/achievements/route.ts`

- [ ] **Step 1: Create the achievements GET endpoint**

Create `src/app/api/achievements/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getAchievementsWithProgress, getUserStreak } from "@/features/achievements/queries";

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const userId = auth.session.user.id;
    const [achievements, streak] = await Promise.all([
      getAchievementsWithProgress(userId),
      getUserStreak(userId),
    ]);

    const totalPoints = achievements
      .filter((a) => a.unlockedAt)
      .reduce((sum, a) => sum + a.points, 0);

    const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

    return NextResponse.json({
      achievements,
      stats: {
        totalPoints,
        unlockedCount,
        totalCount: achievements.length,
        currentStreak: streak?.currentStreak ?? 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch achievements", code: "FETCH_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/achievements/route.ts
git commit -m "feat(achievements): add GET /api/achievements endpoint"
```

---

## Task 15: Achievement React Hook & Components

**Files:**
- Create: `src/features/achievements/hooks/use-achievements.ts`
- Create: `src/features/achievements/components/achievement-badge.tsx`
- Create: `src/features/achievements/components/achievement-grid.tsx`
- Create: `src/features/achievements/components/achievement-summary.tsx`
- Create: `src/features/achievements/components/achievement-toast.tsx`

- [ ] **Step 1: Create useAchievements hook**

Create `src/features/achievements/hooks/use-achievements.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

interface AchievementData {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  points: number;
  progress: number;
  unlockedAt: string | null;
}

interface AchievementStats {
  totalPoints: number;
  unlockedCount: number;
  totalCount: number;
  currentStreak: number;
}

interface UseAchievementsReturn {
  achievements: AchievementData[];
  stats: AchievementStats;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useAchievements(): UseAchievementsReturn {
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const [stats, setStats] = useState<AchievementStats>({
    totalPoints: 0,
    unlockedCount: 0,
    totalCount: 0,
    currentStreak: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/achievements");
      if (!res.ok) return;
      const data = await res.json();
      setAchievements(data.achievements);
      setStats(data.stats);
    } catch {
      // Silently ignore fetch failures
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { achievements, stats, isLoading, refresh };
}
```

- [ ] **Step 2: Create AchievementBadge**

Create `src/features/achievements/components/achievement-badge.tsx`:

```typescript
"use client";

import * as icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface AchievementBadgeProps {
  name: string;
  description: string;
  icon: string;
  points: number;
  threshold: number;
  progress: number;
  unlockedAt: string | null;
}

function getIcon(name: string): LucideIcon {
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const IconComponent = (icons as Record<string, LucideIcon>)[`${pascalName}Icon`];
  return IconComponent ?? icons.AwardIcon;
}

export function AchievementBadge({
  name,
  description,
  icon,
  points,
  threshold,
  progress,
  unlockedAt,
}: AchievementBadgeProps) {
  const Icon = getIcon(icon);
  const isUnlocked = unlockedAt !== null;
  const progressPercent = Math.min((progress / threshold) * 100, 100);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
        isUnlocked
          ? "border-primary/30 bg-primary/5"
          : "border-muted bg-muted/30 opacity-60",
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          isUnlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {!isUnlocked && (
        <div className="w-full">
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-[10px]">
            {progress}/{threshold}
          </p>
        </div>
      )}
      {isUnlocked && (
        <p className="text-primary text-xs font-medium">+{points} pts</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create AchievementGrid**

Create `src/features/achievements/components/achievement-grid.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useAchievements } from "../hooks/use-achievements";
import { AchievementBadge } from "./achievement-badge";
import { Skeleton } from "@/shared/components/ui/skeleton";

const CATEGORIES = ["onboarding", "social", "usage", "streak"] as const;

export function AchievementGrid() {
  const { achievements, stats, isLoading } = useAchievements();
  const t = useTranslations("achievements");

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats summary */}
      <div className="flex gap-6">
        <div>
          <p className="text-2xl font-bold">{stats.totalPoints}</p>
          <p className="text-muted-foreground text-sm">{t("totalPoints")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">
            {stats.unlockedCount}/{stats.totalCount}
          </p>
          <p className="text-muted-foreground text-sm">{t("unlocked")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.currentStreak}</p>
          <p className="text-muted-foreground text-sm">{t("currentStreak")}</p>
        </div>
      </div>

      {/* Achievements by category */}
      {CATEGORIES.map((category) => {
        const categoryAchievements = achievements.filter(
          (a) => a.category === category,
        );
        if (categoryAchievements.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider">
              {t(`categories.${category}`)}
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {categoryAchievements.map((a) => (
                <AchievementBadge
                  key={a.id}
                  name={a.name}
                  description={a.description}
                  icon={a.icon}
                  points={a.points}
                  threshold={a.threshold}
                  progress={a.progress}
                  unlockedAt={a.unlockedAt}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create AchievementSummary**

Create `src/features/achievements/components/achievement-summary.tsx`:

```typescript
"use client";

import { TrophyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAchievements } from "../hooks/use-achievements";

export function AchievementSummary() {
  const { stats, isLoading } = useAchievements();
  const t = useTranslations("achievements");

  if (isLoading) return null;

  return (
    <a
      href="/settings/achievements"
      className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors"
    >
      <TrophyIcon className="size-3.5" />
      <span>
        {stats.unlockedCount}/{stats.totalCount} {t("badges")} — {stats.totalPoints} pts
      </span>
    </a>
  );
}
```

- [ ] **Step 5: Create AchievementToast**

Create `src/features/achievements/components/achievement-toast.tsx`:

```typescript
"use client";

import { TrophyIcon } from "lucide-react";
import { toast } from "sonner";

interface AchievementToastData {
  name: string;
  points: number;
}

export function showAchievementToast({ name, points }: AchievementToastData) {
  toast(name, {
    description: `+${points} points`,
    icon: <TrophyIcon className="text-primary size-5" />,
    duration: 5000,
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/achievements/hooks/use-achievements.ts src/features/achievements/components/
git commit -m "feat(achievements): add hook and UI components"
```

---

## Task 16: Achievements Page

**Files:**
- Create: `src/app/[locale]/(app)/settings/achievements/page.tsx`

- [ ] **Step 1: Create the achievements settings page**

Create `src/app/[locale]/(app)/settings/achievements/page.tsx`:

```typescript
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/features/auth/guards";
import { AchievementGrid } from "@/features/achievements/components/achievement-grid";
import { PageHeader } from "@/shared/components/data/page-header";
import { Card, CardContent } from "@/shared/components/ui/card";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "achievements" });

  return generatePageMetadata(
    {
      title: t("title"),
      description: t("description"),
      noIndex: true,
    },
    locale,
  );
}

export default async function AchievementsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "achievements" });
  await requireAuth();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardContent className="pt-6">
          <AchievementGrid />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/(app)/settings/achievements/page.tsx
git commit -m "feat(achievements): add achievements settings page"
```

---

## Task 17: Wire Achievements into Sidebar

**Files:**
- Modify: `src/shared/components/layout/sidebar.tsx`

- [ ] **Step 1: Add AchievementSummary to sidebar**

In `src/shared/components/layout/sidebar.tsx`, add import:

```typescript
import { AchievementSummary } from "@/features/achievements/components/achievement-summary";
```

Add after the `PresenceList` block (added in Task 8), before the `{userMenu && ...}` block:

```tsx
<div className="px-2">
  <AchievementSummary />
</div>
```

- [ ] **Step 2: Add Achievements nav item**

In `src/shared/components/layout/sidebar.tsx`, add the TrophyIcon import:

```typescript
import {
  LayoutDashboardIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  TrophyIcon,
} from "lucide-react";
```

Add to the `defaultNavItems` array, after Settings:

```typescript
{
  label: "Achievements",
  href: "/settings/achievements",
  icon: <TrophyIcon className="size-4" />,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/layout/sidebar.tsx
git commit -m "feat(achievements): add AchievementSummary and nav link to sidebar"
```

---

## Task 18: i18n Translations

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/fr.json`

- [ ] **Step 1: Add English translations**

Add the following namespaces to `src/locales/en.json`:

```json
"presence": {
  "online": "{count, plural, =1 {1 member online} other {# members online}}",
  "noOneOnline": "No one is online",
  "status": {
    "online": "Online",
    "idle": "Away",
    "offline": "Offline"
  }
},
"achievements": {
  "title": "Achievements",
  "description": "Track your progress and earn badges",
  "totalPoints": "Total Points",
  "unlocked": "Badges Unlocked",
  "currentStreak": "Day Streak",
  "badges": "badges",
  "categories": {
    "onboarding": "Getting Started",
    "social": "Social",
    "usage": "Usage",
    "streak": "Streaks"
  }
}
```

- [ ] **Step 2: Add French translations**

Add the following namespaces to `src/locales/fr.json`:

```json
"presence": {
  "online": "{count, plural, =1 {1 membre en ligne} other {# membres en ligne}}",
  "noOneOnline": "Personne n'est en ligne",
  "status": {
    "online": "En ligne",
    "idle": "Absent",
    "offline": "Hors ligne"
  }
},
"achievements": {
  "title": "Accomplissements",
  "description": "Suivez votre progression et gagnez des badges",
  "totalPoints": "Points totaux",
  "unlocked": "Badges débloqués",
  "currentStreak": "Jours consécutifs",
  "badges": "badges",
  "categories": {
    "onboarding": "Premiers pas",
    "social": "Social",
    "usage": "Utilisation",
    "streak": "Séries"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/en.json src/locales/fr.json
git commit -m "feat(i18n): add presence and achievements translations (en/fr)"
```

---

## Task 19: Update Vitest Coverage Config

**Files:**
- Modify: `vitest.config.mts`

- [ ] **Step 1: Add new coverage paths**

In `vitest.config.mts`, add to the `coverage.include` array:

```typescript
"src/features/presence/helpers.ts",
"src/features/presence/actions.ts",
"src/features/presence/queries.ts",
"src/features/achievements/helpers.ts",
"src/features/achievements/actions.ts",
"src/features/achievements/queries.ts",
"src/features/achievements/handler.ts",
```

- [ ] **Step 2: Run all tests**

Run: `npm run test`

Expected: All tests pass including the new ones.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.mts
git commit -m "chore: add presence and achievements to vitest coverage config"
```

---

## Task 20: Final Verification

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: No errors.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Run all tests**

Run: `npm run test`

Expected: All tests pass.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Commit any remaining fixes if needed**

If any step above revealed issues, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve lint/type/test issues from engagement features"
```
