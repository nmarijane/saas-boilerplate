import * as Sentry from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";
import { sendAfterResponse } from "@/features/email/send-after-response";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// Next's `after` outside a request is the real one here: it refuses, as it does in a script or a test
describe("sending after the response, outside a request", () => {
  it("waits for the mail: there is no answer to be late for", async () => {
    const sent = vi.fn(async () => {
      await new Promise((done) => setTimeout(done, 20));
    });

    await sendAfterResponse(sent);

    expect(sent).toHaveBeenCalledOnce();
  });

  it("reports a mail that fails and does not throw", async () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendAfterResponse(async () => Promise.reject(new Error("SMTP is down")))).resolves.toBeUndefined();

    expect(report).toHaveBeenCalledOnce();
    // The error reporter hears of it: nothing else would
    expect(Sentry.captureException).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "SMTP is down" }));
    report.mockRestore();
  });
});
