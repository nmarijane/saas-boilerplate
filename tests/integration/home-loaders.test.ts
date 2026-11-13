import type { WorkspaceScope } from "@/shared/shell/contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCreditsUsedThisMonth } from "@/features/ai/queries";
import { aiShell } from "@/features/ai/shell";
import { countActiveApiKeys } from "@/features/api-keys/queries";
import { apiKeysShell } from "@/features/api-keys/shell";
import { getWorkspaceActivity, NOISY_ACTIONS } from "@/features/audit/queries";
import { auditShell } from "@/features/audit/shell";
import { countMembers } from "@/features/auth/organization/queries";
import { organizationShell } from "@/features/auth/organization/shell";
import { FEATURES } from "@/features/registry"; // upload
import { getStorageUsedMb } from "@/features/upload/queries"; // upload
import { uploadShell } from "@/features/upload/shell"; // upload
import {
  aiCreditLedger,
  apiKey,
  auditLog,
  organizationMember,
  upload, // upload
  user,
} from "@/models";
import {
  seedOrg,
  seedOrgMember,
  seedUpload, // upload
  seedUser,
} from "../helpers/seed";
import { testDb } from "../setup";

// Loading the registry loads the shells it lists, and with them the components
// they mount, and the locale-aware navigation of next-intl, which no Next router runs for in a
// test. A stand-in gives them the names they import. Nothing is rendered here.
vi.mock("@/shared/lib/i18n-navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
}));

// What the upload feature gives the home is tested here too: the lines and the
// cases that name it end in `// upload` or sit between `// upload:start` and
// `// upload:end`, which is what a project without uploads takes out of this file.

const ORG = "home-org";
const OTHER_ORG = "home-other-org";
const OWNER = "home-owner";
const MEMBER = "home-member";

// The credits are counted from the first day of the UTC month: every row
// has the date it is read at (the database stamps a fresh one with its own
// clock, which is not the one of the month), and the clock is given.
const NOW = new Date("2026-11-15T12:00:00.000Z");

function scopeOf(orgId = ORG, role: WorkspaceScope["role"] = "owner"): WorkspaceScope {
  return { orgId, userId: OWNER, role };
}

/** The one entry of a list the shell declares. */
function only<T>(entries: T[] | undefined): T {
  expect(entries).toHaveLength(1);
  return entries?.[0] as T;
}

let sequence = 0;
const next = (prefix: string) => `${prefix}-${++sequence}`;

async function credit(orgId: string, amount: number, createdAt: Date) {
  await testDb.insert(aiCreditLedger).values({
    id: next("credit"),
    organizationId: orgId,
    amount,
    reason: amount < 0 ? "usage" : "plan_allocation",
    createdAt,
  });
}

async function log(
  action: string,
  at: string,
  overrides: Partial<typeof auditLog.$inferInsert> = {},
) {
  await testDb.insert(auditLog).values({
    id: next("log"),
    orgId: ORG,
    actorId: OWNER,
    action,
    resourceType: "test",
    resourceId: "res-1",
    createdAt: new Date(at),
    ...overrides,
  });
}

async function key(orgId: string, overrides: Partial<typeof apiKey.$inferInsert> = {}) {
  await testDb.insert(apiKey).values({
    id: next("key"),
    orgId,
    createdBy: OWNER,
    name: "A key",
    prefix: "sk_live_ab",
    hash: next("hash"),
    ...overrides,
  });
}

describe("what the home reads of a workspace", () => {
  beforeEach(async () => {
    await testDb.delete(auditLog);
    await testDb.delete(aiCreditLedger);
    await testDb.delete(upload); // upload
    await testDb.delete(apiKey);
    await testDb.delete(organizationMember);
    await testDb.delete(user);
    await seedUser(OWNER, { name: "Léa Martin", image: "https://example.com/lea.png" });
    await seedUser(MEMBER, { name: "Camille Laurent" });
    await seedOrg(ORG);
    await seedOrg(OTHER_ORG);
  });

  describe("the figures", () => {
    it("counts members, this month's AI credits and the storage of a workspace", async () => {
      await seedOrgMember(OWNER, ORG, "owner");
      await seedOrgMember(MEMBER, ORG, "member");
      // Elsewhere: not counted
      await seedOrgMember(OWNER, OTHER_ORG, "owner");

      // Last month's use does not count, nor does what was added or what another workspace used
      await credit(ORG, -100, new Date("2026-10-31T23:59:59.000Z"));
      await credit(ORG, -300, new Date("2026-11-02T09:00:00.000Z"));
      await credit(ORG, 5000, new Date("2026-11-01T00:00:00.000Z"));
      await credit(OTHER_ORG, -777, new Date("2026-11-02T09:00:00.000Z"));

      await seedUpload(OWNER, { organizationId: ORG, size: 1_500_000 }); // upload
      await seedUpload(OWNER, { organizationId: ORG, size: 1_500_000 }); // upload
      await seedUpload(OWNER, { organizationId: OTHER_ORG, size: 9_000_000 }); // upload
      await seedUpload(OWNER, { organizationId: null, size: 9_000_000 }); // upload

      expect(await countMembers(ORG)).toBe(2);
      expect(await getCreditsUsedThisMonth(ORG, NOW)).toBe(300);
      expect(await getStorageUsedMb(ORG)).toBe(3); // upload
    });

    it("reads zero from a workspace that has nothing yet, not nothing", async () => {
      expect(await countMembers(ORG)).toBe(0);
      expect(await getCreditsUsedThisMonth(ORG, NOW)).toBe(0);
      expect(await getStorageUsedMb(ORG)).toBe(0); // upload
      expect(await countActiveApiKeys(ORG)).toBe(0);
    });

    it("counts the credits from the first instant of the month in UTC, whatever the clock of the machine says", async () => {
      await credit(ORG, -10, new Date("2026-10-31T23:59:59.999Z"));
      await credit(ORG, -20, new Date("2026-11-01T00:00:00.000Z"));
      await credit(ORG, -40, new Date("2026-11-30T23:59:59.000Z"));

      // 04:30 on 1 November in UTC is still the evening of 31 October at UTC-5: the month is the UTC one
      expect(await getCreditsUsedThisMonth(ORG, new Date("2026-10-31T23:30:00.000-05:00"))).toBe(60);
      // Once a month is over, its use is no longer this month's
      expect(await getCreditsUsedThisMonth(ORG, new Date("2026-12-01T00:00:00.000Z"))).toBe(0);
    });

    it("reads the credits of the month the clock is in when it is not given", async () => {
      const now = new Date();
      await credit(ORG, -7, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
      await credit(ORG, -9, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)));

      expect(await getCreditsUsedThisMonth(ORG)).toBe(7);
    });

    // upload:start
    it("writes the storage in megabytes of a million bytes, on one decimal", async () => {
      await seedUpload(OWNER, { organizationId: ORG, size: 1_234_567 });
      await seedUpload(OWNER, { organizationId: ORG, size: 20_000 });

      // 1.254567 MB
      expect(await getStorageUsedMb(ORG)).toBe(1.3);

      await testDb.delete(upload);
      await seedUpload(OWNER, { organizationId: ORG, size: 1_040_000 });
      expect(await getStorageUsedMb(ORG)).toBe(1);
    });
    // upload:end

    it("counts the keys that can still be used (not revoked, not expired), of this workspace alone", async () => {
      const year = 365 * 24 * 60 * 60 * 1000;
      await key(ORG);
      await key(ORG, { expiresAt: new Date(Date.now() + year) });
      await key(ORG, { revokedAt: new Date("2026-11-01T00:00:00.000Z") });
      await key(ORG, { expiresAt: new Date(Date.now() - year) });
      await key(OTHER_ORG);

      expect(await countActiveApiKeys(ORG)).toBe(2);
      expect(await countActiveApiKeys(OTHER_ORG)).toBe(1);
    });
  });

  describe("the activity", () => {
    it("hides noisy events and keeps the newest five", async () => {
      // Seven that tell something, and the ones that are noise, which are the newest of all
      await log("project.created", "2026-11-03T07:00:00.000Z");
      await log("project.updated", "2026-11-03T08:00:00.000Z");
      await log("project.deleted", "2026-11-03T09:00:00.000Z");
      await log("api_key.created", "2026-11-03T10:00:00.000Z");
      await log("webhook.created", "2026-11-03T11:00:00.000Z");
      await log("member.invited", "2026-11-03T12:00:00.000Z");
      await log("upload.created", "2026-11-03T13:00:00.000Z");
      expect(NOISY_ACTIONS.length).toBeGreaterThan(0);
      for (const [index, action] of NOISY_ACTIONS.entries()) {
        await log(action, new Date(Date.UTC(2026, 10, 3, 14 + index)).toISOString());
      }

      const activity = await getWorkspaceActivity(ORG);

      expect(activity.map(({ action }) => action)).toEqual([
        "upload.created",
        "member.invited",
        "webhook.created",
        "api_key.created",
        "project.deleted",
      ]);
    });

    it("keeps the five latest by default and as many as it is asked for otherwise", async () => {
      for (let hour = 0; hour < 8; hour++) {
        await log("project.created", `2026-11-03T0${hour}:00:00.000Z`);
      }

      expect(await getWorkspaceActivity(ORG)).toHaveLength(5);
      expect(await getWorkspaceActivity(ORG, 2)).toHaveLength(2);
      expect(await getWorkspaceActivity(ORG, 20)).toHaveLength(8);
    });

    it("tells who did it, from their name and their picture, and who it was done in", async () => {
      await log("project.created", "2026-11-03T10:00:00.000Z", {
        resourceId: "p1",
        metadata: { name: "Atlas" },
      });
      await log("project.deleted", "2026-11-03T09:00:00.000Z", { actorId: MEMBER, metadata: { name: "Borealis" } });
      await log("payment.failed", "2026-11-03T08:00:00.000Z", { actorId: null });
      await log("project.created", "2026-11-03T11:00:00.000Z", {
        orgId: OTHER_ORG,
        metadata: { name: "Elsewhere" },
      });

      const activity = await getWorkspaceActivity(ORG);

      expect(activity).toMatchObject([
        { action: "project.created", actorName: "Léa Martin", actorImage: "https://example.com/lea.png", values: { name: "Atlas" } },
        { action: "project.deleted", actorName: "Camille Laurent", actorImage: null, values: { name: "Borealis" } },
        // Its author is gone, or it has none: it says so
        { action: "payment.failed", actorName: null, actorImage: null, values: {} },
      ]);
      expect(activity[0]?.at).toEqual(new Date("2026-11-03T10:00:00.000Z"));
      expect(activity.every(({ id }) => typeof id === "string" && id.length > 0)).toBe(true);
      // Nothing of the other workspace
      expect(JSON.stringify(activity)).not.toContain("Elsewhere");
    });

    it("keeps the details that are text, and leaves out the rest", async () => {
      await log("project.created", "2026-11-03T10:00:00.000Z", {
        metadata: {
          name: "Atlas",
          planId: "pro",
          count: 3,
          done: true,
          nothing: null,
          nested: { secret: "x" },
          list: ["a"],
        },
      });
      await log("project.updated", "2026-11-03T09:00:00.000Z", { metadata: null });

      const activity = await getWorkspaceActivity(ORG);

      expect(activity[0]?.values).toEqual({ name: "Atlas", planId: "pro" });
      expect(activity[1]?.values).toEqual({});
    });

    it("breaks a tie between events of the same instant by the larger id first, whatever order they were written in", async () => {
      const tied = ["tie-a", "tie-b", "tie-c"];

      // Written in each order in turn: however a plain scan hands tied rows back
      // (in the order they were written, or the other way), one of the two orders
      // differs from the tie-break, so that only the tie-break can pass both.
      for (const written of [tied, [...tied].reverse()]) {
        await testDb.delete(auditLog);
        for (const id of written) {
          await log("project.created", "2026-11-03T10:00:00.000Z", { id });
        }

        expect((await getWorkspaceActivity(ORG)).map(({ id }) => id)).toEqual(["tie-c", "tie-b", "tie-a"]);
      }

      // A later event still comes first: the id only settles a tie
      await log("api_key.created", "2026-11-03T10:00:01.000Z", { id: "tie-0" });
      expect((await getWorkspaceActivity(ORG)).map(({ id }) => id)).toEqual(["tie-0", "tie-c", "tie-b", "tie-a"]);
    });
  });

  describe("what the features declare", () => {
    it("marks the invite step done from two members", async () => {
      const task = only(organizationShell.tasks);

      expect(await task.isDone(scopeOf())).toBe(false);
      await seedOrgMember(OWNER, ORG, "owner");
      expect(await task.isDone(scopeOf())).toBe(false);
      await seedOrgMember(MEMBER, ORG, "member");
      expect(await task.isDone(scopeOf())).toBe(true);
      // Two members of another workspace are not this one's team
      expect(await task.isDone(scopeOf(OTHER_ORG))).toBe(false);
    });

    it("asks an admin to invite the team, on the page of the team, in the tone 3", () => {
      expect(only(organizationShell.tasks)).toMatchObject({
        id: "invite-team",
        labelKey: "organization.task",
        tone: 3,
        order: 20,
        minRole: "admin",
        action: { href: "/settings/team", labelKey: "organization.taskAction" },
      });
    });

    it("counts the members against the limit of the plan", async () => {
      const quota = only(organizationShell.quotas);

      expect(quota).toMatchObject({ id: "members", limitKey: "members", labelKey: "quotas.members", tone: 3, order: 20 });
      await seedOrgMember(OWNER, ORG, "owner");
      await seedOrgMember(MEMBER, ORG, "member");
      expect(await quota.usage(scopeOf())).toBe(2);
    });

    it("marks the API key step done from one key that can still be used", async () => {
      const task = only(apiKeysShell.tasks);

      expect(task).toMatchObject({
        id: "api-key",
        labelKey: "apiKeys.task",
        tone: 2,
        order: 30,
        minRole: "admin",
        action: { href: "/settings/developers", labelKey: "apiKeys.taskAction" },
      });
      expect(await task.isDone(scopeOf())).toBe(false);
      await key(ORG, { revokedAt: new Date("2026-11-01T00:00:00.000Z") });
      expect(await task.isDone(scopeOf())).toBe(false);
      // A key that has expired is no key to build on: the step is still to do
      await key(ORG, { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
      expect(await task.isDone(scopeOf())).toBe(false);
      await key(ORG);
      expect(await task.isDone(scopeOf())).toBe(true);
      expect(await task.isDone(scopeOf(OTHER_ORG))).toBe(false);
    });

    it("counts the credits of the month against the limit aiCredits", async () => {
      const credits = only(aiShell.quotas);

      expect(credits).toMatchObject({ id: "ai-credits", limitKey: "aiCredits", labelKey: "quotas.aiCredits", tone: 2, order: 40 });
      expect(credits.unit).toBeUndefined();

      await credit(ORG, -42, new Date());

      expect(await credits.usage(scopeOf())).toBe(42);
    });

    // upload:start
    it("counts the storage against the limit storage, in megabytes", async () => {
      const storage = only(uploadShell.quotas);

      expect(storage).toMatchObject({ id: "storage", limitKey: "storage", labelKey: "quotas.storage", unit: "megabyte", tone: 4, order: 30 });

      await seedUpload(OWNER, { organizationId: ORG, size: 2_500_000 });

      expect(await storage.usage(scopeOf())).toBe(2.5);
    });
    // upload:end

    it("gives the home the activity of the workspace of the scope", async () => {
      await log("project.created", "2026-11-03T10:00:00.000Z");
      await log("project.created", "2026-11-03T11:00:00.000Z", { orgId: OTHER_ORG });

      const activity = await auditShell.activity?.(scopeOf(), 5);

      expect(activity).toHaveLength(1);
      expect(await auditShell.activity?.(scopeOf(OTHER_ORG), 5)).toHaveLength(1);
    });

    // upload:start
    it("lists the upload feature in the registry, which it alone mentions", () => {
      expect(FEATURES).toContain(uploadShell);
      expect(uploadShell.id).toBe("upload");
    });
    // upload:end
  });
});
