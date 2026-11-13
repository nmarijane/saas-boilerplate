import type { KnipConfig } from "knip";

// `npm run check:deps` (the CI runs it) fails on anything that is not used. A finding is either fixed (the code or
// the dependency goes) or configured here, with the reason: this is a boilerplate, and some of what no page calls
// yet is what a project built on it is expected to call.
const config: KnipConfig = {
  entry: [
    "src/app/**/*.{ts,tsx}",
    "scripts/*.ts",
    // The tests are entries of their own: what only they call is used, and what they import is not unused
    "tests/**/*.{ts,tsx}",
    // The end-to-end tests are named `*.e2e.ts`: the Playwright config says so, knip's own pattern does not
    "tests/e2e/*.e2e.ts",
    "playwright*.config.ts",
  ],
  project: ["src/**/*.{ts,tsx}"],
  ignore: ["src/shared/components/ui/**"],
  ignoreDependencies: [
    "dotenv-cli",
    // `@import "tailwindcss"` in src/styles/global.css: a stylesheet, which knip does not read
    "tailwindcss",
    // The Upstash adapter imports it; it comes with @upstash/ratelimit, which depends on it
    "@upstash/redis",
  ],
  // A tool the machine has (Docker), not a package of the project
  ignoreBinaries: ["docker-compose"],
  // What the kit offers and no page of the template calls yet. A project that builds on it uses them or deletes
  // them; the CI must not ask the boilerplate to delete its own extension points.
  ignoreIssues: {
    // Internal operations of the assistant, called by billing webhooks and jobs (service.ts says so)
    "src/features/ai/service.ts": ["files"],
    // The client side of billing and feature flags: the hook and the components a page uses to gate something
    "src/features/billing/components/upgrade-button.tsx": ["files"],
    "src/features/billing/hooks/use-subscription.ts": ["files"],
    "src/features/feature-flags/components/feature-gate.tsx": ["files"],
    "src/features/feature-flags/hooks/use-feature-flag.ts": ["files"],
    // Read by `next dev` and `next build`: next.config.ts names it as the next-intl request config
    "src/shared/lib/i18n-request.ts": ["files"],
    // Server actions and queries of the features: the pages of a project build on them
    "src/features/ai/actions.ts": ["exports"],
    "src/features/ai/queries.ts": ["exports"],
    "src/features/ai/config/credits.ts": ["exports"],
    "src/features/billing/actions.ts": ["exports"],
    "src/features/billing/plans.ts": ["exports"],
    "src/features/blog/queries.ts": ["exports"],
    "src/features/waitlist/queries.ts": ["exports"],
    // The public surface of the auth client, as Better Auth gives it
    "src/features/auth/auth-client.ts": ["exports"],
    // Structured data and helpers a page of a project uses
    "src/shared/lib/jsonld.ts": ["exports"],
    "src/shared/lib/rate-limit/index.ts": ["exports", "types"],
    "src/shared/utils/helpers.ts": ["exports"],
    "src/features/upload/validation.ts": ["types"],
    "src/shared/types/index.ts": ["exports", "types"],
    // `email dev` (React Email) previews the default export of each template, and the code imports the named one
    "src/features/email/templates/*.tsx": ["exports", "duplicates"],
  },
  next: {
    entry: [
      "src/app/**/*.{ts,tsx}",
      "next.config.ts",
    ],
  },
};

export default config;
