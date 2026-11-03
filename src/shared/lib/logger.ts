import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

// LogTape keeps one configuration per process, while this module can be evaluated more than once
// (hot reload, separate server bundles): the pending configuration lives on globalThis.
const globalForLogger = globalThis as unknown as {
  appLoggerReady: Promise<void> | undefined;
};

/** Configures LogTape once per process. Calling it again waits for the same configuration. */
export async function setupLogger() {
  globalForLogger.appLoggerReady ??= configure({
    sinks: {
      console: getConsoleSink(),
    },
    loggers: [
      {
        category: ["app"],
        lowestLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
        sinks: ["console"],
      },
      // LogTape's own diagnostics: failures only, not its "configured" notice.
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console"],
      },
    ],
  }).catch((error: unknown) => {
    globalForLogger.appLoggerReady = undefined;
    throw error;
  });

  await globalForLogger.appLoggerReady;
}

export function getAppLogger(feature: string) {
  return getLogger(["app", feature]);
}
