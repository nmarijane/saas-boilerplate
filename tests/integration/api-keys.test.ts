import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiKeyAction, revokeApiKeyAction } from "@/features/api-keys/actions";
import { hashApiKey } from "@/features/api-keys/helpers";
import { KEY_NAME_MAX } from "@/features/api-keys/limits";
import { getActiveApiKeysForOrg, getApiKeysForOrg } from "@/features/api-keys/queries";
import { requireRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { apiKey } from "@/models/api-key";
import { intl } from "../helpers/admin-pages";
import { madeKey } from "../helpers/api-keys";
import { seedOrg, seedUser } from "../helpers/seed";
import { fakeRoleGrant } from "../helpers/session";
import { testDb } from "../setup";

// The refusal of a past end is told in the words of the dialog, in the language of the request: the translator
// of the server is built from the real message files.
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());

const ORG_ID = "ak-org-1";
const USER_ID = "ak-user-1";

describe("api-key actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(fakeRoleGrant(USER_ID, "admin"));
    await testDb.delete(apiKey);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  describe("createApiKeyAction", () => {
    it("creates a key and returns the raw key", async () => {
      const result = madeKey(await createApiKeyAction(ORG_ID, {
        name: "My API Key",
        scopes: ["read"],
      }));

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("prefix");
      expect(result.key).toMatch(/^sk_live_/);
    });

    it("stored hash matches when hashing the returned key", async () => {
      const result = madeKey(await createApiKeyAction(ORG_ID, {
        name: "Hash Test Key",
        scopes: ["*"],
      }));

      const keys = await getApiKeysForOrg(ORG_ID);
      expect(keys).toHaveLength(1);

      // Fetch the full record to get the hash
      const records = await testDb
        .select()
        .from(apiKey);
      const record = records.find((r) => r.id === result.id);

      expect(record).toBeDefined();
      expect(record!.hash).toBe(hashApiKey(result.key));
    });

    it("emits api_key.created event", async () => {
      await createApiKeyAction(ORG_ID, {
        name: "Event Key",
        scopes: ["*"],
      });

      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
        "api_key.created",
        expect.objectContaining({
          orgId: ORG_ID,
          actorId: USER_ID,
          resourceType: "api_key",
        }),
      );
    });

    it("rejects invalid input (empty name)", async () => {
      await expect(
        createApiKeyAction(ORG_ID, { name: "", scopes: ["*"] }),
      ).rejects.toThrow();
    });

    it("rejects invalid input (name too long)", async () => {
      await expect(
        createApiKeyAction(ORG_ID, { name: "x".repeat(101), scopes: ["*"] }),
      ).rejects.toThrow();
    });

    // The dialog stops its field at `KEY_NAME_MAX`, which the schema reads from the same module: a name of the most
    // the field allows is taken, and the next character is what the server refuses.
    it("takes a name of the most the dialog allows, and refuses one character more", async () => {
      await expect(
        createApiKeyAction(ORG_ID, { name: "x".repeat(KEY_NAME_MAX), scopes: ["*"] }),
      ).resolves.toHaveProperty("key");
      await expect(
        createApiKeyAction(ORG_ID, { name: "x".repeat(KEY_NAME_MAX + 1), scopes: ["*"] }),
      ).rejects.toThrow();
    });
  });

  // A key ends at the start of its day (UTC), and the first day that is taken is tomorrow: a key that ends
  // today, or before, is over before anyone has used it. The dialog says so before it sends anything, and the
  // server says it again: a request does not have to come from the dialog, and the clock of a page is not always
  // the server's (a few minutes before midnight, UTC). It answers `{ error }` and does not throw: Next hides the
  // text of an error that is thrown, in production, and the dialog shows the sentence.
  describe("an end before tomorrow", () => {
    const NOW = new Date("2026-11-04T12:00:00.000Z");
    const SENTENCE = "Choose November 5, 2026 or later.";

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      intl.locale = "en";
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ["the start of today", "2026-11-04T00:00:00.000Z"],
      ["the last moment of today", "2026-11-04T23:59:59.999Z"],
      ["yesterday", "2026-11-03T00:00:00.000Z"],
      ["a year ago", "2025-11-04T00:00:00.000Z"],
      ["the start of the epoch", "1970-01-01T00:00:00.000Z"],
    ])("is refused, with the sentence of the dialog, and nothing is written or told: %s", async (_, expiresAt) => {
      expect(
        await createApiKeyAction(ORG_ID, { name: "Too late", scopes: ["*"], expiresAt: new Date(expiresAt) }),
      ).toEqual({ error: SENTENCE });

      expect(await testDb.select().from(apiKey)).toHaveLength(0);
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });

    it("answers the refusal, and does not throw it: Next hides the text of an error that is thrown", async () => {
      await expect(
        createApiKeyAction(ORG_ID, { name: "Too late", scopes: ["*"], expiresAt: new Date("2026-11-04T00:00:00.000Z") }),
      ).resolves.toEqual({ error: SENTENCE });
    });

    it("tells it in the language of the request: a request in French is answered in French", async () => {
      intl.locale = "fr";

      expect(
        await createApiKeyAction(ORG_ID, { name: "Trop tard", scopes: ["*"], expiresAt: new Date("2026-11-04T00:00:00.000Z") }),
      ).toEqual({ error: "Choisissez le 5 novembre 2026 ou une date ultérieure." });
    });

    it("names the first day by the clock of the server, which is the clock of UTC", async () => {
      vi.setSystemTime(new Date("2027-01-31T23:59:59.999Z"));

      expect(
        await createApiKeyAction(ORG_ID, { name: "Too late", scopes: ["*"], expiresAt: new Date("2027-01-31T00:00:00.000Z") }),
      ).toEqual({ error: "Choose February 1, 2027 or later." });
    });

    it.each([
      ["the start of tomorrow", "2026-11-05T00:00:00.000Z"],
      ["a day further", "2026-11-06T00:00:00.000Z"],
      ["a year from now", "2027-11-04T00:00:00.000Z"],
    ])("takes %s, and writes the end as it was sent", async (_, expiresAt) => {
      const { id } = madeKey(await createApiKeyAction(ORG_ID, { name: "In time", scopes: ["*"], expiresAt: new Date(expiresAt) }));

      const [row] = await testDb.select().from(apiKey).where(eq(apiKey.id, id));
      expect(row?.expiresAt?.toISOString()).toBe(expiresAt);
    });

    it("takes no end at all: a key that never ends is a key", async () => {
      const { id } = madeKey(await createApiKeyAction(ORG_ID, { name: "For ever", scopes: ["*"] }));

      const [row] = await testDb.select().from(apiKey).where(eq(apiKey.id, id));
      expect(row?.expiresAt).toBeNull();
    });

    it("moves to the next day exactly when UTC does: the end that was good a moment before is today", async () => {
      vi.setSystemTime(new Date("2026-11-04T23:59:59.999Z"));
      await expect(
        createApiKeyAction(ORG_ID, { name: "A", scopes: ["*"], expiresAt: new Date("2026-11-05T00:00:00.000Z") }),
      ).resolves.toHaveProperty("key");

      vi.setSystemTime(new Date("2026-11-05T00:00:00.000Z"));
      expect(
        await createApiKeyAction(ORG_ID, { name: "B", scopes: ["*"], expiresAt: new Date("2026-11-05T00:00:00.000Z") }),
      ).toEqual({ error: "Choose November 6, 2026 or later." });
    });

    // It answers before anything is checked against the database: the guard comes first, as it does for every action
    it("refuses a caller that is not an admin before it says anything about the end", async () => {
      vi.mocked(requireRole).mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

      await expect(
        createApiKeyAction(ORG_ID, { name: "x", scopes: ["*"], expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
      ).rejects.toThrow("NEXT_REDIRECT");
    });
  });

  describe("revokeApiKeyAction", () => {
    it("sets revokedAt on the key", async () => {
      const result = madeKey(await createApiKeyAction(ORG_ID, {
        name: "Revoke Me",
        scopes: ["*"],
      }));
      vi.clearAllMocks();

      await revokeApiKeyAction(result.id, ORG_ID);

      const keys = await getApiKeysForOrg(ORG_ID);
      expect(keys).toHaveLength(1);
      expect(keys[0].revokedAt).not.toBeNull();
    });

    it("emits api_key.revoked event", async () => {
      const result = madeKey(await createApiKeyAction(ORG_ID, {
        name: "Revoke Event",
        scopes: ["*"],
      }));
      vi.clearAllMocks();

      await revokeApiKeyAction(result.id, ORG_ID);

      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
        "api_key.revoked",
        expect.objectContaining({
          orgId: ORG_ID,
          actorId: USER_ID,
          resourceType: "api_key",
          resourceId: result.id,
        }),
      );
    });
  });
});

describe("api-key queries", () => {
  beforeEach(async () => {
    vi.mocked(requireRole).mockResolvedValue(fakeRoleGrant(USER_ID, "admin"));
    await testDb.delete(apiKey);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  it("getApiKeysForOrg returns keys for an org", async () => {
    await createApiKeyAction(ORG_ID, { name: "Key 1", scopes: ["*"] });
    await createApiKeyAction(ORG_ID, { name: "Key 2", scopes: ["*"] });

    const keys = await getApiKeysForOrg(ORG_ID);
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.name)).toEqual(
      expect.arrayContaining(["Key 1", "Key 2"]),
    );
  });

  it("getActiveApiKeysForOrg excludes revoked keys", async () => {
    const key1 = madeKey(await createApiKeyAction(ORG_ID, { name: "Active", scopes: ["*"] }));
    const key2 = madeKey(await createApiKeyAction(ORG_ID, { name: "Revoked", scopes: ["*"] }));

    await revokeApiKeyAction(key2.id, ORG_ID);

    const activeKeys = await getActiveApiKeysForOrg(ORG_ID);
    expect(activeKeys).toHaveLength(1);
    expect(activeKeys[0].id).toBe(key1.id);
  });

  it("getActiveApiKeysForOrg excludes expired keys, and keeps those that expire later or never", async () => {
    const day = 24 * 60 * 60 * 1000;
    const never = madeKey(await createApiKeyAction(ORG_ID, { name: "Never", scopes: ["*"] }));
    const later = madeKey(await createApiKeyAction(ORG_ID, { name: "Later", scopes: ["*"], expiresAt: new Date(Date.now() + 2 * day) }));
    // The action no longer makes a key that is over before it begins: this one is a key whose end has come since
    await testDb.insert(apiKey).values({
      id: "expired-key",
      orgId: ORG_ID,
      createdBy: USER_ID,
      name: "Expired",
      prefix: "sk_live_Zk3V",
      hash: "expired-hash",
      scopes: ["*"],
      expiresAt: new Date(Date.now() - day),
    });

    const activeKeys = await getActiveApiKeysForOrg(ORG_ID);
    expect(activeKeys.map((k) => k.id).sort()).toEqual([never.id, later.id].sort());
  });
});
