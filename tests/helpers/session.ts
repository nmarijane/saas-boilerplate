import type { requireAuth, requireRole } from "@/features/auth/guards";
import type { OrgRole } from "@/shared/types";

type AuthSession = Awaited<ReturnType<typeof requireAuth>>;
type RoleGrant = Awaited<ReturnType<typeof requireRole>>;

interface FakeSessionOptions {
  isAdmin?: boolean;
  activeOrganizationId?: string | null;
}

/** A Better Auth session for `userId`, as returned by auth.api.getSession(). */
export function fakeSession(
  userId: string,
  { isAdmin = false, activeOrganizationId = null }: FakeSessionOptions = {},
): AuthSession {
  const now = new Date();
  return {
    user: {
      id: userId,
      name: "Test User",
      email: `${userId}@test.com`,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      isAdmin,
      onboardingCompleted: true,
      twoFactorEnabled: false,
    },
    session: {
      id: `session-${userId}`,
      userId,
      token: `token-${userId}`,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
      activeOrganizationId,
    },
  };
}

/** What a mocked requireRole() resolves to: the session plus the membership. */
export function fakeRoleGrant(userId: string, role: OrgRole = "owner"): RoleGrant {
  return {
    session: fakeSession(userId),
    member: { id: `member-${userId}`, role },
  };
}
