import { afterEach, describe, expect, it, vi } from "vitest";
import { reportHandledError } from "@/shared/utils/report-error";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reportHandledError", () => {
  it("hands the error to the reporter of the page", () => {
    const report = vi.fn();
    const error = new Error("Failed to fetch");
    vi.stubGlobal("reportError", report);

    reportHandledError(error);

    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(error);
  });

  it("does nothing where there is no reporter: a run in Node has no window", () => {
    vi.stubGlobal("reportError", undefined);

    expect(() => reportHandledError(new Error("Failed to fetch"))).not.toThrow();
  });
});
