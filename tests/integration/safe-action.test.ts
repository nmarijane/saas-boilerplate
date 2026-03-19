import { describe, expect, it } from "vitest";
import { z } from "zod";
import { safeAction } from "@/shared/lib/safe-action";

describe("safeAction", () => {
  it("returns success with data on success", async () => {
    const result = await safeAction(async () => ({ id: "123" }));
    expect(result).toEqual({ success: true, data: { id: "123" } });
  });

  it("returns generic error on unexpected failure", async () => {
    const result = await safeAction(async () => {
      throw new Error("DB connection failed");
    });
    expect(result).toEqual({ success: false, error: "An unexpected error occurred" });
  });

  it("returns custom error message when provided", async () => {
    const result = await safeAction(
      async () => { throw new Error("fail"); },
      "Custom error",
    );
    expect(result).toEqual({ success: false, error: "Custom error" });
  });

  it("returns validation errors on ZodError", async () => {
    const schema = z.object({ name: z.string().min(1), email: z.string().email() });
    const result = await safeAction(async () => {
      schema.parse({ name: "", email: "not-email" });
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Validation failed");
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.name).toBeDefined();
      expect(result.validationErrors!.email).toBeDefined();
    }
  });
});
