import { eq } from "drizzle-orm";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiKeyAction, revokeApiKeyAction } from "@/features/api-keys/actions";
import { changeRole, getOrganizationMembersAction, removeMember } from "@/features/auth/organization/actions";
import { createCheckoutSessionAction } from "@/features/billing/actions";
import { deleteFile } from "@/features/upload/actions";
import { inviteFromWaitlist } from "@/features/waitlist/actions";
import { deleteWebhookEndpointAction, toggleWebhookEndpointAction } from "@/features/webhooks/actions";
import { apiKey, organization, organizationMember, upload, user, waitlistEntry, webhookEndpoint } from "@/models";
import { seedOrg, seedOrgMember, seedUpload, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * Server actions called the way an attacker would: directly, without the UI.
 * Unlike the other suites, the guards are the real ones; only the session
 * lookup (Better Auth) and the external services are mocked.
 */

const { getSession, checkoutCreate, storageDelete } = vi.hoisted(() => ({
  getSession: vi.fn(),
  checkoutCreate: vi.fn(),
  storageDelete: vi.fn(),
}));

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/features/billing/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: checkoutCreate } },
    billingPortal: { sessions: { create: vi.fn() } },
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_guard" }) },
  }),
}));
vi.mock("@/features/upload/storage/adapter", () => ({
  getStorageAdapter: vi.fn().mockResolvedValue({ put: vi.fn(), get: vi.fn(), delete: storageDelete }),
}));

const ORG_A = "guard-org-a";
const ORG_B = "guard-org-b";
const ALICE = "guard-alice"; // owner of A
const DAN = "guard-dan"; // admin of A
const CAROL = "guard-carol"; // member of A
const BOB = "guard-bob"; // owner of B

function signIn(userId: string | null) {
  getSession.mockResolvedValue(userId ? fakeSession(userId) : null);
}

/** Where the guard sent the caller; fails if the call was not refused by a redirect. */
async function redirectOf(call: Promise<unknown>): Promise<string> {
  const error = await call.then(() => undefined, (rejection: unknown) => rejection);
  if (!isRedirectError(error)) {
    throw new Error(`Expected the guard to redirect, got: ${String(error)}`);
  }
  return getURLFromRedirectError(error);
}

describe("server action guards", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(apiKey);
    await testDb.delete(webhookEndpoint);
    await testDb.delete(upload);
    await testDb.delete(waitlistEntry);
    await testDb.delete(organizationMember);
    await testDb.delete(organization);
    await testDb.delete(user);

    for (const id of [ALICE, DAN, CAROL, BOB]) await seedUser(id);
    await seedOrg(ORG_A);
    await seedOrg(ORG_B);
    await seedOrgMember(ALICE, ORG_A, "owner");
    await seedOrgMember(DAN, ORG_A, "admin");
    await seedOrgMember(CAROL, ORG_A, "member");
    await seedOrgMember(BOB, ORG_B, "owner");
  });

  describe("createApiKeyAction", () => {
    it("refuses a call without session", async () => {
      signIn(null);

      expect(await redirectOf(createApiKeyAction(ORG_A, { name: "Key", scopes: ["*"] }))).toBe("/sign-in");
      expect(await testDb.select().from(apiKey)).toHaveLength(0);
    });

    it("refuses an organization the user does not belong to", async () => {
      signIn(ALICE);

      expect(await redirectOf(createApiKeyAction(ORG_B, { name: "Key", scopes: ["*"] }))).toBe("/dashboard");
      expect(await testDb.select().from(apiKey)).toHaveLength(0);
    });

    it("refuses a plain member", async () => {
      signIn(CAROL);

      expect(await redirectOf(createApiKeyAction(ORG_A, { name: "Key", scopes: ["*"] }))).toBe("/dashboard");
    });

    it("creates the key for an admin, on behalf of the session user", async () => {
      signIn(DAN);

      await createApiKeyAction(ORG_A, { name: "Key", scopes: ["*"] });

      const keys = await testDb.select().from(apiKey);
      expect(keys).toHaveLength(1);
      expect(keys[0].createdBy).toBe(DAN);
    });
  });

  describe("revokeApiKeyAction", () => {
    it("cannot revoke the key of another organization", async () => {
      await testDb.insert(apiKey).values({ id: "key-b", orgId: ORG_B, createdBy: BOB, name: "B", prefix: "sk_live_x", hash: "h" });
      signIn(ALICE);

      // Through her own organization: no match, nothing happens
      await revokeApiKeyAction("key-b", ORG_A);
      // Through the other organization: refused
      expect(await redirectOf(revokeApiKeyAction("key-b", ORG_B))).toBe("/dashboard");

      const [key] = await testDb.select().from(apiKey).where(eq(apiKey.id, "key-b"));
      expect(key.revokedAt).toBeNull();
    });
  });

  describe("webhook actions", () => {
    beforeEach(async () => {
      await testDb.insert(webhookEndpoint).values({ id: "hook-b", orgId: ORG_B, url: "https://b.example.com", secret: "whsec_b", events: ["*"] });
    });

    it("refuses a call without session", async () => {
      signIn(null);

      expect(await redirectOf(toggleWebhookEndpointAction("hook-b", ORG_B, false))).toBe("/sign-in");
    });

    it("cannot delete or toggle the endpoint of another organization", async () => {
      signIn(ALICE);

      await deleteWebhookEndpointAction("hook-b", ORG_A);
      await toggleWebhookEndpointAction("hook-b", ORG_A, false);
      expect(await redirectOf(deleteWebhookEndpointAction("hook-b", ORG_B))).toBe("/dashboard");

      const [endpoint] = await testDb.select().from(webhookEndpoint).where(eq(webhookEndpoint.id, "hook-b"));
      expect(endpoint.active).toBe(true);
    });
  });

  describe("getOrganizationMembersAction", () => {
    it("refuses a call without session", async () => {
      signIn(null);

      expect(await redirectOf(getOrganizationMembersAction(ORG_A))).toBe("/sign-in");
    });

    it("refuses an organization the user does not belong to", async () => {
      signIn(BOB);

      expect(await redirectOf(getOrganizationMembersAction(ORG_A))).toBe("/dashboard");
    });

    it("returns display fields only, never the user record", async () => {
      signIn(CAROL);

      const members = await getOrganizationMembersAction(ORG_A);

      expect(members).toHaveLength(3);
      expect(Object.keys(members[0]).sort()).toEqual(
        ["createdAt", "id", "role", "userEmail", "userId", "userImage", "userName"],
      );
    });
  });

  describe("createCheckoutSessionAction", () => {
    it("refuses a call without session", async () => {
      signIn(null);

      expect(await redirectOf(createCheckoutSessionAction(ORG_A, "price_x"))).toBe("/sign-in");
      expect(checkoutCreate).not.toHaveBeenCalled();
    });

    it("refuses another organization and plain members", async () => {
      signIn(ALICE);
      expect(await redirectOf(createCheckoutSessionAction(ORG_B, "price_x"))).toBe("/dashboard");

      signIn(CAROL);
      expect(await redirectOf(createCheckoutSessionAction(ORG_A, "price_x"))).toBe("/dashboard");

      expect(checkoutCreate).not.toHaveBeenCalled();
    });

    it("refuses a price that is not one of the plans", async () => {
      signIn(ALICE);

      await expect(createCheckoutSessionAction(ORG_A, "price_attacker")).rejects.toThrow("Unknown price");
      expect(checkoutCreate).not.toHaveBeenCalled();
    });
  });

  describe("deleteFile", () => {
    it("refuses a call without session", async () => {
      const file = await seedUpload(BOB, { organizationId: ORG_B });
      signIn(null);

      expect(await redirectOf(deleteFile(file.id))).toBe("/sign-in");
      expect(storageDelete).not.toHaveBeenCalled();
    });

    it("refuses a file of another organization", async () => {
      const file = await seedUpload(BOB, { organizationId: ORG_B });
      signIn(ALICE);

      expect(await deleteFile(file.id)).toEqual({ error: "Forbidden" });
      expect(storageDelete).not.toHaveBeenCalled();
      expect(await testDb.select().from(upload).where(eq(upload.id, file.id))).toHaveLength(1);
    });

    it("lets a member of the file's organization delete it", async () => {
      const file = await seedUpload(CAROL, { organizationId: ORG_A });
      signIn(ALICE);

      expect(await deleteFile(file.id)).toEqual({ success: true });
      expect(storageDelete).toHaveBeenCalledWith(file.storageKey);
    });
  });

  describe("member management", () => {
    const aliceMembership = `member-${ALICE}-${ORG_A}`;

    it("does not let an admin remove or demote the owner", async () => {
      signIn(DAN);

      expect((await removeMember({ orgId: ORG_A, memberIdToRemove: aliceMembership })).success).toBe(false);
      expect((await changeRole({ orgId: ORG_A, memberId: aliceMembership, newRole: "member" })).success).toBe(false);

      const [owner] = await testDb.select().from(organizationMember).where(eq(organizationMember.id, aliceMembership));
      expect(owner.role).toBe("owner");
    });

    it("refuses to manage the members of another organization", async () => {
      signIn(BOB);

      expect(await redirectOf(removeMember({ orgId: ORG_A, memberIdToRemove: `member-${CAROL}-${ORG_A}` }))).toBe("/dashboard");
      expect(await testDb.select().from(organizationMember).where(eq(organizationMember.organizationId, ORG_A))).toHaveLength(3);
    });
  });

  describe("inviteFromWaitlist", () => {
    it("is reserved to platform admins", async () => {
      await testDb.insert(waitlistEntry).values({ id: "wl-1", email: "wl@test.com", referralCode: "wlcode01" });

      signIn(null);
      expect(await redirectOf(inviteFromWaitlist({ entryId: "wl-1" }))).toBe("/sign-in");
      signIn(ALICE);
      expect(await redirectOf(inviteFromWaitlist({ entryId: "wl-1" }))).toBe("/dashboard");

      const [entry] = await testDb.select().from(waitlistEntry).where(eq(waitlistEntry.id, "wl-1"));
      expect(entry.status).toBe("waiting");
    });
  });
});
