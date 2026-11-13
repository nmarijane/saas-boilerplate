import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/notifications/route";
import { notification } from "@/models/notification";
import { seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * The window of the list that /api/notifications serves is the client's word: it is
 * clamped, so that `?limit=1000000000` does not read the whole table.
 */

vi.mock("@/features/auth/api-auth", () => ({
  requireApiAuth: async () => ({ authenticated: true, session: { user: { id: "test-user-1" } } }),
}));

const PERSON = "test-user-1";

beforeEach(async () => {
  await testDb.delete(notification);
  await seedUser(PERSON);
  await testDb.insert(notification).values(
    Array.from({ length: 130 }, (_, index) => ({
      id: `n-${index}`,
      userId: PERSON,
      title: `Notification ${index}`,
      body: "body",
      type: "info" as const,
      read: false,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
    })),
  );
});

async function read(query: string) {
  const answer = await GET(new Request(`http://localhost/api/notifications${query}`));
  expect(answer.status).toBe(200);

  return ((await answer.json()) as { notifications: { id: string }[] }).notifications;
}

describe("reading the notifications over HTTP", () => {
  it("serves 20 when no limit is asked", async () => {
    expect(await read("")).toHaveLength(20);
  });

  it("serves what is asked, up to 100", async () => {
    expect(await read("?limit=7")).toHaveLength(7);
    expect(await read("?limit=100")).toHaveLength(100);
  });

  it("serves 100 at most, however much is asked", async () => {
    expect(await read("?limit=101")).toHaveLength(100);
    expect(await read("?limit=1000000000")).toHaveLength(100);
  });

  it.each(["-5", "abc", "NaN", "Infinity", "1e999", ""])("serves a usable window for the limit %j", async (limit) => {
    const served = await read(`?limit=${limit}`);

    expect(served.length).toBeGreaterThanOrEqual(1);
    expect(served.length).toBeLessThanOrEqual(100);
  });

  it("starts where it is asked to, and never before the first", async () => {
    const first = await read("?limit=1");
    const third = await read("?limit=1&offset=2");

    expect(third[0]?.id).not.toBe(first[0]?.id);
    expect((await read("?limit=1&offset=-9"))[0]?.id).toBe(first[0]?.id);
    expect(await read("?offset=999999999999")).toEqual([]);
  });
});
