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
