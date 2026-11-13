import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/features/api-keys/helpers";
import { SECRET_PREFIXES } from "@/shared/config/app";

describe("api key helpers", () => {
  describe("generateApiKey", () => {
    it("generates a live key with the app's own prefix, not Stripe's", () => {
      const { key, prefix, hash } = generateApiKey();
      expect(key).toMatch(/^sb_live_/);
      expect(key).not.toMatch(/^sk_/);
      expect(prefix).toMatch(/^sb_live_/);
      expect(prefix).toHaveLength(12); // "sb_live_" (8) + 4 chars
      expect(hash).toHaveLength(64); // SHA-256 hex
    });

    it("generates a test key with the app's own test prefix", () => {
      const { key } = generateApiKey(true);
      expect(key).toMatch(/^sb_test_/);
    });

    it("takes the prefixes from the one place that sets them", () => {
      expect(generateApiKey().key.startsWith(SECRET_PREFIXES.apiKeyLive)).toBe(true);
      expect(generateApiKey(true).key.startsWith(SECRET_PREFIXES.apiKeyTest)).toBe(true);
    });

    it("generates unique keys", () => {
      const keys = new Set(
        Array.from({ length: 50 }, () => generateApiKey().key),
      );
      expect(keys.size).toBe(50);
    });

    it("hash matches the key", () => {
      const { key, hash } = generateApiKey();
      expect(hashApiKey(key)).toBe(hash);
    });
  });

  describe("hashApiKey", () => {
    // A key is checked by the hash of the whole string, whatever it begins with: the keys issued
    // under the old prefix (`sk_live_`) still verify, and no code reads the prefix to decide
    it("checks a key of the old prefix as it always did", () => {
      const issued = "sk_live_Zk3V-EXAMPLE-0000-0000-0000";
      expect(hashApiKey(issued)).toMatch(/^[0-9a-f]{64}$/);
      expect(hashApiKey(issued)).toBe(createHash("sha256").update(issued).digest("hex"));
      expect(hashApiKey(issued)).not.toBe(hashApiKey(issued.replace("sk_live_", "sb_live_")));
    });

    it("returns consistent hashes", () => {
      expect(hashApiKey("test-key")).toBe(hashApiKey("test-key"));
    });

    it("returns different hashes for different keys", () => {
      expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
    });

    it("returns a 64-char hex string", () => {
      expect(hashApiKey("anything")).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
