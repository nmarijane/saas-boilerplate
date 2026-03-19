import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiKeyAction, revokeApiKeyAction } from "@/features/api-keys/actions";
import { hashApiKey } from "@/features/api-keys/helpers";
import { getActiveApiKeysForOrg, getApiKeysForOrg } from "@/features/api-keys/queries";
import { emitEvent } from "@/features/events/emitter";
import { apiKey } from "@/models/api-key";
import { seedOrg, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const ORG_ID = "ak-org-1";
const USER_ID = "ak-user-1";

describe("api-key actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(apiKey);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  describe("createApiKeyAction", () => {
    it("creates a key and returns the raw key", async () => {
      const result = await createApiKeyAction(ORG_ID, USER_ID, {
        name: "My API Key",
        scopes: ["read"],
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("prefix");
      expect(result.key).toMatch(/^sk_live_/);
    });

    it("stored hash matches when hashing the returned key", async () => {
      const result = await createApiKeyAction(ORG_ID, USER_ID, {
        name: "Hash Test Key",
        scopes: ["*"],
      });

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
      await createApiKeyAction(ORG_ID, USER_ID, {
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
        createApiKeyAction(ORG_ID, USER_ID, { name: "", scopes: ["*"] }),
      ).rejects.toThrow();
    });

    it("rejects invalid input (name too long)", async () => {
      await expect(
        createApiKeyAction(ORG_ID, USER_ID, { name: "x".repeat(101), scopes: ["*"] }),
      ).rejects.toThrow();
    });
  });

  describe("revokeApiKeyAction", () => {
    it("sets revokedAt on the key", async () => {
      const result = await createApiKeyAction(ORG_ID, USER_ID, {
        name: "Revoke Me",
        scopes: ["*"],
      });
      vi.clearAllMocks();

      await revokeApiKeyAction(result.id, ORG_ID, USER_ID);

      const keys = await getApiKeysForOrg(ORG_ID);
      expect(keys).toHaveLength(1);
      expect(keys[0].revokedAt).not.toBeNull();
    });

    it("emits api_key.revoked event", async () => {
      const result = await createApiKeyAction(ORG_ID, USER_ID, {
        name: "Revoke Event",
        scopes: ["*"],
      });
      vi.clearAllMocks();

      await revokeApiKeyAction(result.id, ORG_ID, USER_ID);

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
    await testDb.delete(apiKey);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  it("getApiKeysForOrg returns keys for an org", async () => {
    await createApiKeyAction(ORG_ID, USER_ID, { name: "Key 1", scopes: ["*"] });
    await createApiKeyAction(ORG_ID, USER_ID, { name: "Key 2", scopes: ["*"] });

    const keys = await getApiKeysForOrg(ORG_ID);
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.name)).toEqual(
      expect.arrayContaining(["Key 1", "Key 2"]),
    );
  });

  it("getActiveApiKeysForOrg excludes revoked keys", async () => {
    const key1 = await createApiKeyAction(ORG_ID, USER_ID, { name: "Active", scopes: ["*"] });
    const key2 = await createApiKeyAction(ORG_ID, USER_ID, { name: "Revoked", scopes: ["*"] });

    await revokeApiKeyAction(key2.id, ORG_ID, USER_ID);

    const activeKeys = await getActiveApiKeysForOrg(ORG_ID);
    expect(activeKeys).toHaveLength(1);
    expect(activeKeys[0].id).toBe(key1.id);
  });
});
