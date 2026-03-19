import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Example test: Server action with Zod validation.
 *
 * This demonstrates how to test server actions:
 * 1. Extract the Zod schema from the action
 * 2. Test valid and invalid inputs
 * 3. Verify error messages
 *
 * In a real app, you'd also test the DB interaction using PGlite.
 */

const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "other"]),
  message: z.string().min(1).max(5000),
});

describe("feedback action validation", () => {
  it("accepts valid feedback input", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      message: "Something is broken",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty message", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = feedbackSchema.safeParse({
      type: "invalid",
      message: "Some message",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message exceeding max length", () => {
    const result = feedbackSchema.safeParse({
      type: "feature",
      message: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});
