import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

let configured = false;

export async function setupLogger() {
  if (configured) return;
  configured = true;

  await configure({
    sinks: {
      console: getConsoleSink(),
    },
    loggers: [
      {
        category: ["app"],
        lowestLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
        sinks: ["console"],
      },
    ],
  });
}

export function getAppLogger(feature: string) {
  return getLogger(["app", feature]);
}
