import type { MockLanguageModelV3 as Model } from "ai/test";
import { AsyncLocalStorage } from "node:async_hooks";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/chat/route";
import { removeMember, transferOwnership } from "@/features/auth/organization/actions";
import { deleteAccount } from "@/features/settings/actions";
import { aiCreditLedger, organization, organizationMember, user } from "@/models";
import { describeOnPostgres } from "../helpers/postgres";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * What only two connections can show: a row lock that makes one transaction wait for another. PGlite has one
 * connection, so these tests run over a real PostgreSQL only (`npm run test:postgres`) and are skipped elsewhere.
 * The guards and the actions are the real ones: only the session lookup, the model and the rate limit are replaced.
 *
 * Each case makes sure the two calls really overlap, and does not hope they do: a third connection holds a lock on
 * a row both of them need, the calls are started and wait for it (pg_stat_activity says so), and the lock is then
 * released. Whichever goes first, the invariants below must hold.
 */

// Who is calling: each call runs in its own context, so that two people can be signed in at the same time
const caller = new AsyncLocalStorage<string>();
const { getSession, model, afterWork } = vi.hoisted(() => ({
  getSession: vi.fn(),
  model: { current: null as Model | null },
  afterWork: [] as Promise<unknown>[],
}));

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/shared/lib/rate-limit/action", () => ({ enforceActionRateLimit: vi.fn(), getClientIp: vi.fn() }));
vi.mock("@/features/ai/config/providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/ai/config/providers")>()),
  getProvider: () => () => model.current,
}));
vi.mock("next-intl/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl/server")>()),
  getLocale: async () => "en",
}));
// A database across a network answers in a few milliseconds: the read of the balance inside the debit's transaction
// takes a moment, so that debits which are not ordered by a lock all read the balance before any has written
vi.mock("@/features/ai/queries", async (importOriginal) => {
  const queries = await importOriginal<typeof import("@/features/ai/queries")>();
  return {
    ...queries,
    getCreditBalance: async (...args: Parameters<typeof queries.getCreditBalance>) => {
      const balance = await queries.getCreditBalance(...args);
      if (args[1] !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return balance;
    },
  };
});
// The route hands what it does after its answer to `after`: here it is kept, and the test waits on it
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: Promise<unknown> | (() => unknown)) => {
    afterWork.push(Promise.resolve(typeof task === "function" ? task() : task));
  },
}));

const ORG = "pg-org";
const OWNER = "pg-owner";
const ADMIN = "pg-admin";
const MEMBER = "pg-member";
const memberId = (userId: string) => `member-${userId}-${ORG}`;

/** Runs `call` as `userId`: the session lookup of its guards names that person. */
function asUser<T>(userId: string, call: () => Promise<T>): Promise<T> {
  return caller.run(userId, call);
}

const connections: Client[] = [];

async function connect() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  connections.push(client);

  return client;
}

/**
 * Holds `lock` (a `select ... for update` that names the rows) in a transaction of its own, starts the calls, waits
 * until `waiting` of them are blocked on a lock (pg_stat_activity), and lets them go. Resolves to what they answered.
 */
async function racing<T extends unknown[]>(lock: string, waiting: number, ...calls: { [K in keyof T]: () => Promise<T[K]> }): Promise<T> {
  const holder = await connect();
  await holder.query("begin");
  await holder.query(lock);
  const answers = Promise.all(calls.map((call) => call())) as Promise<T>;

  try {
    await vi.waitFor(async () => {
      const { rows } = await testDb.execute<{ blocked: string }>(sql`
        select count(*) as blocked from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()
      `);
      expect(Number(rows[0]?.blocked)).toBeGreaterThanOrEqual(waiting);
    }, { timeout: 10_000, interval: 25 });
  } finally {
    await holder.query("commit");
    await holder.end();
    connections.splice(connections.indexOf(holder), 1);
  }

  return answers;
}

const owners = async () => (await testDb.select().from(organizationMember).where(eq(organizationMember.organizationId, ORG))).filter(({ role }) => role === "owner").map(({ userId }) => userId);
const memberRows = async (userId: string) => (await testDb.select().from(organizationMember).where(eq(organizationMember.id, memberId(userId)))).length;

beforeEach(async () => {
  vi.clearAllMocks();
  afterWork.length = 0;
  getSession.mockImplementation(async () => {
    const userId = caller.getStore();
    return userId ? fakeSession(userId, { activeOrganizationId: ORG }) : null;
  });
  for (const connection of connections.splice(0)) {
    await connection.end().catch(() => undefined);
  }

  await testDb.delete(aiCreditLedger);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  for (const id of [OWNER, ADMIN, MEMBER]) {
    await seedUser(id);
  }
  await seedOrg(ORG);
  await seedOrgMember(OWNER, ORG, "owner");
  await seedOrgMember(ADMIN, ORG, "admin");
  await seedOrgMember(MEMBER, ORG, "member");
});

describeOnPostgres("the AI credits", () => {
  /** A model that answers, having read 1,200 tokens and written 600: 2 + 2 credits on gpt-4o-mini. */
  function replying() {
    return new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            { type: "text-start" as const, id: "reply" },
            { type: "text-delta" as const, id: "reply", delta: "Here is a draft." },
            { type: "text-end" as const, id: "reply" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: "stop" },
              usage: {
                inputTokens: { total: 1200, noCache: 1200, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 600, text: 600, reasoning: undefined },
              },
            },
          ],
        }),
      }),
    });
  }

  const balance = async () => {
    const [row] = await testDb.select({ total: sql<number>`coalesce(sum(${aiCreditLedger.amount}), 0)`.mapWith(Number) }).from(aiCreditLedger).where(eq(aiCreditLedger.organizationId, ORG));

    return row?.total ?? 0;
  };

  /** One message, sent by `userId`, read to its end: the answer is saved and debited once the stream has been read. */
  async function ask(userId: string, text: string) {
    const response = await asUser(userId, () => POST(new Request("http://localhost:3088/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: text }], model: "gpt-4o-mini" }),
    })));
    await response.text();
  }

  // Each of these answers costs 4 credits. Every one is accepted (the balance was above zero when it came in),
  // and every one finishes while the others are debited: the row of the workspace is what makes them wait in turn
  it.each([
    ["one credit", 1],
    ["three credits", 3],
    ["six credits, for answers of four", 6],
  ])("never takes the balance below zero when four answers finish together on %s", async (_, credits) => {
    model.current = replying();
    await testDb.insert(aiCreditLedger).values({ id: "allocation", organizationId: ORG, amount: credits, reason: "plan_allocation" });

    // Their transactions begin together, and wait on the row of the workspace, which the third connection holds
    // until the four answers are in the debit: the lock under test is then the only thing that orders them
    await racing(
      `select id from organization where id = '${ORG}' for update`,
      4,
      () => Promise.all([OWNER, ADMIN, MEMBER, OWNER].map((who, index) => ask(who, `Draft email ${index}`))),
    );
    await Promise.all(afterWork);

    const rows = await testDb.select({ amount: aiCreditLedger.amount }).from(aiCreditLedger).where(eq(aiCreditLedger.organizationId, ORG));
    expect(await balance()).toBe(0);
    expect(rows.filter(({ amount }) => amount < 0).reduce((total, { amount }) => total - amount, 0)).toBe(credits);
    // No debit alone takes more than was there
    expect(rows.every(({ amount }) => amount >= -credits)).toBe(true);
  });
});

describeOnPostgres("handing a workspace over", () => {
  // The owner hands the workspace to MEMBER while ADMIN removes MEMBER. Both wait on MEMBER's row, so that they meet:
  // either the hand-over comes first (MEMBER is the owner, and the removal is refused) or the removal does
  // (MEMBER is gone, and the hand-over is refused). Never two owners, never none.
  it.each([1, 2, 3, 4, 5])("leaves one owner when an admin removes the member it is handed to (run %i)", async () => {
    const [handedOver, removed] = await racing(
      `select id from organization_member where id = '${memberId(MEMBER)}' for update`,
      2,
      () => asUser(OWNER, () => transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) })),
      () => asUser(ADMIN, () => removeMember({ orgId: ORG, memberIdToRemove: memberId(MEMBER) })),
    );

    expect(await owners()).toHaveLength(1);
    // One of the two won, and the other was refused
    expect(handedOver.success).not.toBe(removed.success);
    if (handedOver.success) {
      expect(await owners()).toEqual([MEMBER]);
      expect(await memberRows(MEMBER)).toBe(1);
    } else {
      expect(await owners()).toEqual([OWNER]);
      expect(await memberRows(MEMBER)).toBe(0);
    }
  });

  // The receiver deletes their account while the owner hands the workspace to them. The account has no workspace of
  // its own, so nothing stops its deletion but the check, under lock, that it is not about to own one: either the
  // deletion comes first (the person is gone, and the hand-over is refused) or the hand-over does (the person is
  // the owner now, and the deletion is refused).
  it.each([1, 2, 3, 4, 5])("leaves one owner, or refuses, when the receiver deletes their account (run %i)", async () => {
    const [handedOver, deletion] = await racing(
      `select id from organization_member where id = '${memberId(MEMBER)}' for update`,
      2,
      () => asUser(OWNER, () => transferOwnership({ orgId: ORG, memberId: memberId(MEMBER) })),
      () => asUser(MEMBER, () => deleteAccount()),
    );

    expect(await owners()).toHaveLength(1);
    const deleted = deletion.success && deletion.data.deleted;
    const personExists = (await testDb.select().from(user).where(eq(user.id, MEMBER))).length === 1;
    expect(personExists).toBe(!deleted);
    expect(handedOver.success).toBe(!deleted);
    expect(await owners()).toEqual(deleted ? [OWNER] : [MEMBER]);
  });
});
