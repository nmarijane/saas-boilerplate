/** The name of the product: titles of tabs, metadata, footer, the shell logo. */
export const APP_NAME = "SaaS Boilerplate";

/**
 * The origin of the app in development: the port of `npm run dev`. It is what
 * every absolute address the app builds falls back to when `NEXT_PUBLIC_APP_URL`
 * is not set, and what `.env.example` says: a test keeps them in step.
 */
export const DEV_APP_URL = "http://localhost:3088";

/**
 * Where "Help" in the navigation leads: a page or a `mailto:` link. `null`
 * leaves the entry out.
 */
export const HELP_URL: string | null = "mailto:support@example.com";

/**
 * The first segments of the pages that need a session, without the language.
 * A page is protected when its path is one of these, or starts with one of
 * them followed by a slash.
 */
export const APP_PATH_PREFIXES = [
  "/dashboard",
  "/projects",
  "/ai",
  "/settings",
  "/onboarding",
  "/admin",
] as const;

/**
 * What the secrets the app issues begin with, set once here: the API keys that a
 * person creates (`sb_live_…`, `sb_test_…`) and the signing secret of a webhook
 * endpoint (`sb_whsec_…`). They are the project's own on purpose: Stripe's
 * (`sk_live_`, `whsec_`) make a key of the app look like a Stripe key to the
 * secret scanners and to a person who pastes it. A project that rebrands picks a
 * prefix of its own (docs/SETUP.md, Phase 4). Changing a prefix leaves the keys
 * already issued as they are: a key is checked by the hash of the whole string,
 * whatever it begins with.
 */
export const SECRET_PREFIXES = {
  apiKeyLive: "sb_live_",
  apiKeyTest: "sb_test_",
  webhookSecret: "sb_whsec_",
} as const;

/**
 * How many workspaces one person may own (create and not give away). Joining
 * other people's workspaces is not counted. Creating is open to every person who
 * is signed in, and each workspace is rows, a plan and a place for files: without
 * a cap one account fills the database. A project with plans sets it by plan.
 */
export const MAX_OWNED_WORKSPACES = 10;
