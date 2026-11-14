import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiKeyAction, revokeApiKeyAction } from "@/features/api-keys/actions";
import { changeRole, removeMember } from "@/features/auth/organization/actions";
import {
  cancelSubscriptionAction,
  changePlanAction,
  createPortalSessionAction,
  getCheckoutStatusAction,
  previewPlanChangeAction,
  resumeSubscriptionAction,
  startCheckoutAction,
  startPackCheckoutAction,
} from "@/features/billing/actions";
import { createProject, deleteProject, updateProject } from "@/features/projects/actions";
import { deleteFile } from "@/features/upload/actions";
import { inviteFromWaitlist } from "@/features/waitlist/actions";
import { deleteWebhookEndpointAction, toggleWebhookEndpointAction } from "@/features/webhooks/actions";
import { apiKey, organization, organizationMember, project, upload, user, waitlistEntry, webhookEndpoint } from "@/models";
import { redirectOf } from "../helpers/navigation";
import { seedOrg, seedOrgMember, seedProject, seedUpload, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * Server actions called the way an attacker would: directly, without the UI.
 * Unlike the other suites, the guards are the real ones; only the session
 * lookup (Better Auth) and the external services are mocked.
 */

const { getSession, checkoutCreate, storageDelete, request } = vi.hoisted(() => ({
  getSession: vi.fn(),
  // The language of the request, which the proxy sets and the guards put in front of the page they send to
  request: { locale: "en" },
  checkoutCreate: vi.fn(),
  storageDelete: vi.fn(),
}));

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("next-intl/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl/server")>()),
  getLocale: async () => request.locale,
}));
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

describe("server action guards", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    request.locale = "en";
    await testDb.delete(apiKey);
    await testDb.delete(webhookEndpoint);
    await testDb.delete(upload);
    await testDb.delete(waitlistEntry);
    await testDb.delete(project);
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

      expect(await redirectOf(createApiKeyAction(ORG_A, { name: "Key", scopes: ["*"] }))).toBe("/en/sign-in");
      expect(await testDb.select().from(apiKey)).toHaveLength(0);
    });

    it("refuses an organization the user does not belong to", async () => {
      signIn(ALICE);

      expect(await redirectOf(createApiKeyAction(ORG_B, { name: "Key", scopes: ["*"] }))).toBe("/en/dashboard");
      expect(await testDb.select().from(apiKey)).toHaveLength(0);
    });

    it("refuses a plain member", async () => {
      signIn(CAROL);

      expect(await redirectOf(createApiKeyAction(ORG_A, { name: "Key", scopes: ["*"] }))).toBe("/en/dashboard");
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
      expect(await redirectOf(revokeApiKeyAction("key-b", ORG_B))).toBe("/en/dashboard");

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

      expect(await redirectOf(toggleWebhookEndpointAction("hook-b", ORG_B, false))).toBe("/en/sign-in");
    });

    it("cannot delete or toggle the endpoint of another organization", async () => {
      signIn(ALICE);

      await deleteWebhookEndpointAction("hook-b", ORG_A);
      await toggleWebhookEndpointAction("hook-b", ORG_A, false);
      expect(await redirectOf(deleteWebhookEndpointAction("hook-b", ORG_B))).toBe("/en/dashboard");

      const [endpoint] = await testDb.select().from(webhookEndpoint).where(eq(webhookEndpoint.id, "hook-b"));
      expect(endpoint.active).toBe(true);
    });
  });

  describe("project actions", () => {
    it("lets a member create and update a project but not delete one", async () => {
      signIn(CAROL);

      expect((await createProject({ organizationId: ORG_A, name: "Atlas" })).success).toBe(true);
      const [created] = await testDb.select().from(project);
      expect(created.createdBy).toBe(CAROL);

      expect((await updateProject({ organizationId: ORG_A, projectId: created.id, name: "Atlas 2" })).success).toBe(true);
      expect(await redirectOf(deleteProject({ organizationId: ORG_A, projectId: created.id }))).toBe("/en/dashboard");
      expect(await testDb.select().from(project).where(eq(project.id, created.id))).toHaveLength(1);

      signIn(DAN);

      expect((await deleteProject({ organizationId: ORG_A, projectId: created.id })).success).toBe(true);
      expect(await testDb.select().from(project)).toHaveLength(0);
    });

    it("refuses project actions to someone outside the workspace", async () => {
      await seedProject(ORG_A, { id: "proj-a", name: "A" });
      await seedProject(ORG_B, { id: "proj-b", name: "B" });

      signIn(null);
      expect(await redirectOf(createProject({ organizationId: ORG_A, name: "Atlas" }))).toBe("/en/sign-in");

      // Bob owns B, not A
      signIn(BOB);
      expect(await redirectOf(createProject({ organizationId: ORG_A, name: "Atlas" }))).toBe("/en/dashboard");
      expect(await redirectOf(updateProject({ organizationId: ORG_A, projectId: "proj-a", name: "Hijacked" }))).toBe("/en/dashboard");
      expect(await redirectOf(deleteProject({ organizationId: ORG_A, projectId: "proj-a" }))).toBe("/en/dashboard");

      // Alice owns A: naming B is refused, and naming A with an id of B finds nothing
      signIn(ALICE);
      expect(await redirectOf(updateProject({ organizationId: ORG_B, projectId: "proj-b", name: "Hijacked" }))).toBe("/en/dashboard");
      expect(await redirectOf(deleteProject({ organizationId: ORG_B, projectId: "proj-b" }))).toBe("/en/dashboard");
      expect((await updateProject({ organizationId: ORG_A, projectId: "proj-b", name: "Hijacked" })).success).toBe(false);
      expect((await deleteProject({ organizationId: ORG_A, projectId: "proj-b" })).success).toBe(false);

      const projects = await testDb.select({ id: project.id, name: project.name }).from(project).orderBy(project.id);
      expect(projects).toEqual([{ id: "proj-a", name: "A" }, { id: "proj-b", name: "B" }]);
    });
  });

  // Buying and changing the plan are for the owner and the admins, cancelling for the owner alone: the role
  // is read from the membership on the server, never from the page. A browser names a plan and a period (or a
  // pack), and no price.
  describe("the billing actions", () => {
    const choice = (orgId: string) => ({ orgId, planId: "pro", interval: "monthly" as const });
    const everyBuy = [
      ["startCheckoutAction", (orgId: string) => startCheckoutAction(choice(orgId))],
      ["startPackCheckoutAction", (orgId: string) => startPackCheckoutAction({ orgId, packId: "credits-1000" })],
      ["previewPlanChangeAction", (orgId: string) => previewPlanChangeAction(choice(orgId))],
      ["changePlanAction", (orgId: string) => changePlanAction(choice(orgId))],
    ] as const;

    it.each(everyBuy)("%s refuses a call without session", async (_, call) => {
      signIn(null);

      expect(await redirectOf(call(ORG_A))).toBe("/en/sign-in");
      expect(checkoutCreate).not.toHaveBeenCalled();
    });

    it.each(everyBuy)("%s refuses another organization and plain members", async (_, call) => {
      signIn(ALICE);
      expect(await redirectOf(call(ORG_B))).toBe("/en/dashboard");

      signIn(CAROL);
      expect(await redirectOf(call(ORG_A))).toBe("/en/dashboard");

      expect(checkoutCreate).not.toHaveBeenCalled();
    });

    it.each([
      ["cancelSubscriptionAction", (orgId: string) => cancelSubscriptionAction({ orgId })],
      ["resumeSubscriptionAction", (orgId: string) => resumeSubscriptionAction({ orgId })],
    ] as const)("%s is the owner's alone: an admin is sent away too", async (_, call) => {
      signIn(DAN);
      expect(await redirectOf(call(ORG_A))).toBe("/en/dashboard");

      signIn(CAROL);
      expect(await redirectOf(call(ORG_A))).toBe("/en/dashboard");

      signIn(BOB);
      expect(await redirectOf(call(ORG_A))).toBe("/en/dashboard");
    });

    it("opens the portal for the owner and the admins only", async () => {
      signIn(null);
      expect(await redirectOf(createPortalSessionAction(ORG_A))).toBe("/en/sign-in");
      signIn(CAROL);
      expect(await redirectOf(createPortalSessionAction(ORG_A))).toBe("/en/dashboard");
      signIn(ALICE);
      expect(await redirectOf(createPortalSessionAction(ORG_B))).toBe("/en/dashboard");
    });

    it("refuses a plan that is not one of ours, in the words of a code, whoever asks", async () => {
      signIn(ALICE);

      expect(await startCheckoutAction({ ...choice(ORG_A), planId: "free" })).toEqual({ success: false, error: expect.any(String) });
      expect(await startCheckoutAction({ ...choice(ORG_A), planId: "price_attacker" })).toMatchObject({ success: false });
      expect(await startCheckoutAction({ ...choice(ORG_A), interval: "weekly" as "monthly" })).toMatchObject({ success: false, error: "Validation failed" });
      expect(checkoutCreate).not.toHaveBeenCalled();
    });

    it("lets an admin start a payment, for the workspace of the session and on their own behalf", async () => {
      signIn(DAN);
      checkoutCreate.mockResolvedValue({ id: "cs_guard", ui_mode: "embedded_page", url: null });

      const answer = await startCheckoutAction(choice(ORG_A));

      // No Stripe key in the test environment: the shop is not set up, and says so as a code
      expect(answer).toEqual({ success: false, error: "not_configured" });
      expect(checkoutCreate).not.toHaveBeenCalled();
    });

    it("tells whether a checkout reached the app only to a member of the workspace it was opened for", async () => {
      signIn(null);
      expect(await redirectOf(getCheckoutStatusAction({ sessionId: "cs_1" }))).toBe("/en/sign-in");
    });
  });

  describe("deleteFile", () => {
    it("refuses a call without session", async () => {
      const file = await seedUpload(BOB, { organizationId: ORG_B });
      signIn(null);

      expect(await redirectOf(deleteFile(file.id))).toBe("/en/sign-in");
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

      expect(await redirectOf(removeMember({ orgId: ORG_A, memberIdToRemove: `member-${CAROL}-${ORG_A}` }))).toBe("/en/dashboard");
      expect(await testDb.select().from(organizationMember).where(eq(organizationMember.organizationId, ORG_A))).toHaveLength(3);
    });
  });

  describe("inviteFromWaitlist", () => {
    it("is reserved to platform admins", async () => {
      await testDb.insert(waitlistEntry).values({ id: "wl-1", email: "wl@test.com", referralCode: "wlcode01" });

      signIn(null);
      expect(await redirectOf(inviteFromWaitlist({ entryId: "wl-1" }))).toBe("/en/sign-in");
      signIn(ALICE);
      expect(await redirectOf(inviteFromWaitlist({ entryId: "wl-1" }))).toBe("/en/dashboard");

      const [entry] = await testDb.select().from(waitlistEntry).where(eq(waitlistEntry.id, "wl-1"));
      expect(entry.status).toBe("waiting");
    });
  });

  // The address leaves the server complete, with the language of the request: a bare `/sign-in` would be
  // redirected a second time by the proxy, to add it. These use the actions of the members, which are always
  // there (a project that takes a feature out keeps this block); the admin guard is read by the admin pages' tests.
  describe.each(["en", "fr"])("in %s", (locale) => {
    beforeEach(() => {
      request.locale = locale;
    });

    it("sends a visitor with no session to sign in, a stranger and a plain member to the home", async () => {
      const target = { orgId: ORG_A, memberIdToRemove: `member-${DAN}-${ORG_A}` };

      signIn(null);
      expect(await redirectOf(removeMember(target))).toBe(`/${locale}/sign-in`);
      signIn(BOB);
      expect(await redirectOf(removeMember(target))).toBe(`/${locale}/dashboard`);
      signIn(CAROL);
      expect(await redirectOf(removeMember(target))).toBe(`/${locale}/dashboard`);
    });
  });

  it("follows the language of each request, not the one of the first", async () => {
    const target = { orgId: ORG_A, memberIdToRemove: `member-${DAN}-${ORG_A}` };
    signIn(null);

    request.locale = "fr";
    expect(await redirectOf(removeMember(target))).toBe("/fr/sign-in");
    request.locale = "en";
    expect(await redirectOf(removeMember(target))).toBe("/en/sign-in");
  });
});
