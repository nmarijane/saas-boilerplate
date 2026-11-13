import * as Sentry from "@sentry/nextjs";
import { scrubServerEvent, scrubTokens } from "./src/shared/lib/sentry-scrub";

// A request that fails carries its address, and the address of the reset page holds
// a token, in its query and, on the server of Better Auth, in its path: the three
// hooks filter it out of what is sent, events, breadcrumbs and transactions with
// their spans (see src/shared/lib/sentry-scrub.ts).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubServerEvent(event),
    beforeSendTransaction: (event) => scrubServerEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubTokens(breadcrumb),
  });
}
