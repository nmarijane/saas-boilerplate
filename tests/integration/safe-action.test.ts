import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { safeAction } from "@/shared/lib/safe-action";
import { NOT_FOUND, outcomeOf, SESSION_GONE } from "../helpers/next-errors";

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

// `redirect()` throws an error that Next catches higher up, to send the person elsewhere: an action that answered
// `{ success: false }` for it would turn "go to the sign-in page" into a message in a form.
describe("safeAction and a redirect", () => {
  it("hands it on, and answers nothing", async () => {
    expect(
      await outcomeOf(
        safeAction(async () => {
          throw SESSION_GONE;
        }),
      ),
    ).toBe(SESSION_GONE);
  });

  it("hands it on from the middle of the action, whatever it did before", async () => {
    const before = vi.fn();

    expect(
      await outcomeOf(
        safeAction(async () => {
          before();
          throw SESSION_GONE;
        }, "Custom error"),
      ),
    ).toBe(SESSION_GONE);
    expect(before).toHaveBeenCalledOnce();
  });

  it("hands on the redirect that another error holds as its cause", async () => {
    expect(
      await outcomeOf(
        safeAction(async () => {
          throw new Error("the guard failed", { cause: SESSION_GONE });
        }),
      ),
    ).toBe(SESSION_GONE);
  });
});

// `notFound()` is not handed on. An action is called from a click, and Next gives its rejection to the caller, which
// no boundary reads: the page of a not found is drawn only for a rejection that a render throws (a form, a
// transition), and a click that hands it on shows nothing at all (measured on Next 16.4.3, in development and in a
// production build). So the person is told it did not work, as for any refusal.
describe("safeAction and a not found", () => {
  it("answers a refusal, as for any other failure", async () => {
    expect(
      await safeAction(async () => {
        throw NOT_FOUND;
      }),
    ).toEqual({ success: false, error: "An unexpected error occurred" });
  });

  it("answers the message the action gave", async () => {
    expect(
      await safeAction(async () => {
        throw NOT_FOUND;
      }, "Custom error"),
    ).toEqual({ success: false, error: "Custom error" });
  });

  it("answers a refusal for a not found that another error holds as its cause", async () => {
    expect(
      await safeAction(async () => {
        throw new Error("the project could not be read", { cause: NOT_FOUND });
      }, "Custom error"),
    ).toEqual({ success: false, error: "Custom error" });
  });

  it("answers a refusal for a not found from the middle of the action, whatever it did before", async () => {
    const before = vi.fn();

    expect(
      await safeAction(async () => {
        before();
        throw NOT_FOUND;
      }),
    ).toEqual({ success: false, error: "An unexpected error occurred" });
    expect(before).toHaveBeenCalledOnce();
  });

  // The error is told by the text Next gives it: if an upgrade of Next changes where that text is, this fails here,
  // and not in a click that shows nothing.
  it("is an error that carries its kind as a text, which is how it is told from a failure", () => {
    expect(typeof (NOT_FOUND as { digest?: unknown }).digest).toBe("string");
    expect((NOT_FOUND as { digest: string }).digest).not.toBe((SESSION_GONE as { digest: string }).digest);
  });
});
