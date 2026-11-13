import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // A production server that is configured wrongly does not start (production-config.ts)
    const { refuseToStartMisconfigured } = await import("./shared/lib/production-config");
    refuseToStartMisconfigured();

    await import("../sentry.server.config");

    // App logs, and with them the dev e-mail fallback that prints verification and reset links,
    // are switched on outside production only: what production logs is unchanged.
    if (process.env.NODE_ENV !== "production") {
      const { setupLogger } = await import("./shared/lib/logger");
      await setupLogger();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
