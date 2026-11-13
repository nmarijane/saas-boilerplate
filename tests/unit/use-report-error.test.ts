import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReportError } from "@/shared/hooks/use-report-error";

// A hook does not run outside a component, and an effect does not run in static
// markup: `useEffect` is replaced by a stand-in that keeps what it is given, and
// the test runs the effect itself.
const effects = vi.hoisted(
  () => [] as { run: () => void; deps: readonly unknown[] | undefined }[],
);
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (run: () => void, deps?: readonly unknown[]) => {
    effects.push({ run, deps });
  },
}));
vi.mock("@sentry/nextjs", () => sentry);

beforeEach(() => {
  effects.length = 0;
  sentry.captureException.mockClear();
});

describe("useReportError", () => {
  it("reports nothing while it renders, and the error it is given once its effect runs", () => {
    const error = new Error("boom");

    useReportError(error);

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(effects).toHaveLength(1);
    effects[0].run();
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  // The effect starts again when the boundary is handed another error, and for
  // no other reason: the same error, drawn again, is reported once
  it("depends on the error alone", () => {
    const error = new Error("boom");

    useReportError(error);

    expect(effects[0].deps).toHaveLength(1);
    expect(effects[0].deps?.[0]).toBe(error);
  });

  it.each([["a string"], [42], [undefined], [{ digest: "1234" }]])(
    "reports what was thrown, whatever it is: %j",
    (thrown) => {
      useReportError(thrown);
      effects[0].run();

      expect(sentry.captureException).toHaveBeenCalledWith(thrown);
    },
  );
});
