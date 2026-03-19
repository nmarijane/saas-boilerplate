import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/shared/lib/rate-limit/memory";

describe("memoryRateLimiter", () => {
  let limiter: MemoryRateLimiter;

  beforeEach(() => {
    limiter = new MemoryRateLimiter();
  });

  // Use unique keys per test to avoid cross-contamination from the module-level store

  it("allows requests within limit", async () => {
    const result = await limiter.check("allow-test-ip", 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding limit", async () => {
    const key = "block-test-ip";
    for (let i = 0; i < 5; i++) {
      await limiter.check(key, 5, 60);
    }
    const result = await limiter.check(key, 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", async () => {
    const keyA = "indep-ip-a";
    const keyB = "indep-ip-b";
    for (let i = 0; i < 5; i++) {
      await limiter.check(keyA, 5, 60);
    }
    const result = await limiter.check(keyB, 5, 60);
    expect(result.allowed).toBe(true);
  });

  it("returns resetAt in the future", async () => {
    const result = await limiter.check("reset-test-ip", 5, 60);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("decrements remaining correctly", async () => {
    const key = "decrement-test-ip";
    const r1 = await limiter.check(key, 3, 60);
    expect(r1.remaining).toBe(2);
    const r2 = await limiter.check(key, 3, 60);
    expect(r2.remaining).toBe(1);
    const r3 = await limiter.check(key, 3, 60);
    expect(r3.remaining).toBe(0);
  });
});
