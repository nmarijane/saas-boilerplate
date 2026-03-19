# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical security vulnerabilities (unauthenticated API routes, privilege escalation) and harden the boilerplate for production deployment (security headers, error handling, DB index).

**Architecture:** Foundation-first approach — create shared helpers (`safeAction`, `requireApiAuth`, `getActiveOrgId`) first, then apply them across the codebase. Each task produces a working, testable commit.

**Tech Stack:** Next.js 15 App Router, Better Auth (organization plugin), Drizzle ORM, Vitest + PGlite, LogTape, Zod

**Spec:** `docs/superpowers/specs/2026-03-19-production-readiness-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/shared/lib/safe-action.ts` | Generic try-catch wrapper for server actions |
| Create | `src/features/auth/api-auth.ts` | API route authentication helper |
| Create | `src/features/auth/organization/active-org.ts` | Active org resolution from Better Auth session |
| Create | `tests/integration/safe-action.test.ts` | Tests for safeAction wrapper |
| Modify | `src/features/notifications/actions.ts` | Add ownership checks (session-based userId) |
| Modify | `src/features/auth/organization/actions.ts` | Add role checks + safeAction wrapping |
| Modify | `src/features/settings/actions.ts` | Add safeAction wrapping |
| Modify | `src/features/notifications/components/notification-dropdown.tsx` | Update markAllRead call signature |
| Modify | `src/app/api/feedback/route.ts` | Add auth, use session userId |
| Modify | `src/app/api/notifications/route.ts` | Add auth, use session userId |
| Modify | `src/app/api/upload/route.ts` | Add auth, use session userId/orgId |
| Modify | `src/app/api/upload/[id]/route.ts` | Add auth + ownership verification |
| Modify | `src/app/api/features/[key]/route.ts` | Add explicit public comment |
| Modify | `src/app/[locale]/(app)/settings/api/page.tsx` | Wire org context |
| Modify | `src/app/[locale]/(app)/settings/billing/page.tsx` | Wire org context + add requireAuth |
| Modify | `src/app/global-error.tsx` | Hide error.message from client |
| Modify | `next.config.ts` | Add security headers |
| Modify | `src/models/subscription.ts` | Add index on organizationId |
| Modify | `tests/integration/notifications.test.ts` | Update tests for new signatures |
| Modify | `tests/setup.ts` | Add next/headers mock |

---

## Task 1: Create `safeAction` wrapper

**Files:**
- Create: `src/shared/lib/safe-action.ts`
- Create: `tests/integration/safe-action.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/integration/safe-action.test.ts
import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { safeAction } from "@/shared/lib/safe-action";

describe("safeAction", () => {
  it("returns success with data on success", async () => {
    const result = await safeAction(async () => ({ id: "123" }));
    expect(result).toEqual({ success: true, data: { id: "123" } });
  });

  it("returns generic error on unexpected failure", async () => {
    const result = await safeAction(async () => {
      throw new Error("DB connection failed");
    });
    expect(result).toEqual({ success: false, error: "An unexpected error occurred" });
  });

  it("returns custom error message when provided", async () => {
    const result = await safeAction(
      async () => { throw new Error("fail"); },
      "Custom error",
    );
    expect(result).toEqual({ success: false, error: "Custom error" });
  });

  it("returns validation errors on ZodError", async () => {
    const schema = z.object({ name: z.string().min(1), email: z.string().email() });
    const result = await safeAction(async () => {
      schema.parse({ name: "", email: "not-email" });
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Validation failed");
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.name).toBeDefined();
      expect(result.validationErrors!.email).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/safe-action.test.ts`
Expected: FAIL — module `@/shared/lib/safe-action` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/shared/lib/safe-action.ts
import { getLogger } from "@logtape/logtape";
import { isRedirectError } from "next/dist/client/components/redirect-error";
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
    // Next.js redirect() throws a special error that must be re-thrown
    if (isRedirectError(error)) {
      throw error;
    }

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

**CRITICAL:** `safeAction` must re-throw Next.js redirect errors. Functions like `requireRole()` call `redirect()` which throws a special `NEXT_REDIRECT` error. If caught by safeAction, the redirect silently fails. `isRedirectError` from Next.js detects this.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/safe-action.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/safe-action.ts tests/integration/safe-action.test.ts
git commit -m "feat: add safeAction wrapper for server action error handling"
```

---

## Task 2: Create `requireApiAuth` helper

**Files:**
- Create: `src/features/auth/api-auth.ts`
- Modify: `tests/setup.ts` (add `next/headers` mock)

- [ ] **Step 1: Write the implementation**

```typescript
// src/features/auth/api-auth.ts
import type { Session } from "@/features/auth/auth";
import { auth } from "@/features/auth/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type AuthSuccess = { authenticated: true; session: Session };
type AuthFailure = { authenticated: false; response: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

export async function requireApiAuth(): Promise<AuthResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED", status: 401 },
        { status: 401 },
      ),
    };
  }

  return { authenticated: true, session };
}
```

- [ ] **Step 2: Add `next/headers` mock to test setup**

In `tests/setup.ts`, add after the existing `vi.mock("next/cache", ...)`:

```typescript
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));
```

- [ ] **Step 3: Verify lint and types pass**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/api-auth.ts tests/setup.ts
git commit -m "feat: add requireApiAuth helper for API route authentication"
```

---

## Task 3: Fix notification actions — ownership checks

**Files:**
- Modify: `src/features/notifications/actions.ts`
- Modify: `src/features/notifications/components/notification-dropdown.tsx`
- Modify: `tests/integration/notifications.test.ts`

- [ ] **Step 1: Update notification actions to use session**

Replace the full file `src/features/notifications/actions.ts`:

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/features/auth/guards";
import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

interface CreateNotificationInput {
  title: string;
  body: string;
  type?: string;
  link?: string;
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput,
) {
  const id = generateId();

  await db.insert(notification).values({
    id,
    userId,
    title: input.title,
    body: input.body,
    type: input.type ?? "info",
    link: input.link ?? null,
  });

  return { id };
}

export async function markAsRead(notifId: string) {
  const session = await requireAuth();
  await db
    .update(notification)
    .set({ read: true })
    .where(
      and(eq(notification.id, notifId), eq(notification.userId, session.user.id)),
    );
  revalidatePath("/");
}

export async function markAllRead() {
  const session = await requireAuth();
  await db
    .update(notification)
    .set({ read: true })
    .where(
      and(eq(notification.userId, session.user.id), eq(notification.read, false)),
    );
  revalidatePath("/");
}

export async function deleteNotification(notifId: string) {
  const session = await requireAuth();
  await db
    .delete(notification)
    .where(
      and(eq(notification.id, notifId), eq(notification.userId, session.user.id)),
    );
  revalidatePath("/");
}
```

Note: `createNotification` keeps `userId` param because it is called from server-side event handlers (not from the client).

- [ ] **Step 2: Update notification-dropdown.tsx**

In `src/features/notifications/components/notification-dropdown.tsx` line 37, change:
```typescript
// Before:
await markAllRead("");
// After:
await markAllRead();
```

- [ ] **Step 3: Update tests for new signatures**

The tests in `tests/integration/notifications.test.ts` need to be updated:

- `markAsRead(notif.id)` — no change (userId now comes from mocked `requireAuth` which returns `test-user-1`)
- `markAllRead(NOTIF_USER)` → `markAllRead()` — remove the userId argument
- `deleteNotification(notif.id)` — no change

BUT: the mock `requireAuth` returns `test-user-1` but the tests seed with `NOTIF_USER = "notif-user-1"`. We need to change `NOTIF_USER` to match the mock.

Update `tests/integration/notifications.test.ts`:
- Change `const NOTIF_USER = "notif-user-1"` to `const NOTIF_USER = "test-user-1"`
- Change `markAllRead(NOTIF_USER)` to `markAllRead()` (2 occurrences)
- Add test: `deleteNotification` should not delete another user's notification
- Add test: `markAsRead` should not mark another user's notification as read

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/integration/notifications.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/actions.ts \
  src/features/notifications/components/notification-dropdown.tsx \
  tests/integration/notifications.test.ts
git commit -m "fix: add ownership checks to notification actions (IDOR fix)"
```

---

## Task 4: Add role checks to org actions + safeAction wrapping

**Files:**
- Modify: `src/features/auth/organization/actions.ts`

- [ ] **Step 1: Update org actions with role checks and safeAction**

Replace the full file `src/features/auth/organization/actions.ts`:

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/features/auth/auth";
import { getServerSession, requireRole } from "@/features/auth/guards";
import { sendEmail } from "@/features/email/send";
import { InvitationEmail } from "@/features/email/templates/invitation";
import { organizationMember, organization as organizationTable } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { safeAction } from "@/shared/lib/safe-action";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export async function createOrganization(data: z.infer<typeof createOrgSchema>) {
  return safeAction(async () => {
    const parsed = createOrgSchema.parse(data);
    const session = await getServerSession();
    if (!session) throw new Error("Unauthorized");

    const result = await auth.api.createOrganization({
      headers: await headers(),
      body: {
        name: parsed.name,
        slug: parsed.slug,
      },
    });

    revalidatePath("/dashboard");
    return result;
  }, "Failed to create organization");
}

const inviteSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

export async function inviteMember(data: z.infer<typeof inviteSchema>) {
  return safeAction(async () => {
    const parsed = inviteSchema.parse(data);
    const session = await getServerSession();
    if (!session) throw new Error("Unauthorized");

    // Verify caller has admin+ role in this org
    await requireRole(parsed.orgId, session.user.id, "admin");

    const result = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        organizationId: parsed.orgId,
        email: parsed.email,
        role: parsed.role,
      },
    });

    await sendEmail({
      to: parsed.email,
      subject: "You've been invited to join an organization",
      template: InvitationEmail({
        inviterName: session.user.name,
        organizationName: result.organizationId,
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/accept-invitation/${result.id}`,
      }),
    });

    revalidatePath("/settings/team");
    return result;
  }, "Failed to invite member");
}

const removeMemberSchema = z.object({
  orgId: z.string().min(1),
  memberIdToRemove: z.string().min(1),
});

export async function removeMember(data: z.infer<typeof removeMemberSchema>) {
  return safeAction(async () => {
    const parsed = removeMemberSchema.parse(data);
    const session = await getServerSession();
    if (!session) throw new Error("Unauthorized");

    // Verify caller has admin+ role
    await requireRole(parsed.orgId, session.user.id, "admin");

    await db
      .delete(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, parsed.orgId),
          eq(organizationMember.id, parsed.memberIdToRemove),
        ),
      );

    revalidatePath("/settings/team");
  }, "Failed to remove member");
}

const changeRoleSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  newRole: z.enum(["admin", "member"]),
});

export async function changeRole(data: z.infer<typeof changeRoleSchema>) {
  return safeAction(async () => {
    const parsed = changeRoleSchema.parse(data);
    const session = await getServerSession();
    if (!session) throw new Error("Unauthorized");

    // Verify caller has admin+ role
    await requireRole(parsed.orgId, session.user.id, "admin");

    await db
      .update(organizationMember)
      .set({ role: parsed.newRole })
      .where(
        and(
          eq(organizationMember.organizationId, parsed.orgId),
          eq(organizationMember.id, parsed.memberId),
        ),
      );

    revalidatePath("/settings/team");
  }, "Failed to change role");
}

const deleteOrgSchema = z.object({
  orgId: z.string().min(1),
});

export async function deleteOrganization(data: z.infer<typeof deleteOrgSchema>) {
  return safeAction(async () => {
    const parsed = deleteOrgSchema.parse(data);
    const session = await getServerSession();
    if (!session) throw new Error("Unauthorized");

    // Only owners can delete organizations
    await requireRole(parsed.orgId, session.user.id, "owner");

    await db
      .delete(organizationTable)
      .where(eq(organizationTable.id, parsed.orgId));

    revalidatePath("/dashboard");
  }, "Failed to delete organization");
}
```

- [ ] **Step 2: Update client components for safeAction return type**

The following components call org actions with try-catch. They now receive `{ success, data/error }` instead of a raw throw. Update:

**`src/features/onboarding/components/organization-step.tsx`** — line 49-55:
```typescript
  const onSubmit = async (data: OrgValues) => {
    const result = await createOrganization(data);
    if (result.success) {
      onComplete();
    } else {
      toast.error(result.error);
    }
  };
```

**`src/features/auth/organization/components/invite-modal.tsx`** — line 58-71:
```typescript
  const onSubmit = async (data: InviteFormValues) => {
    setIsLoading(true);
    const result = await inviteMember({ orgId, email: data.email, role: data.role });
    if (result.success) {
      toast.success(tCommon("success"));
      reset();
      setOpen(false);
      onInvited?.();
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  };
```

**`src/features/auth/organization/components/members-list.tsx`** — lines 59-70 and 72-83:
```typescript
  const handleRemove = async (memberId: string) => {
    setLoadingId(memberId);
    const result = await removeMember({ orgId, memberIdToRemove: memberId });
    if (result.success) {
      toast.success(tCommon("success"));
      onMemberUpdated?.();
    } else {
      toast.error(result.error);
    }
    setLoadingId(null);
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    setLoadingId(memberId);
    const result = await changeRole({ orgId, memberId, newRole });
    if (result.success) {
      toast.success(tCommon("success"));
      onMemberUpdated?.();
    } else {
      toast.error(result.error);
    }
    setLoadingId(null);
  };
```

- [ ] **Step 3: Run lint and type check**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/organization/actions.ts \
  src/features/onboarding/components/organization-step.tsx \
  src/features/auth/organization/components/invite-modal.tsx \
  src/features/auth/organization/components/members-list.tsx
git commit -m "fix: add role checks to org actions and wrap with safeAction"
```

---

## Task 5: Wrap settings actions with safeAction

**Files:**
- Modify: `src/features/settings/actions.ts`
- Modify: `src/app/[locale]/(app)/settings/danger/page.tsx`

Note: Feedback actions (`submitFeedback`, `updateFeedbackStatus`) are NOT wrapped with safeAction because they are called from API routes. Wrapping them would change the return type and break the API route callers.

- [ ] **Step 1: Wrap settings actions**

In `src/features/settings/actions.ts`, wrap `updateProfile` and `deleteAccount`:

For `updateProfile` — wrap body in `safeAction`:
```typescript
export async function updateProfile(
  input: z.infer<typeof updateProfileSchema>,
) {
  return safeAction(async () => {
    const session = await requireAuth();
    const parsed = updateProfileSchema.parse(input);

    await db
      .update(user)
      .set({
        name: parsed.name,
        image: parsed.image || null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    revalidatePath("/settings/profile");
  }, "Failed to update profile");
}
```

For `deleteAccount` — wrap body in `safeAction`:
```typescript
export async function deleteAccount() {
  return safeAction(async () => {
    const session = await requireAuth();
    // ... existing logic unchanged ...
    await db.delete(user).where(eq(user.id, session.user.id));
    revalidatePath("/");
  }, "Failed to delete account");
}
```

Add import: `import { safeAction } from "@/shared/lib/safe-action";`

- [ ] **Step 2: Update danger page for safeAction return type**

In `src/app/[locale]/(app)/settings/danger/page.tsx`, update `handleDelete`:

```typescript
  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccount();
      if (result.success) {
        router.push("/sign-in");
      } else {
        toast.error(result.error);
      }
    });
  }
```

- [ ] **Step 3: Run lint and type check**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/actions.ts \
  src/app/[locale]/(app)/settings/danger/page.tsx
git commit -m "fix: wrap settings actions with safeAction"
```

---

## Task 6: Create active org helper + wire settings pages

**Files:**
- Create: `src/features/auth/organization/active-org.ts`
- Modify: `src/app/[locale]/(app)/settings/api/page.tsx`
- Modify: `src/app/[locale]/(app)/settings/billing/page.tsx`

- [ ] **Step 1: Create active org helper**

```typescript
// src/features/auth/organization/active-org.ts
"use server";

import { requireAuth } from "@/features/auth/guards";
import { getUserOrganizations } from "./queries";

export async function getActiveOrgId(): Promise<string | null> {
  const session = await requireAuth();

  // Better Auth stores activeOrganizationId on the session
  // when the organization() plugin is active
  const activeOrgId = (session.session as Record<string, unknown>)
    .activeOrganizationId as string | undefined;

  if (activeOrgId) return activeOrgId;

  // Fallback: first org the user belongs to
  const orgs = await getUserOrganizations(session.user.id);
  return orgs[0]?.id ?? null;
}
```

Note: Using the cast pattern because the Better Auth Session type may not expose `activeOrganizationId` depending on how TypeScript infers the plugin types. If direct access works without cast, remove it.

- [ ] **Step 2: Wire settings/api page**

Replace `src/app/[locale]/(app)/settings/api/page.tsx` lines 35-36:

```typescript
// Before:
// TODO: Replace with actual active org ID from session/context
const orgId = "";

// After:
const orgId = await getActiveOrgId();
if (!orgId) {
  const { redirect } = await import("next/navigation");
  redirect("/dashboard");
}
```

Add import at top: `import { getActiveOrgId } from "@/features/auth/organization/active-org";`

- [ ] **Step 3: Wire settings/billing page**

Replace `src/app/[locale]/(app)/settings/billing/page.tsx`:

```typescript
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { BillingSettings } from "@/features/billing/components/billing-settings";
import { getSubscriptionForOrg } from "@/features/billing/helpers";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your subscription and billing settings.",
};

export default async function BillingPage() {
  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/dashboard");

  const { planId, status, subscription } = await getSubscriptionForOrg(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>
      <BillingSettings
        orgId={orgId}
        planId={planId}
        status={status}
        currentPeriodEnd={subscription?.currentPeriodEnd}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run lint and type check**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/organization/active-org.ts \
  "src/app/[locale]/(app)/settings/api/page.tsx" \
  "src/app/[locale]/(app)/settings/billing/page.tsx"
git commit -m "feat: wire active org context to settings pages"
```

---

## Task 7: Secure API routes

**Files:**
- Modify: `src/app/api/feedback/route.ts`
- Modify: `src/app/api/notifications/route.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/upload/[id]/route.ts`
- Modify: `src/app/api/features/[key]/route.ts`

- [ ] **Step 1: Secure feedback API**

Replace `src/app/api/feedback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { submitFeedback, updateFeedbackStatus } from "@/features/feedback/actions";
import { getFeedbacks } from "@/features/feedback/queries";

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { type, message, screenshotId, orgId } = body;

    if (!type || !message) {
      return NextResponse.json(
        { error: "type and message are required", code: "MISSING_FIELDS", status: 400 },
        { status: 400 },
      );
    }

    const result = await submitFeedback({
      userId: auth.session.user.id,
      orgId,
      type,
      message,
      screenshotId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to submit feedback", code: "SUBMIT_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const orgId = searchParams.get("orgId") ?? undefined;

    const feedbacks = await getFeedbacks({ status, orgId });
    return NextResponse.json({ feedbacks });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch feedbacks", code: "FETCH_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    // Feedback status updates are admin-only
    if (!(auth.session.user as Record<string, unknown>).isAdmin) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN", status: 403 },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { feedbackId, status } = body;

    if (!feedbackId || !status) {
      return NextResponse.json(
        { error: "feedbackId and status are required", code: "MISSING_FIELDS", status: 400 },
        { status: 400 },
      );
    }

    if (!["new", "reviewed", "done"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status", code: "INVALID_STATUS", status: 400 },
        { status: 400 },
      );
    }

    await updateFeedbackStatus(feedbackId, status);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update feedback", code: "UPDATE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Secure notifications API**

Replace `src/app/api/notifications/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { markAllRead, markAsRead } from "@/features/notifications/actions";
import { getNotifications, getUnreadCount } from "@/features/notifications/queries";

export async function GET(request: Request) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    const userId = auth.session.user.id;
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await getUnreadCount(userId);
      return NextResponse.json({ count });
    }

    const limit = Number(searchParams.get("limit")) || 20;
    const offset = Number(searchParams.get("offset")) || 0;

    const notifications = await getNotifications(userId, { limit, offset });
    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch notifications", code: "FETCH_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { action, notifId } = body;

    if (action === "markRead" && notifId) {
      await markAsRead(notifId);
      return NextResponse.json({ success: true });
    }

    if (action === "markAllRead") {
      await markAllRead();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action", code: "INVALID_ACTION", status: 400 },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update notification", code: "UPDATE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Secure upload API**

Replace `src/app/api/upload/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { uploadFile } from "@/features/upload/actions";

export async function POST(request: Request) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    const orgId = await getActiveOrgId();
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization", code: "NO_ORG", status: 400 },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    // Override userId/orgId from session — don't trust client
    formData.set("userId", auth.session.user.id);
    formData.set("orgId", orgId);

    const result = await uploadFile(formData);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Upload failed", code: "UPLOAD_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Secure upload/[id] API with ownership check**

Replace `src/app/api/upload/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { deleteFile } from "@/features/upload/actions";
import { getFileById } from "@/features/upload/queries";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { getStorageAdapter } from "@/features/upload/storage/adapter";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return NextResponse.json(
        { error: "File not found", code: "NOT_FOUND", status: 404 },
        { status: 404 },
      );
    }

    // Verify ownership: user owns file or belongs to the file's org
    const userId = auth.session.user.id;
    if (file.userId !== userId) {
      const orgs = await getUserOrganizations(userId);
      const orgIds = orgs.map((o) => o.id);
      if (!orgIds.includes(file.organizationId)) {
        return NextResponse.json(
          { error: "Forbidden", code: "FORBIDDEN", status: 403 },
          { status: 403 },
        );
      }
    }

    const storage = await getStorageAdapter();
    const buffer = await storage.get(file.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimetype,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve file", code: "RETRIEVAL_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiAuth();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return NextResponse.json(
        { error: "File not found", code: "NOT_FOUND", status: 404 },
        { status: 404 },
      );
    }

    // Verify ownership before deletion
    const userId = auth.session.user.id;
    if (file.userId !== userId) {
      const orgs = await getUserOrganizations(userId);
      const orgIds = orgs.map((o) => o.id);
      if (!orgIds.includes(file.organizationId)) {
        return NextResponse.json(
          { error: "Forbidden", code: "FORBIDDEN", status: 403 },
          { status: 403 },
        );
      }
    }

    const result = await deleteFile(id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: "NOT_FOUND", status: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete file", code: "DELETE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Document feature flags route as intentionally public**

Add comment to `src/app/api/features/[key]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/features/feature-flags/helpers";

// This route is intentionally public — feature flag state (key + enabled)
// is non-sensitive and needed by unauthenticated clients for UI gating.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const enabled = await isFeatureEnabled(key);
  return NextResponse.json({ key, enabled });
}
```

- [ ] **Step 6: Run lint and type check**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/feedback/route.ts src/app/api/notifications/route.ts \
  src/app/api/upload/route.ts "src/app/api/upload/[id]/route.ts" \
  "src/app/api/features/[key]/route.ts"
git commit -m "fix: add authentication and authorization to all API routes"
```

---

## Task 8: Fix global-error.tsx + add security headers + DB index

**Files:**
- Modify: `src/app/global-error.tsx`
- Modify: `next.config.ts`
- Modify: `src/models/subscription.ts`

- [ ] **Step 1: Fix global-error.tsx**

In `src/app/global-error.tsx`, replace line 27:

```typescript
// Before:
{error.message || "An unexpected error occurred."}

// After:
An unexpected error occurred. Please try again later.
```

Remove the `error.message` reference entirely — only show the generic message.

- [ ] **Step 2: Add security headers to next.config.ts**

In `next.config.ts`, update the `nextConfig` object:

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
            // Start with Report-Only — switch to Content-Security-Policy
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

- [ ] **Step 3: Add index to subscription model**

In `src/models/subscription.ts`, add `index` to the imports and the callback:

```typescript
import {
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";

// plan table unchanged...

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("active"),
  planId: text("plan_id")
    .notNull()
    .references(() => plan.id),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("subscription_org_id_idx").on(t.organizationId),
]);
```

- [ ] **Step 4: Generate DB migration**

Run: `npm run db:generate`
Expected: New migration file created in `migrations/`

- [ ] **Step 5: Run full verification**

Run: `npm run lint && npx tsc --noEmit && npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/global-error.tsx next.config.ts src/models/subscription.ts \
  migrations/ drizzle/
git commit -m "fix: add security headers, hide error details, add subscription index"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run full lint + type check + tests**

Run: `npm run lint && npx tsc --noEmit && npx vitest run`
Expected: All PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no new warnings

- [ ] **Step 3: Push**

Run: `git push`
