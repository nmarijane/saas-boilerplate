import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlag,
  updateFeatureFlag,
} from "@/features/feature-flags/actions";
import {
  invalidateFlagCache,
  isFeatureEnabled,
} from "@/features/feature-flags/helpers";
import { getAllFeatureFlags } from "@/features/feature-flags/queries";
import { featureFlag } from "@/models/feature-flag";
import { testDb } from "../setup";

async function insertFlag(
  key: string,
  enabled: boolean,
  rules: Array<{ type: "plan" | "org"; value: string }> = [],
) {
  const id = `flag-${key}`;
  await testDb.insert(featureFlag).values({
    id,
    key,
    description: `Test flag ${key}`,
    enabled,
    rules,
  });
  return id;
}

describe("feature-flags helpers", () => {
  beforeEach(async () => {
    await testDb.delete(featureFlag);
    invalidateFlagCache();
  });

  it("returns false for non-existent flag", async () => {
    const result = await isFeatureEnabled("does-not-exist");
    expect(result).toBe(false);
  });

  it("returns false for disabled flag", async () => {
    await insertFlag("disabled-flag", false);
    const result = await isFeatureEnabled("disabled-flag");
    expect(result).toBe(false);
  });

  it("returns true for enabled flag with no rules", async () => {
    await insertFlag("enabled-no-rules", true);
    const result = await isFeatureEnabled("enabled-no-rules");
    expect(result).toBe(true);
  });

  it("returns true when plan rule matches", async () => {
    await insertFlag("plan-gated", true, [{ type: "plan", value: "pro" }]);
    const result = await isFeatureEnabled("plan-gated", { planId: "pro" });
    expect(result).toBe(true);
  });

  it("returns false when plan rule does not match", async () => {
    await insertFlag("plan-gated-2", true, [{ type: "plan", value: "pro" }]);
    const result = await isFeatureEnabled("plan-gated-2", { planId: "free" });
    expect(result).toBe(false);
  });

  it("returns true when org rule matches", async () => {
    await insertFlag("org-gated", true, [
      { type: "org", value: "org-special" },
    ]);
    const result = await isFeatureEnabled("org-gated", {
      orgId: "org-special",
    });
    expect(result).toBe(true);
  });

  it("cache works - same result without re-querying DB", async () => {
    await insertFlag("cached-flag", true);

    const first = await isFeatureEnabled("cached-flag");
    expect(first).toBe(true);

    // Delete the flag from the DB directly — cache should still return true
    await testDb
      .delete(featureFlag)
      .where(eq(featureFlag.key, "cached-flag"));

    const second = await isFeatureEnabled("cached-flag");
    expect(second).toBe(true);
  });

  it("invalidateFlagCache clears cache and forces re-query", async () => {
    await insertFlag("cache-clear-flag", true);

    const first = await isFeatureEnabled("cache-clear-flag");
    expect(first).toBe(true);

    // Delete from DB and invalidate cache
    await testDb
      .delete(featureFlag)
      .where(eq(featureFlag.key, "cache-clear-flag"));
    invalidateFlagCache("cache-clear-flag");

    const second = await isFeatureEnabled("cache-clear-flag");
    expect(second).toBe(false);
  });
});

describe("feature-flags actions", () => {
  beforeEach(async () => {
    await testDb.delete(featureFlag);
    invalidateFlagCache();
  });

  it("createFeatureFlag creates a flag in DB", async () => {
    await createFeatureFlag({
      key: "new-flag",
      description: "A new flag",
      enabled: true,
      rules: [],
    });

    const flags = await testDb
      .select()
      .from(featureFlag)
      .where(eq(featureFlag.key, "new-flag"));
    expect(flags).toHaveLength(1);
    expect(flags[0].key).toBe("new-flag");
    expect(flags[0].enabled).toBe(true);
  });

  it("updateFeatureFlag updates a flag", async () => {
    const flagId = await insertFlag("update-me", false);

    await updateFeatureFlag(flagId, {
      description: "Updated description",
      enabled: true,
    });

    const updated = await testDb.query.featureFlag.findFirst({
      where: eq(featureFlag.id, flagId),
    });
    expect(updated?.enabled).toBe(true);
    expect(updated?.description).toBe("Updated description");
  });

  it("toggleFeatureFlag toggles enabled state", async () => {
    const flagId = await insertFlag("toggle-me", false);

    await toggleFeatureFlag(flagId, true);

    const toggled = await testDb.query.featureFlag.findFirst({
      where: eq(featureFlag.id, flagId),
    });
    expect(toggled?.enabled).toBe(true);
  });

  it("deleteFeatureFlag removes a flag", async () => {
    const flagId = await insertFlag("delete-me", true);

    await deleteFeatureFlag(flagId);

    const remaining = await testDb
      .select()
      .from(featureFlag)
      .where(eq(featureFlag.id, flagId));
    expect(remaining).toHaveLength(0);
  });

  it("createFeatureFlag validates key format (regex)", async () => {
    await expect(
      createFeatureFlag({
        key: "INVALID KEY!",
        description: "",
        enabled: false,
        rules: [],
      }),
    ).rejects.toThrow();
  });
});

describe("feature-flags queries", () => {
  beforeEach(async () => {
    await testDb.delete(featureFlag);
    invalidateFlagCache();
  });

  it("getAllFeatureFlags returns all flags ordered by key", async () => {
    await insertFlag("beta-feature", true);
    await insertFlag("alpha-feature", false);
    await insertFlag("gamma-feature", true);

    const flags = await getAllFeatureFlags();
    expect(flags).toHaveLength(3);
    expect(flags[0].key).toBe("alpha-feature");
    expect(flags[1].key).toBe("beta-feature");
    expect(flags[2].key).toBe("gamma-feature");
  });
});
