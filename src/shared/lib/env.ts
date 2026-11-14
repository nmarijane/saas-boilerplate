import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { DEV_APP_URL } from "@/shared/config/app";
import { TRUST_PROXY_PATTERN } from "@/shared/lib/client-ip";

/** Whether this is a production server: not the build, which has none of the secrets (production-config.ts). */
const servesProduction = () =>
  process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().optional(),
    // No default: a secret that the code supplies is a secret that everyone has. Required in
    // production (Better Auth refuses to start without it as well), optional in development,
    // where Better Auth uses a throwaway one. Generate it with `openssl rand -hex 32`.
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -hex 32)")
      .optional()
      .refine((secret) => secret !== undefined || !servesProduction(), {
        message: "BETTER_AUTH_SECRET is required in production (openssl rand -hex 32)",
      }),
    BETTER_AUTH_URL: z.string().url().default(DEV_APP_URL),
    STRIPE_SECRET_KEY: z.string().default(""),
    STRIPE_WEBHOOK_SECRET: z.string().default(""),
    // The prices of the Stripe catalog (`npm run stripe:catalog` creates them and prints the ids). A price left empty
    // cannot be bought: its button says so instead of opening a checkout
    STRIPE_PRICE_PRO_MONTHLY: z.string().default(""),
    STRIPE_PRICE_PRO_YEARLY: z.string().default(""),
    STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().default(""),
    STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().default(""),
    STRIPE_PRICE_CREDITS_1000: z.string().default(""),
    STRIPE_PRICE_CREDITS_5000: z.string().default(""),
    // The customer portal that the app opens (`npm run stripe:catalog` prints it): the one with no cancellation in it
    STRIPE_PORTAL_CONFIGURATION_ID: z.string().default(""),
    // The currency the plans are priced in (a three-letter ISO code): the catalog creates its prices in it, and the pages show it
    BILLING_CURRENCY: z
      .string()
      .regex(/^[a-z]{3}$/i, "BILLING_CURRENCY must be a three-letter currency code, such as usd or eur")
      .transform((code) => code.toLowerCase())
      .default("usd"),
    // Stripe Tax: VAT computed at checkout, the billing address and the VAT number collected, prices shown "excl. VAT"
    STRIPE_TAX_ENABLED: z.stringbool().default(false),
    // A free trial without a card; at its end the subscription is cancelled and the workspace is back on the free plan
    BILLING_TRIAL_WITHOUT_CARD: z.stringbool().default(false),
    // How many workspaces on the free plan a person may own: the free credits are granted per owner, whatever the number
    MAX_FREE_WORKSPACES: z.coerce.number().int().nonnegative().default(1),
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    EMAIL_FROM: z.string().default("noreply@localhost"),
    STORAGE_ADAPTER: z.enum(["local", "s3"]).default("local"),
    UPLOAD_MAX_SIZE: z.coerce.number().int().positive().default(10_000_000),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    // Which header the address of the client is read from (src/shared/lib/client-ip.ts)
    TRUST_PROXY: z.string().regex(TRUST_PROXY_PATTERN, "TRUST_PROXY must be `vercel`, `none` or the number of reverse proxies in front of the app").optional(),
    // Lets a production server run on the local database (production-config.ts): the e2e tests only
    ALLOW_PGLITE_IN_PRODUCTION: z.literal("1").optional(),
    // Rate limiting
    RATE_LIMIT_ADAPTER: z.enum(["memory", "redis", "upstash"]).default("memory"),
    REDIS_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    // Audit
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    // Sentry (server)
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    // Inngest
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),
    // AI
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.string().url().optional(),
    AI_DEFAULT_MODEL: z.string().default("gpt-4o-mini"),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(""),
    NEXT_PUBLIC_APP_URL: z.string().url().default(DEV_APP_URL),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
    STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    STRIPE_PRICE_ENTERPRISE_YEARLY: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
    STRIPE_PRICE_CREDITS_1000: process.env.STRIPE_PRICE_CREDITS_1000,
    STRIPE_PRICE_CREDITS_5000: process.env.STRIPE_PRICE_CREDITS_5000,
    STRIPE_PORTAL_CONFIGURATION_ID: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
    BILLING_CURRENCY: process.env.BILLING_CURRENCY,
    STRIPE_TAX_ENABLED: process.env.STRIPE_TAX_ENABLED,
    BILLING_TRIAL_WITHOUT_CARD: process.env.BILLING_TRIAL_WITHOUT_CARD,
    MAX_FREE_WORKSPACES: process.env.MAX_FREE_WORKSPACES,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    STORAGE_ADAPTER: process.env.STORAGE_ADAPTER,
    UPLOAD_MAX_SIZE: process.env.UPLOAD_MAX_SIZE,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    TRUST_PROXY: process.env.TRUST_PROXY,
    ALLOW_PGLITE_IN_PRODUCTION: process.env.ALLOW_PGLITE_IN_PRODUCTION,
    RATE_LIMIT_ADAPTER: process.env.RATE_LIMIT_ADAPTER,
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    AUDIT_LOG_RETENTION_DAYS: process.env.AUDIT_LOG_RETENTION_DAYS,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    AI_DEFAULT_MODEL: process.env.AI_DEFAULT_MODEL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  // A variable set to nothing (`DATABASE_URL=`) counts as unset: the screenshot
  // server sets it so, to keep the .env files from filling it in
  emptyStringAsUndefined: true,
});
