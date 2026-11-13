import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
// Relative, not `@/`: the config is loaded before the aliases of the app exist
import { legacyRedirects } from "./src/shared/config/redirects";
import { routing } from "./src/shared/lib/i18n-routing";

const withNextIntl = createNextIntlPlugin("./src/shared/lib/i18n-request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  // The local database (PGlite, when there is no DATABASE_URL) loads its
  // WebAssembly from `import.meta.url`. Bundled into the server, that URL is
  // not one that Node's `fs` takes: the load fails, and since the client is
  // shared by the whole server and a page that is drawn first creates it (the
  // sign-in page, which asks `auth.ts` which providers are on), every query
  // fails after it. Left out of the bundle, Node loads it itself.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The old addresses of the settings pages (src/shared/config/redirects.ts)
  async redirects() {
    return legacyRedirects(routing.locales);
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Start with Report-Only — switch to Content-Security-Policy
            // after validation in staging
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://api.stripe.com https://*.sentry.io",
              "frame-src https://js.stripe.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
