import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/features/api-keys/helpers";

describe("api key helpers", () => {
  describe("generateApiKey", () => {
    it("generates a live key with sk_live_ prefix", () => {
      const { key, prefix, hash } = generateApiKey();
      expect(key).toMatch(/^sk_live_/);
      expect(prefix).toMatch(/^sk_live_/);
      expect(prefix).toHaveLength(12); // "sk_live_" (8) + 4 chars
      expect(hash).toHaveLength(64); // SHA-256 hex
    });

    it("generates a test key with sk_test_ prefix", () => {
      const { key } = generateApiKey(true);
      expect(key).toMatch(/^sk_test_/);
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
