import * as Sentry from "@sentry/nextjs";
import { scrubTokens } from "@/shared/lib/sentry-scrub";

// The browser reporter starts here. Next 16 builds with Turbopack, which loads
// this file in the browser and not `sentry.client.config.ts`: the SDK only reads
// that one when it is built with webpack. With no DSN there is nothing to report
// to, and nothing starts.
//
// The address of a page goes with every event and breadcrumb, and the link of the
// reset e-mail holds a token in its address: the three hooks filter it out (query and path). There
// is no replay: it would need `Sentry.replayIntegration()`, and the sample rates
// do nothing without it.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubTokens(event),
    beforeSendTransaction: (event) => scrubTokens(event),
    beforeBreadcrumb: (breadcrumb) => scrubTokens(breadcrumb),
  });
}

// Lets the SDK follow the navigations of the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
