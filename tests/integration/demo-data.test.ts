import type { PgTable } from "drizzle-orm/pg-core";
import { verifyPassword } from "better-auth/crypto";
import { count, eq, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getConversations,
  getMessages,
  periodOf,
  readCredits,
} from "@/features/ai/queries";
import { allocationUsed } from "@/features/ai/service";
import { countActiveApiKeys } from "@/features/api-keys/queries";
import { getWorkspaceActivity } from "@/features/audit/queries";
import {
  countMembers,
  getOrganizationMembers,
  getUserOrganizations,
} from "@/features/auth/organization/queries";
import { getPlanById } from "@/features/billing/plans";
import { getWorkspacePlan } from "@/features/billing/queries";
import { getUnreadCount } from "@/features/notifications/queries";
import { countProjects, listProjects } from "@/features/projects/queries";
import { getStorageUsedMb } from "@/features/upload/queries";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import {
  account,
  aiConversation,
  aiCreditLedger,
  aiMessage,
  auditLog,
  notification,
  organization,
  organizationMember,
  plan,
  project,
  subscription,
  upload,
  user,
} from "@/models";
import { seedDemo } from "../../scripts/demo-data";
import { seedOrg, seedPlan, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * The demo workspace is what the README's screenshots show, so its figures are
 * the ones those pages read. Each is read here through the query the app draws
 * it with, not from the rows. `NOW` is fixed, in the middle of a month: the
 * dates are relative to it, and the credits of "this month" are counted from
 * the first day of the UTC month.
 */

const NOW = new Date("2026-11-18T14:30:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const PROJECT_NAMES = [
  "Atlas",
  "Orbit",
  "Relay",
  "Beacon",
  "Harbor",
  "Summit",
  "Lumen",
  "Vector",
  "Delta",
  "Quartz",
  "Nimbus",
  "Pulse",
];

/** Every table the demo writes to. */
const SEEDED_TABLES = {
  users: user,
  accounts: account,
  organizations: organization,
  members: organizationMember,
  subscriptions: subscription,
  projects: project,
  ledger: aiCreditLedger,
  conversations: aiConversation,
  messages: aiMessage,
  uploads: upload,
  logs: auditLog,
  notifications: notification,
};

async function countRows(table: PgTable): Promise<number> {
  const [row] = await testDb.select({ n: count() }).from(table);

  return row?.n ?? 0;
}

async function rowCounts() {
  const entries = await Promise.all(
    Object.entries(SEEDED_TABLES).map(
      async ([name, table]) => [name, await countRows(table)] as const,
    ),
  );

  return Object.fromEntries(entries);
}

/** No row in any table the demo writes to. */
const NOTHING = Object.fromEntries(
  Object.keys(SEEDED_TABLES).map((name) => [name, 0]),
);

async function orgIdOf(slug: string): Promise<string> {
  const [row] = await testDb
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug));
  if (!row) {
    throw new Error(`The demo has no workspace "${slug}"`);
  }

  return row.id;
}

async function userIdOf(email: string): Promise<string> {
  const [row] = await testDb
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (!row) {
    throw new Error(`The demo has no one at ${email}`);
  }

  return row.id;
}

/** The demo says what it did in a line of the console: kept out of the test output, and read from the spy. */
function silenceTheConsole() {
  return vi.spyOn(console, "log").mockImplementation(() => {});
}

/** The lines the demo said, one string each. */
const said = (spy: ReturnType<typeof silenceTheConsole>) =>
  spy.mock.calls.map((call) => String(call[0]));

/** Deleting the workspaces and the people takes everything the demo wrote with them. */
async function resetDemo() {
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedPlan("pro");
}

describe("the demo workspace", () => {
  let log: ReturnType<typeof silenceTheConsole>;

  beforeEach(async () => {
    log = silenceTheConsole();
    await resetDemo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("seeds the demo workspace once, however often it runs", async () => {
    await seedDemo(testDb, NOW);
    const once = await rowCounts();
    await seedDemo(testDb, NOW);

    expect(await rowCounts()).toEqual(once);

    const acme = await orgIdOf("acme");
    const camille = await userIdOf("camille@example.com");
    expect(await countProjects(acme)).toBe(12);
    expect(await countMembers(acme)).toBe(3);
    expect(await allocationUsed(acme, NOW)).toBe(4120);
    expect(await getUnreadCount(camille)).toBe(2);
    expect(await getWorkspaceActivity(acme)).toHaveLength(5);
    // The activity query stops at five lines: the rows say whether there are more
    expect(once).toMatchObject({ logs: 5, notifications: 5, members: 4 });
  });

  it("says in one line that it seeded the demo, and what to sign in with", async () => {
    await seedDemo(testDb, NOW);

    expect(said(log)).toEqual([expect.stringContaining("camille@example.com")]);
  });

  // The demo takes names: the workspaces `acme` and `northwind`, three
  // addresses. When one already belongs to a row of someone else (a workspace
  // made by hand, a person who signed up), its own rows could not point at it:
  // the parent would be skipped and the next insert would fail halfway, with
  // the plans and the dev accounts of the seed in and a part of the demo with
  // them. It leaves the whole demo out instead, and says why.
  describe("when a name of the demo belongs to another row", () => {
    it("writes nothing of the demo, without failing, when one of its addresses does", async () => {
      await seedUser("someone-else", { email: "camille@example.com" });

      await expect(seedDemo(testDb, NOW)).resolves.toBeUndefined();

      expect(await rowCounts()).toEqual({ ...NOTHING, users: 1 });
      expect(said(log)).toEqual([
        expect.stringContaining("camille@example.com"),
      ]);
    });

    it("writes nothing of the demo, without failing, when its workspace does", async () => {
      await seedOrg("someone-elses-acme", { name: "Acme", slug: "acme" });

      await expect(seedDemo(testDb, NOW)).resolves.toBeUndefined();

      expect(await rowCounts()).toEqual({ ...NOTHING, organizations: 1 });
      expect(said(log)).toEqual([expect.stringContaining("acme")]);
    });

    it("leaves the plans as they are", async () => {
      await seedUser("someone-else", { email: "lea@example.com" });

      await seedDemo(testDb, NOW);

      expect(await countRows(plan)).toBe(1);
    });
  });

  it("writes all of the demo or none of it: a failure rolls back what was already in", async () => {
    // The subscription points at a plan that is not there: it fails after the
    // people, the workspaces and their members are written
    await testDb.delete(plan);

    await expect(seedDemo(testDb, NOW)).rejects.toThrow();

    expect(await rowCounts()).toEqual(NOTHING);
  });

  describe("once seeded", () => {
    beforeEach(async () => {
      await seedDemo(testDb, NOW);
    });

    it("lets the three people, invented, sign in with the password of the seed's dev accounts", async () => {
      const people = await testDb
        .select({
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          onboardingCompleted: user.onboardingCompleted,
          provider: account.providerId,
          hash: account.password,
        })
        .from(user)
        .innerJoin(account, eq(account.userId, user.id))
        .orderBy(user.email);

      expect(people.map(({ email, name }) => [email, name])).toEqual([
        ["camille@example.com", "Camille Laurent"],
        ["lea@example.com", "Léa Martin"],
        ["tom@example.com", "Tom Becker"],
      ]);
      expect(people[0]).toMatchObject({ onboardingCompleted: true });
      for (const person of people) {
        // A sign-in is refused until the address is verified (auth.ts)
        expect(person).toMatchObject({
          provider: "credential",
          emailVerified: true,
        });
        expect(
          await verifyPassword({
            hash: person.hash ?? "",
            password: "admin123",
          }),
        ).toBe(true);
      }
    });

    it("makes Camille the owner of Acme, Léa an admin and Tom a member, and Acme the oldest of Camille's workspaces", async () => {
      const acme = await orgIdOf("acme");
      const camille = await userIdOf("camille@example.com");

      const members = await getOrganizationMembers(acme);
      expect(members.map(({ userEmail, role }) => [userEmail, role])).toEqual([
        ["camille@example.com", "owner"],
        ["lea@example.com", "admin"],
        ["tom@example.com", "member"],
      ]);

      // The workspace a person falls back to, and the one the assistant page opens
      const workspaces = await getUserOrganizations(camille);
      expect(
        workspaces.map(({ slug, name, role }) => [slug, name, role]),
      ).toEqual([
        ["acme", "Acme", "owner"],
        ["northwind", "Northwind", "owner"],
      ]);
      expect(await countMembers(await orgIdOf("northwind"))).toBe(1);
    });

    it("puts Acme on the Pro plan, renewed in 18 days, and Northwind on the free plan", async () => {
      const acme = await orgIdOf("acme");
      const northwind = await orgIdOf("northwind");

      expect(await getWorkspacePlan(acme)).toMatchObject({ id: "pro" });
      expect(await getWorkspacePlan(northwind)).toMatchObject({ id: "free" });

      const [sub] = await testDb
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, acme));
      expect(sub).toMatchObject({ planId: "pro", status: "active" });
      expect(sub?.currentPeriodEnd).toEqual(new Date(NOW.getTime() + 18 * DAY));
    });

    it("gives Acme twelve projects, eight active and four drafts, changed between two hours and three weeks ago", async () => {
      const projects = await listProjects(await orgIdOf("acme"));

      expect(projects.map(({ name }) => name).sort()).toEqual(
        [...PROJECT_NAMES].sort(),
      );
      expect(projects.filter(({ status }) => status === "active")).toHaveLength(
        8,
      );
      expect(projects.filter(({ status }) => status === "draft")).toHaveLength(
        4,
      );

      const ages = projects.map(
        ({ updatedAt }) => NOW.getTime() - updatedAt.getTime(),
      );
      expect(Math.min(...ages)).toBe(2 * HOUR);
      expect(Math.max(...ages)).toBe(21 * DAY);
      for (const { createdAt, updatedAt } of projects) {
        expect(createdAt.getTime()).toBeLessThanOrEqual(updatedAt.getTime());
      }
    });

    it("weighs the uploads 3,200 MB: megabytes of a million bytes, the unit the limits of the plans are written in", async () => {
      expect(await getStorageUsedMb(await orgIdOf("acme"))).toBe(3200);

      const [row] = await testDb
        .select({ bytes: sql<number>`SUM(${upload.size})`.mapWith(Number) })
        .from(upload);
      expect(row?.bytes).toBe(3_200_000_000);
    });

    it("opens the assistant on a conversation about the launch email, four messages long", async () => {
      const [latest] = await getConversations(
        await userIdOf("camille@example.com"),
        await orgIdOf("acme"),
      );
      expect(latest?.title).toBe("Draft the launch email");

      const messages = await getMessages(latest?.id ?? "");
      expect(messages.map(({ role }) => role)).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
      ]);
      // They are read in order of date: two of the same instant would swap
      const dates = messages.map(({ createdAt }) => createdAt.getTime());
      expect(dates).toEqual([...dates].sort((a, b) => a - b));
      expect(new Set(dates).size).toBe(4);
    });

    it("tells five events of the workspace, the latest first, with who did what", async () => {
      const entries = await getWorkspaceActivity(await orgIdOf("acme"));

      expect(
        entries.map(({ action, actorName }) => [action, actorName]),
      ).toEqual([
        ["project.updated", "Léa Martin"],
        ["project.created", "Camille Laurent"],
        // Nobody does a renewal: the sentence has no one to name
        ["subscription.updated", null],
        ["organization.updated", "Camille Laurent"],
        ["member.invited", "Camille Laurent"],
      ]);
      expect(entries[0]?.values).toMatchObject({ name: "Atlas" });
      expect(entries[1]?.values).toMatchObject({ name: "Orbit" });
    });

    it("gives Camille five notifications, two of them unread, that lead to a page of the app", async () => {
      const camille = await userIdOf("camille@example.com");
      const rows = await testDb
        .select()
        .from(notification)
        .where(eq(notification.userId, camille));

      expect(rows).toHaveLength(5);
      expect(rows.filter(({ read }) => !read)).toHaveLength(2);
      expect(await getUnreadCount(camille)).toBe(2);
      for (const { link } of rows) {
        expect(link === null || link.startsWith("/")).toBe(true);
      }
    });

    // A notification is stored as its type and the values its messages name, about
    // the workspace whose pages it opens: the bell says it in the reader's language
    it("gives each notification Acme as its workspace, and words that both languages draw from its values", async () => {
      const camille = await userIdOf("camille@example.com");
      const acme = await orgIdOf("acme");
      const rows = await testDb.select().from(notification).where(eq(notification.userId, camille));

      for (const row of rows) {
        expect(row.organizationId, row.id).toBe(acme);
        expect([row.title, row.body], row.id).toEqual([null, null]);
        for (const [locale, messages] of [["en", en], ["fr", fr]] as const) {
          // A message that is missing, or a value it names that the row lacks, throws
          const t = createTranslator({ locale, messages, onError: (error) => { throw error; } });
          // The key is the type of the row: what the bell reads it by
          const say = t as unknown as (key: string, values: Record<string, string>) => string;
          expect(say(`notifications.events.${row.type}.title`, row.values ?? {}), `${row.id} in ${locale}`).not.toMatch(/[{}]/);
          expect(say(`notifications.events.${row.type}.body`, row.values ?? {}), `${row.id} in ${locale}`).not.toMatch(/[{}]/);
        }
      }
    });

    it("leaves two of the three first steps done: a project and a team, but no API key", async () => {
      const acme = await orgIdOf("acme");

      expect(await countProjects(acme)).toBeGreaterThanOrEqual(1);
      expect(await countMembers(acme)).toBeGreaterThanOrEqual(2);
      expect(await countActiveApiKeys(acme)).toBe(0);
    });
  });

  // "This month" is counted from the first day of the UTC month. A row that
  // the demo dates "this month" by counting back from now ("two days ago")
  // falls in the month before when now is the first, and the figure that the
  // README shows would read zero.
  describe.each([
    ["in the middle of a month", NOW],
    ["on the first of a month", new Date("2026-12-01T09:15:00.000Z")],
    ["the first instant of a month", new Date("2026-12-01T00:00:00.000Z")],
  ])("when now is %s", (_label, now) => {
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const freeCredits = getPlanById("free")!.limits.aiCredits!;

    beforeEach(async () => {
      await seedDemo(testDb, now);
    });

    it("grants 5,000 credits on the first and consumes 4,120 of them since", async () => {
      const acme = await orgIdOf("acme");

      expect(await allocationUsed(acme, now)).toBe(4120);
      expect((await readCredits(acme, periodOf(now))).allocation).toBe(880);

      const ledger = await testDb
        .select()
        .from(aiCreditLedger)
        .where(eq(aiCreditLedger.organizationId, acme));
      expect(ledger.find(({ amount }) => amount === 5000)?.createdAt).toEqual(
        monthStart,
      );
      for (const { createdAt } of ledger) {
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(
          monthStart.getTime(),
        );
        expect(createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
      }
    });

    // Northwind is on the free plan with no subscription: without credits the assistant would answer in Acme and
    // be refused in the workspace the demo opens second
    it("gives Northwind the credits of the free plan for the month, none of them used", async () => {
      const northwind = await orgIdOf("northwind");

      expect((await readCredits(northwind, periodOf(now))).allocation).toBe(freeCredits);
      expect(await allocationUsed(northwind, now)).toBe(0);

      const ledger = await testDb
        .select()
        .from(aiCreditLedger)
        .where(eq(aiCreditLedger.organizationId, northwind));
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ amount: freeCredits, reason: "plan_allocation", referenceId: null, createdAt: monthStart });
    });
  });
});
