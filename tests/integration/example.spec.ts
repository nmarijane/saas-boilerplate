import { describe, expect, it } from "vitest";

describe("example integration test", () => {
  it("should pass a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle async operations", async () => {
    const result = await Promise.resolve("hello");
    expect(result).toBe("hello");
  });
});
