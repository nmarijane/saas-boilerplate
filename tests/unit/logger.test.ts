import { afterEach, describe, expect, it, vi } from "vitest";

type Logtape = typeof import("@logtape/logtape");

let loaded: Logtape | undefined;

/** logger.ts and LogTape as a fresh server process evaluates them. */
async function load() {
  vi.resetModules();
  loaded = await import("@logtape/logtape");
  const logger = await import("@/shared/lib/logger");
  return { logtape: loaded, ...logger };
}

afterEach(async () => {
  await loaded?.reset();
  loaded = undefined;
  Reflect.deleteProperty(globalThis, "appLoggerReady");
  vi.doUnmock("@logtape/logtape");
  vi.restoreAllMocks();
});

/** Everything a console method was called with, as one string. */
function printed(method: ReturnType<typeof vi.spyOn>) {
  return method.mock.calls.flat().join(" ");
}

describe("setupLogger", () => {
  it("prints the app loggers at debug level outside production", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const { setupLogger, getAppLogger } = await load();

    await setupLogger();
    getAppLogger("email").info`verification link ${"http://localhost/verify"}`;
    getAppLogger("email").debug("a debug line");

    expect(printed(info)).toContain("verification link");
    expect(printed(info)).toContain("http://localhost/verify");
    expect(printed(debug)).toContain("a debug line");
  });

  it("does not print LogTape's own configuration notice", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { setupLogger } = await load();

    await setupLogger();

    expect(info).not.toHaveBeenCalled();
  });

  it("is ready once any call to it has resolved, even when another call started it", async () => {
    const { logtape, setupLogger } = await load();

    const first = setupLogger();
    await setupLogger();

    expect(logtape.getConfig()).not.toBeNull();
    await first;
  });

  it("can be called again when logger.ts is evaluated twice over one LogTape", async () => {
    // Two bundles of the app, or a hot reload, evaluate logger.ts again while LogTape keeps its configuration.
    const { logtape, setupLogger } = await load();
    await setupLogger();
    vi.resetModules();
    vi.doMock("@logtape/logtape", () => logtape);

    const reloaded = await import("@/shared/lib/logger");

    await expect(reloaded.setupLogger()).resolves.toBeUndefined();
  });
});
