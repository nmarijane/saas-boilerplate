# Release checklist

Run through this before every production deploy. Items marked **(you)** need real
credentials or infrastructure and can't be verified from the repo.

## Before deploy

- [ ] `npm run lint`, `npm run check:types`, `npm run test` all pass on the release commit
- [ ] `npm run build` succeeds from a clean checkout (`npm ci` first)
- [ ] `npm audit --omit=dev` reviewed; no unaccepted high/critical issues
- [ ] Database backup taken and a restore tested on a copy **(you)**
- [ ] Migrations reviewed (`migrations/`), including `0007_retire_example_tool.sql`

## Production environment **(you)**

- [ ] `DATABASE_URL`, `BETTER_AUTH_SECRET` (long random value), `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` (https)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_PRICE_PRO_MONTHLY/YEARLY`, `STRIPE_PRICE_ENTERPRISE_MONTHLY/YEARLY` (plans in `src/features/billing/plans.ts` ship with empty price IDs, so checkout is disabled without them)
- [ ] SMTP settings and `EMAIL_FROM`
- [ ] `STORAGE_ADAPTER` (S3 in production, not local disk) and `UPLOAD_MAX_SIZE`
- [ ] `RATE_LIMIT_ADAPTER` with Redis/Upstash (in-memory limits don't work across instances)
- [ ] `SENTRY_DSN`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- [ ] Stripe webhook endpoint points at `/api/stripe/webhook`

## Deploy

1. `npm run db:migrate`
2. Deploy the new build
3. Create the first platform admin by setting `isPlatformAdmin` in the database. It can't be set from the client.

## Smoke test

- [ ] `/api/health` returns OK
- [ ] Sign up, verify email, finish onboarding, land on the dashboard
- [ ] Open Tools, Runs, Billing and Settings with no broken links
- [ ] Stripe test checkout completes and the subscription shows in Billing
- [ ] Invite a member on the free plan: blocked by the member limit
- [ ] Upload a file; a user from another org can't open it

## Rollback

1. Redeploy the previous build.
2. Migrations are forward-only. If a migration must be undone, restore the pre-deploy backup. Don't hand-edit tables.
3. Re-send any Stripe events missed during the incident from the Stripe dashboard. The webhook handler ignores duplicates.
