import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth } from "@/features/auth/guards";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import {
  getWorkspaceContext,
  requireWorkspace,
  scopeOf,
} from "@/features/auth/organization/workspace";
import { organization, organizationMember, user } from "@/models";
import { redirect } from "@/shared/lib/i18n-navigation";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

// The way Next.js ends a render at a redirect: by throwing. The redirect is the localized one of next-intl, which
// puts the language of the request in front of the address, and that language is the one the proxy sets.
const request = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next-intl/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl/server")>()),
  getLocale: async () => request.locale,
}));
vi.mock("@/shared/lib/i18n-navigation", () => ({
  redirect: vi.fn(({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`NEXT_REDIRECT:/${locale}${href}`);
  }),
}));

const ALICE = "wc-alice";
const OLDEST = "wc-org-oldest";
const NEWEST = "wc-org-newest";

/** Joins an organization at a given day, so that "the oldest workspace" is not a matter of milliseconds. */
async function join(userId: string, orgId: string, role: "owner" | "admin" | "member", day: number) {
  const member = await seedOrgMember(userId, orgId, role);
  await testDb
    .update(organizationMember)
    .set({ createdAt: new Date(Date.UTC(2026, 0, day)) })
    .where(eq(organizationMember.id, member.id));
}

/** The next call of the guard returns the session of `userId`, as Better Auth gives it. */
function signIn(options: Parameters<typeof fakeSession>[1] = {}, userId = ALICE) {
  vi.mocked(requireAuth).mockResolvedValueOnce(fakeSession(userId, options));
}

describe("workspace context", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    request.locale = "en";
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
    await testDb.delete(user);
    await seedUser(ALICE, { name: "Alice Martin", email: "alice@example.com" });
    await seedOrg(OLDEST, { name: "Oldest Org", slug: "wc-oldest" });
    await seedOrg(NEWEST, { name: "Newest Org", slug: "wc-newest" });
  });

  it("keeps the session's workspace while the user belongs to it", async () => {
    // Joined the newest organization first, but the session points at it.
    await join(ALICE, NEWEST, "member", 20);
    await join(ALICE, OLDEST, "owner", 10);
    signIn({ activeOrganizationId: NEWEST });

    const context = await getWorkspaceContext();

    expect(context.workspace).toEqual({ id: NEWEST, name: "Newest Org", slug: "wc-newest", role: "member" });
    expect(context.workspaces.map(({ id }) => id)).toEqual([OLDEST, NEWEST]);
  });

  it("falls back to the oldest workspace when the active one is gone", async () => {
    await join(ALICE, NEWEST, "member", 20);
    await join(ALICE, OLDEST, "owner", 10);

    // The session points at an organization the user was removed from...
    const stranger = "wc-org-left";
    await seedOrg(stranger, { name: "Left Org", slug: "wc-left" });
    signIn({ activeOrganizationId: stranger });
    expect((await getWorkspaceContext()).workspace).toMatchObject({ id: OLDEST, role: "owner" });

    // ...at one that no longer exists, or at none at all.
    signIn({ activeOrganizationId: "wc-org-deleted" });
    expect((await getWorkspaceContext()).workspace?.id).toBe(OLDEST);
    signIn({ activeOrganizationId: null });
    expect((await getWorkspaceContext()).workspace?.id).toBe(OLDEST);
  });

  it("returns no workspace for a user without one", async () => {
    signIn({ activeOrganizationId: NEWEST });

    const context = await getWorkspaceContext();

    expect(context.workspace).toBeNull();
    expect(context.workspaces).toEqual([]);
    expect(context.user).toMatchObject({ id: ALICE });
  });

  it("carries the platform-admin flag", async () => {
    signIn({ isAdmin: true });
    expect((await getWorkspaceContext()).user.isPlatformAdmin).toBe(true);

    signIn({ isAdmin: false });
    expect((await getWorkspaceContext()).user.isPlatformAdmin).toBe(false);
  });

  it("describes the user from the session, with no password or token in it", async () => {
    signIn();

    const { user: described } = await getWorkspaceContext();

    expect(described).toEqual({
      id: ALICE,
      name: "Test User",
      email: `${ALICE}@test.com`,
      image: null,
      isPlatformAdmin: false,
    });
  });

  it("lists every workspace of the user with its role, oldest first", async () => {
    const third = "wc-org-third";
    await seedOrg(third, { name: "Third Org", slug: "wc-third" });
    await join(ALICE, third, "admin", 15);
    await join(ALICE, NEWEST, "member", 20);
    await join(ALICE, OLDEST, "owner", 10);
    // Someone else's membership is not Alice's workspace.
    await seedUser("wc-bob");
    await seedOrgMember("wc-bob", NEWEST, "owner");
    signIn();

    const { workspaces } = await getWorkspaceContext();

    expect(workspaces.map(({ id, role }) => [id, role])).toEqual([
      [OLDEST, "owner"],
      [third, "admin"],
      [NEWEST, "member"],
    ]);
  });

  it("sends requireWorkspace to onboarding without a workspace", async () => {
    signIn();

    await expect(requireWorkspace()).rejects.toThrow("NEXT_REDIRECT:/en/onboarding");
    expect(redirect).toHaveBeenCalledWith({ href: "/onboarding", locale: "en" });
  });

  it("sends it to onboarding in the language of the request", async () => {
    request.locale = "fr";
    signIn();

    await expect(requireWorkspace()).rejects.toThrow("NEXT_REDIRECT:/fr/onboarding");
  });

  it("gives requireWorkspace a workspace to work in, and scopeOf its scope", async () => {
    await join(ALICE, OLDEST, "admin", 10);
    signIn();

    const context = await requireWorkspace();

    expect(redirect).not.toHaveBeenCalled();
    expect(context.workspace).toMatchObject({ id: OLDEST, role: "admin" });
    expect(scopeOf(context)).toEqual({ orgId: OLDEST, userId: ALICE, role: "admin" });
  });
});

describe("active organization id", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
    await testDb.delete(user);
    await seedUser(ALICE);
    await seedOrg(OLDEST, { slug: "wc-oldest" });
    await seedOrg(NEWEST, { slug: "wc-newest" });
  });

  it("is the workspace of the session while the user belongs to it", async () => {
    await join(ALICE, OLDEST, "owner", 10);
    await join(ALICE, NEWEST, "member", 20);
    signIn({ activeOrganizationId: NEWEST });

    expect(await getActiveOrgId()).toBe(NEWEST);
  });

  it("falls back to the oldest workspace, or to nothing", async () => {
    signIn({ activeOrganizationId: NEWEST });
    expect(await getActiveOrgId()).toBeNull();

    await join(ALICE, NEWEST, "member", 20);
    await join(ALICE, OLDEST, "owner", 10);
    signIn({ activeOrganizationId: "wc-org-deleted" });
    expect(await getActiveOrgId()).toBe(OLDEST);
  });
});
