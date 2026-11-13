# New SaaS Project Setup Guide

This guide is designed for LLMs (Claude Code, Cursor, etc.) bootstrapping a new SaaS project from this boilerplate. Follow each phase in order.

## Phase 1: Clone & Initialize

```bash
git clone https://github.com/nmarijane/saas-boilerplate.git my-project
cd my-project
rm -rf .git
git init
npm install
```

The project needs Node 22.13 or later (`engines` in `package.json`; `.nvmrc` says `22`, as CI and the Dockerfile do).

Update `package.json`:
- Change `"name"` to your project name
- Update `"version"` to `"0.1.0"`

Update `README.md`:
- Replace all `nmarijane/saas-boilerplate` with your `username/repo-name` (badges, links)
- Update the project title and description

### CI/CD (works automatically)

The GitHub Actions workflows (`.github/workflows/`) are included. Once you push to GitHub:
- **Lint, typecheck, test, build, storybook, audit** — work immediately, no config needed
- **Dependabot** — works immediately, sends weekly PRs for outdated deps
- **Coverage badge** — updates automatically on push to main; the CI commits it to a dedicated `badges` branch, so `main` can stay protected
- **Claude Code review** — requires setup: run `claude /install-github-app` in your terminal, or add `ANTHROPIC_API_KEY` to your repo secrets

## Phase 2: Configure Environment

```bash
cp .env.example .env.local
```

A variable that is set to nothing (`DATABASE_URL=`) counts as unset: it takes its default, or stays off.

### Required for local dev (minimum)

Nothing. The app runs out of the box on PGlite, a PostgreSQL database kept in the directory `./local.db`, with sensible defaults. `PGLITE_DATA_DIR` moves it (Phase 5).

### Required for production

| Variable | How to get it | Used by |
|----------|--------------|---------|
| `DATABASE_URL` | Create a PostgreSQL database (Neon, Supabase, Railway, or self-hosted). Format: `postgresql://user:password@host:5432/dbname` | Database |
| `BETTER_AUTH_SECRET` | Generate: `openssl rand -hex 32` | Auth sessions |
| `BETTER_AUTH_URL` | Your deployed app URL (e.g. `https://my-app.com`) | Auth callbacks |
| `NEXT_PUBLIC_APP_URL` | Same as BETTER_AUTH_URL | Links, metadata |

### Required for billing (Stripe)

| Variable | How to get it | Used by |
|----------|--------------|---------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard > Developers > API keys > Secret key | Server-side Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Developers > Webhooks > Add endpoint (`/api/stripe/webhook`) > Signing secret | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard > Developers > API keys > Publishable key | Client-side Stripe.js |

Deleting a workspace cancels its subscription at Stripe first, at once, and keeps the workspace when Stripe cannot. A checkout that someone pays after its workspace was deleted (a checkout lasts a day) gets its subscription cancelled at once too: the app does it when the session carries its own metadata (the `orgId` it opened the checkout with) and its audit log holds the deletion of that workspace, so `AUDIT_LOG_RETENTION_DAYS` must stay above that day (four days cover the three that Stripe spends retrying an event it could not deliver). It never touches a subscription whose session lacks that metadata, or one of a workspace it never had (another product, or another copy of the app, on the same Stripe account). Refunding the first payment of such a subscription is your call.

### Required for email

| Variable | How to get it | Used by |
|----------|--------------|---------|
| `SMTP_HOST` | Your SMTP provider (Resend: `smtp.resend.com`, SendGrid: `smtp.sendgrid.net`, Postmark: `smtp.postmarkapp.com`) | Email sending |
| `SMTP_PORT` | Usually `587` (TLS) or `465` (SSL) | Email sending |
| `SMTP_USER` | From your SMTP provider dashboard | Email sending |
| `SMTP_PASS` | From your SMTP provider dashboard (API key or password) | Email sending |
| `EMAIL_FROM` | Your verified sender email (e.g. `hello@my-app.com`) | Email "From" field |

### Optional: OAuth providers

| Variable | How to get it |
|----------|--------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console > APIs & Services > Credentials > Create OAuth 2.0 Client. Redirect URI: `{APP_URL}/api/auth/callback/google` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub > Settings > Developer settings > OAuth Apps > New. Callback URL: `{APP_URL}/api/auth/callback/github` |

A provider is on when both of its variables are set, and only then does its button show under the sign-in and sign-up forms. With none set, those pages show no button and no "Or continue with" separator.

### Optional: AI assistant

| Variable | What it does |
|----------|--------------|
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY` | A provider is on when its key is set |
| `OLLAMA_BASE_URL` | A local Ollama server (`http://localhost:11434/v1`) is wired as a provider, but no model of the list runs on it yet: to use it, add one to the model list (`src/features/ai/config/models.ts`) |
| `AI_DEFAULT_MODEL` | The model a new conversation starts with (default `gpt-4o-mini`) |
| `AI_CREDITS_PER_ORG_MONTHLY` | Declared in `src/shared/lib/env.ts` and not read yet: the credits of a workspace come from its plan (`src/features/ai/config/credits.ts`) |

The assistant is on as soon as a model of the list can run: set one key and restart the server. With none set (`OLLAMA_BASE_URL` alone does not count: no model of the list runs on it yet), the AI page of the app says that the assistant is not configured, and the model picker lists only the models of the providers that are on.

**Credits.** An answer is paid for in credits, from the balance of the workspace (`ai_credit_ledger`). A new workspace starts with none: nothing allocates credits when a workspace is created, because that would come before the limit on how many workspaces a person may make. The flow that sells a plan, which the boilerplate does not have yet, is where the monthly allocation of a plan belongs (`CREDIT_PLANS` in `src/features/ai/config/credits.ts` says how many each plan gets). Until then a workspace has what you give it: insert a `plan_allocation` row for it in the ledger (`scripts/demo-data.ts` does it for its two workspaces). The demo (Phase 5) gives both of its workspaces the credits of their plan, so the assistant answers in each.

**What Stop does.** The button hides the rest of an answer from the person, and nothing else: the provider keeps producing it, and bills it all the same, so the route reads it to its end, saves it and charges it, whatever the client does (Stop, a closed tab, a script that stops reading). Two more cases follow from the same rule:

- An answer with no text (only spaces, or a provider that stopped before any, its content filter for instance) is charged too, because the provider billed the question, and leaves no row: its question goes with it, and the person is told to try again or to rephrase.
- A provider that fails (a key it refuses, a network that is down, a stream that breaks) charges nothing and leaves no row either: the question goes with the failure, so that "Try again" stores it once.

What one request can cost is bounded, and the bounds are settings, not code to hunt for: the length of a message (`MAX_MESSAGE_LENGTH`) and the history given to the model (`MAX_HISTORY_MESSAGES`) in `src/features/ai/config/chat.ts`, and the longest answer, `maxOutputTokens` of each model in `src/features/ai/config/models.ts`. On a serverless host, set the `maxDuration` of the function that serves `src/app/api/ai/chat/route.ts` (an `export const maxDuration` in the route file) long enough for an answer of `maxOutputTokens`: the answer goes on after Stop, and a function the host stops before it ends cannot save the answer or charge it.

### Optional: File storage (S3)

Default is local filesystem. For S3:

```env
STORAGE_ADAPTER=s3
S3_BUCKET=my-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=secret...
```

### Optional: Rate limiting (Redis)

Default is in-memory (single instance only). For distributed:

```env
# Option A: Self-hosted Redis
RATE_LIMIT_ADAPTER=redis
REDIS_URL=redis://localhost:6379

# Option B: Upstash (serverless, Edge-compatible)
RATE_LIMIT_ADAPTER=upstash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...
```

### Optional: Error tracking (Sentry)

```env
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=my-org
SENTRY_PROJECT=my-project
```

The browser reports the errors that the route boundaries catch, from `src/instrumentation-client.ts`, and starts only where `NEXT_PUBLIC_SENTRY_DSN` is set. The server and the edge start from `sentry.server.config.ts` and `sentry.edge.config.ts`. All three filter the reset-password token out of what they send (`src/shared/lib/sentry-scrub.ts`): in a `?token=` parameter, in the path of Better Auth's own address (`/api/auth/reset-password/<token>`), and in `reset-password:<token>`, the identifier a database error may carry, each also when it is percent-encoded inside another address. The server and the edge also remove `token`, `password`, `newPassword` and `currentPassword` from the request data an event or a transaction carries (an object or a JSON string). That covers events, breadcrumbs and sampled transactions with their spans.

### Optional: Background jobs (Inngest)

Auto-detected in dev. For production, sign up at inngest.com:

```env
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

## Phase 3: Remove Unused Features

A feature that appears in the app shell (a link, a quota, a first step of the home) has a `shell.ts` in its folder of `src/features/`, and `src/features/registry.ts` lists those features. Removing one is its folder and, if it has a `shell.ts`, its line in the registry, then the few files outside the folder that name it. Before the first step, run `npm run check:deps` and keep its output: step 10 compares with it. To remove a feature:

1. Delete its directory from `src/features/`. Its `shell.ts` goes with it.
2. If it has a `shell.ts`, delete its import and its entry in `FEATURES`, in `src/features/registry.ts`.
3. Delete its model from `src/models/` (if it has one) and its export from `src/models/index.ts`.
4. Delete its API routes from `src/app/api/` and their entries in `src/app/api/agent-docs/route.ts`.
5. Delete its pages from `src/app/[locale]/`. The `loading.tsx` and `error.tsx` of a page sit in its folder and go with it. If the feature has pages of its own, remove its prefix from `APP_PATH_PREFIXES` in `src/shared/config/app.ts`, and from the five prefixes that the case "guards the pages of the connected space" of `tests/unit/shell/proxy.test.ts` lists (`/dashboard`, `/ai`, `/settings`, `/onboarding`, `/admin`) if it is one of them. A feature whose pages sit under `settings/` or `(marketing)/` (billing, notifications) has no prefix of its own: `/settings` stays.
6. Delete the feature's own tests: the folder `tests/unit/<name>/` and the files `tests/integration/<name>*`. Then `grep -rlE "features/<name>|<name>Shell" tests` lists the tests that still name it (`<name>Shell` is the export of its `shell.ts` in camelCase, `apiKeysShell` for `api-keys`). A test of this feature alone goes entirely, wherever it sits: `tests/unit/api-key-helpers.test.ts` and `tests/unit/webhook-matching.test.ts` are in the grep without being in the two places above, and `tests/unit/webhook-handler.test.ts`, which imports nothing from its feature, is only in its scenario. In a test that covers several features, remove only this feature's cases and imports. A file that names the feature only in a list of files it checks when they exist (`tests/unit/ui/no-raw-palette.test.ts`) stays as it is.
7. Edit what its scenario below lists: the demo data, the test helpers and the shared tests, which the grep does not all find.
8. Run `npx eslint . --fix`: it removes the imports that nothing uses any more. Then run `npm run lint` and `npm run check:types`, and remove by hand what they still list: a variable, a constant or a helper function that only the removed lines used, and each `await testDb.delete(<table>)` that empties a removed table, in the `beforeEach` of a test or in a case (`check:types` says `has no exported member '<table>'`). Run `npx eslint . --fix` once more.
9. If the feature had a model, run `npm run db:generate`. It writes the migration that drops the feature's tables.
10. Run `npm run check:deps` again and compare it with the run you kept. What it lists now and did not then is what the feature alone used, such as `stripe` after billing or `@aws-sdk/client-s3` after upload: remove it with `npm uninstall <name>`. A removal adds no other finding.

The messages of a removed feature can stay in `src/locales/en.json` and `fr.json`: an unused key fails nothing. So can its event names (`payment.failed`, `project.created`...) in `src/features/events/types.ts` and `src/features/webhooks/available-events.ts`, which nothing emits any more. To take the events out, delete their names from both files, their messages (`activity.<group>` and `webhooks.event.<group>`) from both locale files, and the cases that name them in the tests (`grep -rn "<group>\." tests`).

The Developers page (`settings/developers`) draws the API keys and the webhooks, and both features give its tab. A project that removes both deletes the page, the two tests that are about it alone (`tests/integration/developers-page.test.tsx` and `tests/unit/settings/developers.test.tsx`) and, in `LEGACY_REDIRECTS` (`src/shared/config/redirects.ts`), the line `/settings/api`, which sends the old address of the API page to it. Three shared tests still name them. `tests/unit/settings/copy.test.ts` lists the page among its files (`FILES`): take it out, or two of its cases fail on a missing file. In the two others, nine cases fail until they are edited: `tests/unit/settings/settings-family.test.ts` (`"developers"` leaves `PAGES`, which six cases read) and `tests/unit/config/redirects.test.ts` (`/settings/api` leaves the three cases that name it: "redirects the old settings addresses, with and without a locale", "keeps /settings temporary and the pages that were merged or renamed permanent" and "runs for each old address, in any language, and only for those"). The fourth case that names it, "never catches a page that exists, or a language it does not serve" (`redirects.test.ts:108`), stays green and unedited: it checks that `/de/settings/api` is not redirected, which stays true. To remove both, apply the two scenarios below, except their edits to the page, to `settings.developers.context` and to the two tests about the page, which all go with it. A project that removes only one of the two keeps the page, its tab and the redirect, and cuts that feature out of the page and out of the two tests that read it: "No API keys needed" and "No webhooks needed" below list every line.

### Feature dependency map

`requires` is what a feature cannot run without. `optional` is what it uses when that one is installed: removing that one means an edit in this feature, which its scenario below lists.

```
auth (core - DO NOT remove)
  billing (requires: auth, events, stripe)
  onboarding (requires: auth)
  notifications (requires: auth)
  feedback (requires: auth, optional: upload)
  upload (requires: auth, optional: s3)
  api-keys (requires: auth, events)
  webhooks (requires: auth, events)
  feature-flags (requires: auth)
  audit (requires: auth, events)
  changelog (requires: auth)
  admin (requires: auth, optional: billing)
  dashboard (requires: auth)
  settings (requires: auth, optional: billing)
  ai (requires: auth, optional: billing)
  projects (requires: auth, events)
  waitlist (requires: auth)
  blog (standalone)
  email (standalone templates, used by: auth, jobs)
  events (event bus, used by: api-keys, audit, billing, projects, webhooks; its handlers write audit, notifications and webhooks)
  jobs (background tasks for: email, webhooks, audit)
```

### Common removal scenarios

**No billing needed.** The shell needs no other edit: with no plan it shows no plan and no quota, and the Billing links of the settings tabs and of the account menu go with the registry line, as does the cancel of the subscription when a workspace is deleted.

```
Delete: src/features/billing/
Delete: src/models/subscription.ts (the plan and subscription tables)
Delete: src/app/api/stripe/
Delete: src/app/[locale]/(app)/(shell)/settings/billing/
Delete: src/app/[locale]/(marketing)/pricing/
Delete: tests/unit/billing/ and tests/integration/billing-*
Remove: billingShell from src/features/registry.ts
Remove: subscription from src/models/index.ts
Remove: the /api/stripe/webhook entry from src/app/api/agent-docs/route.ts
Remove: STRIPE_* and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from src/shared/lib/env.ts and .env.example
Remove: billing/webhook-handlers.ts from the coverage list of vitest.config.mts
Remove: the links to /pricing from src/app/[locale]/(marketing)/layout.tsx and src/shared/components/layout/footer.tsx, and "/pricing" from src/app/sitemap.ts
```

Then edit what reads billing's tables:

- `src/features/settings/actions.ts`: in the account deletion, take out the block that cancels the Stripe subscription of a workspace whose only member leaves, the `subscription` import and the `unstable_rethrow` import. The transfer of ownership stays: take out the `if (otherMembers.length === 0) { ... }` block, and keep the body of the `else` without the `else`.
- `src/features/admin/queries.ts` and `src/app/[locale]/(app)/(shell)/admin/metrics/page.tsx`: take out the revenue, which is the `mrr` of `getAdminMetrics` and the "MRR" card, with `getFormatter` and its `format`, which only the card used.
- `src/app/[locale]/(app)/(shell)/ai/page.tsx` and `src/app/api/ai/chat/route.ts`: the assistant reads the plan of the workspace from its subscription, to size its credits. Replace that read with `const planId = "free";`, or with your own rule.
- `scripts/seed.ts`: take out the plans. `scripts/demo-data.ts`: take out the `SUBSCRIPTION` id, the subscription insert, the `referenceId: SUBSCRIPTION` of the credit allocation, the audit entry `demo-audit-3` and the notification `demo-notification-3`.

And the tests:

- `tests/helpers/seed.ts`: `seedPlan` and `seedSubscription`.
- `tests/integration/demo-data.test.ts`: the cases "puts Acme on the Pro plan, renewed in 18 days, and Northwind on the free plan", "leaves the plans as they are" and "writes all of the demo or none of it: a failure rolls back what was already in" (it makes the demo fail with a plan that is missing); `subscriptions: subscription` in the tables it counts, the `plan` and `subscription` imports, and `await seedPlan("pro")` in `resetDemo`; the entry `["subscription.updated", null]` of "tells five events of the workspace..." (and its comment); and the counts that followed the rows: in "seeds the demo workspace once, however often it runs", `toHaveLength(5)` of the activity becomes 4 and `{ logs: 5, notifications: 5, members: 4 }` becomes `{ logs: 4, notifications: 4, members: 4 }`; in "gives Camille five notifications, two of them unread...", `toHaveLength(5)` becomes 4 (the unread ones stay two). The numbers in those two titles follow ("four events", "four notifications").
- `tests/integration/seed-script.test.ts`: the plans it reads back (`seeded.plans`, in both cases).
- `tests/integration/admin-metrics-page.test.tsx`: the `describe` "the revenue of the metrics page", and `testDb.delete(subscription)` and `testDb.delete(plan)` in its `beforeEach`. `tests/unit/queries/admin-queries.test.ts`: the cases "calculates MRR from active subscriptions only" and "returns mrr 0 when all subscriptions are canceled", `mrr: 0` in the expectation of "returns zeroes when database is empty", `expect(result.mrr).toBe(0)` in "counts users and organizations correctly", and the same two `testDb.delete` lines in its `beforeEach`.
- `tests/integration/server-action-guards.test.ts`: the `describe` "createCheckoutSessionAction" and the mock of `@/features/billing/stripe`.
- `tests/unit/settings/copy.test.ts`: the billing page and `billing-settings.tsx` in its list of files, and `"billing"` in the list of groups of the case "take the same values in both languages". `tests/unit/settings/settings-family.test.ts`: `"billing"` in `PAGES`.
- `tests/unit/generate-claude-context.test.ts`: the three expectations that name `plan`, `subscription` and `billing`.
- `tests/e2e/sanity.e2e.ts`: the case "pricing page loads".

Then finish with steps 8 and 9 above: `npm run lint`, `npm run check:types`, and `npm run db:generate`, which writes the migration that drops the `plan` and `subscription` tables.

**No file upload needed.** The storage card of the home goes with the registry line, as does the deletion of the stored files when a workspace is deleted.

```
Delete: src/features/upload/
Delete: src/models/upload.ts
Delete: src/app/api/upload/
Delete: tests/unit/upload-storage.test.ts, tests/unit/upload-units.test.ts, tests/unit/upload-file-list.test.tsx, tests/unit/upload-components.test.tsx, tests/unit/queries/upload-queries.test.ts, tests/integration/upload-actions.test.ts, tests/integration/upload-route.test.ts and tests/integration/upload-workspace-deletion.test.ts
Delete: tests/unit/feedback/feedback-modal.test.ts (it only checks that the upload markers below are there)
Remove: uploadShell from src/features/registry.ts
Remove: upload from src/models/index.ts
Remove: the /api/upload entries from src/app/api/agent-docs/route.ts
Remove: S3_*, STORAGE_ADAPTER and UPLOAD_MAX_SIZE from src/shared/lib/env.ts and .env.example
```

Then edit what the upload feature gives to the others:

- `src/features/feedback/components/feedback-modal.tsx`: remove the block from `{/* upload:start */}` to `{/* upload:end */}`, the two markers included, and every line that ends with `// upload`. Do the same in `feedback-modal.stories.tsx`.
- `src/features/feedback/actions.ts`: take out `screenshotId` (the field of the schema and the screenshot link added to the message). `src/app/api/feedback/route.ts`: take it out of the body it reads and passes on. `src/app/api/agent-docs/route.ts`: take it out of the body of `/api/feedback`.
- `scripts/demo-data.ts`: take out `MEGABYTE`, the `UPLOADS` list and the upload insert.

And the tests:

- `tests/helpers/seed.ts`: `seedUpload`.
- `tests/integration/home-loaders.test.ts`: take out the comment above `ORG` first (it quotes the markers), then remove every line that ends with `// upload` and every block between `// upload:start` and `// upload:end`.
- `tests/integration/demo-data.test.ts`: `getStorageUsedMb`, `upload`, and `uploads: upload` in the tables it counts, and the case "weighs the uploads 3,200 MB: megabytes of a million bytes, the unit the limits of the plans are written in".
- `tests/integration/server-action-guards.test.ts`: the `describe` "deleteFile", the mock of `@/features/upload/storage/adapter`, `storageDelete`, and `await testDb.delete(upload)` in the `beforeEach`.
- `tests/integration/feedback.test.ts`: the two cases about the screenshot link.

Then finish with steps 8 and 9 above: `npm run lint`, `npm run check:types`, and `npm run db:generate`, which writes the migration that drops the `upload` table.

**No notifications needed.** The bell and its provider, which reads the unread count once for the whole app, go with the registry line, and so does the Notifications tab of the settings.

```
Delete: src/features/notifications/
Delete: src/models/notification.ts
Delete: src/app/api/notifications/
Delete: src/app/[locale]/(app)/(shell)/settings/notifications/
Delete: src/features/events/handlers/notification.ts
Delete: tests/unit/notifications/, tests/integration/notifications.test.ts and tests/unit/queries/notification-queries.test.ts
Remove: notificationsShell from src/features/registry.ts
Remove: notification from src/models/index.ts
Remove: the /api/notifications entries from src/app/api/agent-docs/route.ts
```

Then edit what the notifications give to the others:

- `src/features/events/emitter.ts`: the import of `handleNotification`, the comment "Notifications are non-critical" with the call that follows it, and the line "Notifications: synchronous, errors logged but don't block" in the comment above `emitEvent`.
- `scripts/demo-data.ts`: the notifications insert.

And the tests:

- `tests/helpers/seed.ts`: `seedNotification`.
- `tests/integration/demo-data.test.ts`: `getUnreadCount`, `notification`, and `notifications: notification` in the tables it counts; in "seeds the demo workspace once, however often it runs", `expect(await getUnreadCount(camille)).toBe(2)` and `notifications: 5` in `{ logs: 5, notifications: 5, members: 4 }`; and the cases "gives Camille five notifications, two of them unread, that lead to a page of the app" and "gives each notification Acme as its workspace, and words that both languages draw from its values" (step 8 then takes out `createTranslator`, `en` and `fr`, which only that case reads).
- `tests/integration/event-bus.test.ts`: the `describe` "handleNotification".
- `tests/integration/settings-pages.test.tsx`: the notifications page (its import, the `NotificationList` import, the mock of `@/features/notifications/components/notifications-provider`, `await testDb.delete(notification)`) and the last `describe`, "the notifications page".
- `tests/unit/i18n/hardcoded-copy.test.ts`: the four files of `src/features/notifications/components`.
- `tests/unit/settings/copy.test.ts`: the notifications page and the two notification components in its list of files, `"notifications"` in the list of groups of the case "take the same values in both languages", and the last `describe`, "the number of unread notifications". `tests/unit/settings/settings-family.test.ts`: `"notifications"` in `PAGES`.

Then finish with steps 8 and 9 above: `npm run lint`, `npm run check:types`, and `npm run db:generate`, which writes the migration that drops the `notification` table.

**No API keys needed.** The Developers tab stays, drawn by the webhooks, and so does its page, with the webhooks alone. The first step "API key" of the home goes with the registry line.

```
Delete: src/features/api-keys/
Delete: src/models/api-key.ts
Delete: tests/unit/api-keys/, tests/integration/api-keys.test.ts, tests/unit/api-key-helpers.test.ts, tests/e2e/api-keys.e2e.ts and tests/helpers/api-keys.ts
Remove: apiKeysShell from src/features/registry.ts
Remove: api-key from src/models/index.ts
Remove: src/features/api-keys/helpers.ts from the coverage list of vitest.config.mts
```

Then edit the Developers page, which reads the keys:

- `src/app/[locale]/(app)/(shell)/settings/developers/page.tsx`: the imports from `@/features/api-keys` (`ApiKeyList`, `CreateKeyButton`, `apiKeyStatus`, `countActiveApiKeys` and `getApiKeysForOrg`); `keys` and `activeKeys` in the `Promise.all`, with the two reads that fill them; `now` and `keyItems`; the `<ApiKeyList ... />` line; `primaryAction={<CreateKeyButton ... />}`, as the page has no main action left (the endpoints keep the button of their section); and the `keys` argument of `context`, which becomes `t("context", { endpoints: endpoints.length })`. The comment above `DevelopersSettingsPage` speaks of both lists: rewrite it for the endpoints.
- `src/locales/en.json` and `fr.json`: `settings.developers.context` becomes `{endpoints, plural, one {# webhook} other {# webhooks}}`, in both.

And the tests:

- `tests/helpers/seed.ts`: `seedApiKey`.
- `tests/unit/server-action-conventions.test.ts`: the first `expect` of "scans the server action modules of src/", which names `createApiKeyAction`.
- `tests/unit/settings/copy.test.ts`: the four files of `src/features/api-keys/components` in its list of files, and `"apiKeys"` in the list of groups of the case "take the same values in both languages".
- `tests/integration/home-loaders.test.ts`: the imports of `countActiveApiKeys` and `apiKeysShell`, `apiKey` in the models import, the helper `key`, `await testDb.delete(apiKey)` in the `beforeEach`, `expect(await countActiveApiKeys(ORG)).toBe(0)` in "reads zero from a workspace that has nothing yet, not nothing", and the cases "counts the keys that can still be used (not revoked, not expired), of this workspace alone" and "marks the API key step done from one key that can still be used".
- `tests/integration/demo-data.test.ts`: the import of `countActiveApiKeys` and, in "leaves two of the three first steps done: a project and a team, but no API key", the `expect` on `countActiveApiKeys` (the title follows: "leaves the two first steps done: a project and a team").
- `tests/integration/server-action-guards.test.ts`: the import of the two key actions, `apiKey` in the models import, `await testDb.delete(apiKey)` in the `beforeEach`, and the `describe` "createApiKeyAction" and "revokeApiKeyAction".
- `tests/integration/settings-revalidation.test.ts`: the import of the two key actions, `apiKey` in the models import, `await testDb.delete(apiKey)` in the `beforeEach`, and the case "is the developers page, after an API key is made and after it is revoked".
- `tests/unit/settings/developers.test.tsx`: the import of `apiKeysShell`. The helper `context` loses its `keys` argument, and so does each call and each expected string of the three cases that read it ("names the counts of the developers page" and the two plural cases): `context("fr", 2, 1)` becomes `context("fr", 1)` and expects `"1 webhook"`, not `"2 clés d'API · 1 webhook"`. In the second `describe`, every line that names `apiKeysShell` goes, except in "is drawn once for an admin and for the owner, though two features declare it", whose list becomes `[webhooksShell]` (its title loses ", though two features declare it").
- `tests/integration/developers-page.test.tsx`:
  - Remove the imports of `ApiKeyList`, `apiKey` and `seedApiKey`; the helpers `headerOf`, `badgesOf` and `seedKey`; `await testDb.delete(apiKey)` in the `beforeEach`; the four keys of `seedDeveloperData` (and the words about keys in its comment); and the key of the other workspace in "lists the keys and the endpoints of the workspace of the session, in the order they were made, and none of another", with its `Foreign key` expectation.
  - Delete the cases "counts the keys it calls active as the rows say it: as many as there are Active badges", "tells each key by the start of it, in mono, and by when it was last used, or that it never was", "gives the key list what it shows and nothing else: no hash, no scopes, no workspace, no author" and "shows the empty state of the section that is empty, and the rows of the other".
  - The page is one section now. In the cases that stay, every expected `context` loses the keys and the ` · ` (`"2 API keys · 2 webhooks"` is `"2 webhooks"`); `h2` is `["Webhooks"]` where it listed two titles, in French too; there is one empty state, "No webhooks yet", one button, `Add endpoint`, and one title for the list (the set of ids has size 1, not 2); and the rows are the two endpoints.
  - Rework three cases: "says one in the singular, none in the plural, in English and in French" has no key to seed or to delete any more; "counts the keys that can still be used, and every endpoint: ..." keeps its endpoints half; "offers one main action in the header, Create API key, and no second one on the page" now expects one `Add endpoint` button and no `bg-primary` button. In French, the `Créer une clé d'API` button and the badges are no longer expected.
  - The titles that say "two sections", "each section", "every endpoint" or "the counts" follow, and so do the two that name the keys: "offers one main action in the header, Create API key, and no second one on the page" and "lists the keys and the endpoints of the workspace of the session, in the order they were made, and none of another".

Then finish with steps 8 and 9 above: `npm run lint`, `npm run check:types`, and `npm run db:generate`, which writes the migration that drops the `api_key` table.

**No webhooks needed.** The Developers tab stays, drawn by the API keys, and so does its page, with the keys alone. The event bus stays: its other handlers write the audit log and the notifications.

```
Delete: src/features/webhooks/
Delete: src/models/webhook.ts (the webhook_endpoint and webhook_delivery tables)
Delete: src/features/events/handlers/webhook.ts
Delete: src/features/jobs/functions/deliver-webhook.ts
Delete: tests/unit/webhooks/, tests/integration/webhooks.test.ts, tests/integration/webhooks-workspace-deletion.test.ts, tests/unit/webhook-matching.test.ts and tests/unit/webhook-handler.test.ts
Remove: webhooksShell from src/features/registry.ts
Remove: webhook from src/models/index.ts
Remove: deliverWebhookJob from src/features/jobs/index.ts, and from the import and the list of functions of src/app/api/inngest/route.ts
Remove: src/features/webhooks/matching.ts from the coverage list of vitest.config.mts
```

Then edit what the webhooks give to the others, and the Developers page, which reads the endpoints:

- `src/features/events/emitter.ts`: the import of `handleWebhook`, the comment "Webhooks are non-critical" with the statement that follows it (`const webhooks = handleWebhook(event)...`), the `if (options.awaitWebhooks) { ... }` block that waits for it, and the line "Webhook delivery: async (via Inngest), errors logged but don't block" in the comment above `emitEvent`. The `awaitWebhooks` option then waits for nothing: take `EmitOptions` and the `options` parameter out of `emitEvent`, and the `{ awaitWebhooks: true }` argument out of the `organization.deleted` event in `src/features/auth/organization/actions.ts` (`check:types` lists it).
- `src/app/[locale]/(app)/(shell)/settings/developers/page.tsx`: the imports of `WebhookList` and `getWebhookEndpointsForOrg`; `endpoints` in the `Promise.all`, with the read that fills it; `endpointItems`; the `<WebhookList ... />` line; and the `endpoints` argument of `context`, which becomes `t("context", { keys: activeKeys })`. The comment above `DevelopersSettingsPage` speaks of both lists: rewrite it for the keys.
- `src/locales/en.json` and `fr.json`: `settings.developers.context` becomes `{keys, plural, one {# API key} other {# API keys}}`, and `{keys, plural, one {# clé d'API} other {# clés d'API}}` in French.

And the tests:

- `tests/helpers/seed.ts`: `seedWebhookEndpoint`.
- `tests/unit/settings/copy.test.ts`: the two files of `src/features/webhooks/components` in its list of files, and `"webhooks"` in the list of groups of the case "take the same values in both languages".
- `tests/integration/server-action-guards.test.ts`: the import of the two webhook actions, `webhookEndpoint` in the models import, `await testDb.delete(webhookEndpoint)` in the `beforeEach`, and the `describe` "webhook actions".
- `tests/integration/workspace-deletion.test.ts`: the `{ awaitWebhooks: true }` that the case "tells who deleted which workspace, and waits for the webhooks to be queued while its endpoints exist" expects (its title loses ", and waits for the webhooks...").
- `tests/integration/settings-revalidation.test.ts`: the import of the three webhook actions, `webhookEndpoint` in the models import, `await testDb.delete(webhookEndpoint)` in the `beforeEach`, and the case "is the developers page, after a webhook endpoint is made, turned off and deleted".
- `tests/unit/settings/developers.test.tsx`: the import of `webhooksShell`. The helper `context` loses its `endpoints` argument, and so does each call and each expected string of the three cases that read it ("names the counts of the developers page" and the two plural cases): `context("fr", 2, 1)` becomes `context("fr", 2)` and expects `"2 clés d'API"`, not `"2 clés d'API · 1 webhook"`. In the second `describe`, every line that names `webhooksShell` goes, except in "is drawn once for an admin and for the owner, though two features declare it", whose list becomes `[apiKeysShell]` (its title loses ", though two features declare it").
- `tests/integration/developers-page.test.tsx`:
  - Remove the imports of `WebhookList`, `webhookEndpoint` and `seedWebhookEndpoint`; `await testDb.delete(webhookEndpoint)` in the `beforeEach` and in "counts the keys that can still be used, and every endpoint: a key that ran out or was revoked is a record, a disabled endpoint still exists"; the two endpoints of `seedDeveloperData` (and the words about endpoints in its comment); and the endpoint of the other workspace in "lists the keys and the endpoints of the workspace of the session, in the order they were made, and none of another", with its `elsewhere.test` expectation.
  - Delete the cases "gives the endpoint list what it shows and nothing else: never the signing secret" and "shows the empty state of the section that is empty, and the rows of the other".
  - The page is one section now. In the cases that stay, every expected `context` loses the endpoints and the ` · ` (`"2 API keys · 2 webhooks"` is `"2 API keys"`); `h2` is `["API keys"]` where it listed two titles (`["Clés d'API"]` in French); there is one empty state, "No API keys yet", one button, `Create API key`, and one title for the list (the set of ids has size 1, not 2); and the rows are the four keys.
  - Rework three cases: "says one in the singular, none in the plural, in English and in French" has no endpoint to seed any more; "counts the keys that can still be used, and every endpoint: ..." keeps its keys half; "offers one main action in the header, Create API key, and no second one on the page" no longer expects the `Add endpoint` button. In French, the `Ajouter un endpoint` button is no longer expected.
  - The titles that say "two sections", "each section", "every endpoint" or "the counts" follow.

Then finish with steps 8 and 9 above: `npm run lint`, `npm run check:types`, and `npm run db:generate`, which writes the migration that drops the `webhook_endpoint` and `webhook_delivery` tables.

**No example entity.** The projects are the example entity of the app: a list, a page for each one and its settings.

```
Delete: src/features/projects/
Delete: src/models/project.ts
Delete: src/app/[locale]/(app)/(shell)/projects/
Delete: tests/unit/projects/ (it includes loading-states.test.ts, which imports nothing from the feature) and tests/integration/projects*
Remove: projectsShell from src/features/registry.ts
Remove: project from src/models/index.ts
Remove: "/projects" from APP_PATH_PREFIXES in src/shared/config/app.ts
```

Then edit the demo and the tests that name it:

- `scripts/demo-data.ts`: `projectId`, the `PROJECTS` list and the project insert, the audit entries `demo-audit-1` and `demo-audit-2`, and the notifications `demo-notification-1` and `demo-notification-5`, which lead to a project.
- If billing stays, `src/features/billing/plans.ts`: the `projects` limit of each plan and its label in `LIMIT_LABELS`, which the billing page lists. In its tests, the assertions on `limits.projects` (`tests/integration/billing-plan.test.ts`) and `"projects"` in the limits whose messages are checked (`tests/unit/billing/billing-settings.test.tsx`).
- `tests/helpers/seed.ts`: `seedProject`.
- `tests/integration/demo-data.test.ts`: `countProjects`, `listProjects` and `project`, `PROJECT_NAMES`, and `projects: project` in the tables it counts; the case "gives Acme twelve projects, eight active and four drafts, changed between two hours and three weeks ago"; in "seeds the demo workspace once, however often it runs", `expect(await countProjects(acme)).toBe(12)`, and the counts that followed the rows (`toHaveLength(5)` of the activity becomes 3, `getUnreadCount(camille)` is 1 and not 2, and `{ logs: 5, notifications: 5, members: 4 }` becomes `{ logs: 3, notifications: 3, members: 4 }`); in "tells five events of the workspace...", the entries `["project.updated", "Léa Martin"]` and `["project.created", "Camille Laurent"]` and the two assertions on `entries[0]` (`Atlas`) and `entries[1]` (`Orbit`); in "gives Camille five notifications, two of them unread...", `toHaveLength(5)` becomes 3, the unread ones 1, and `getUnreadCount(camille)` 1; and in "leaves two of the three first steps done: a project and a team, but no API key", `expect(await countProjects(acme)).toBeGreaterThanOrEqual(1)`. The numbers in those titles follow ("three events", "three notifications, one of them unread", "one of the two first steps").
- `tests/integration/server-action-guards.test.ts`: the `describe` "project actions", and `await testDb.delete(project)` in the `beforeEach`.
- `tests/screenshots/readme.screenshots.ts`: the `projects` test, which opens `/en/projects`.

Then finish with steps 8 and 9 above: `npm run lint`, `npm run check:types`, and `npm run db:generate`, which writes the migration that drops the `project` table.

The pictures of the README (`docs/screenshots/`) show the example projects. They stay as they are until `npm run screenshots` takes them again from the demo you keep.

**Rename the example entity.** The entity is a folder, a table, some routes, and a few names that other files read. Rename them together (here, `projects` becomes `tickets`):

```
Rename: src/features/projects/, and the files inside that carry the name (project-flows.ts, require-project.ts, the components)
Rename: projectsShell, its id, its href, its message keys (projects.nav, projects.task...) and the limit key of its quota, in its shell.ts, and its line in src/features/registry.ts
Rename: src/models/project.ts, its export in src/models/index.ts, and the table and the indexes inside
Rename: src/app/[locale]/(app)/(shell)/projects/ and its [projectId] folder, and "/projects" in APP_PATH_PREFIXES (src/shared/config/app.ts)
Rename: the limit projects of the plans, in limits and in LIMIT_LABELS (src/features/billing/plans.ts), and in the limits of the plans of scripts/seed.ts if you wrote it there: the quota is counted against it
Rename: the message billing.limits.projects, which the billing page reads for that limit (src/features/billing/components/billing-settings.tsx), and the case that checks it (tests/unit/billing/billing-settings.test.tsx)
Rename: the events project.created, project.updated and project.deleted, in src/features/events/types.ts and src/features/webhooks/available-events.ts
Rename: in src/locales/en.json and fr.json, the groups projects, quotas.projects, billing.limits.projects, activity.project and webhooks.event.project
Rename: the demo rows of scripts/demo-data.ts, and the project test of tests/screenshots/readme.screenshots.ts
Rename: tests/unit/projects/, tests/integration/projects*, and seedProject in tests/helpers/seed.ts
```

The tests that name the entity change with it: the ones the removal above lists, and the cases that read the limit and the events (`tests/integration/billing-plan.test.ts`, `tests/integration/billing-helpers.test.ts`, `tests/unit/billing/billing-settings.test.tsx`, `tests/unit/webhooks/create-endpoint.test.tsx`, `tests/unit/home/`). Then run `npx eslint . --fix`, which sorts the imports under their new names, and `npm run db:generate`. It asks whether the new table is created or renamed from `project`: choose the rename, so that the migration renames the table and keeps its rows. This grep finds nothing once the names are changed. It reads the code, the messages and the seeds, and leaves out the stories:

```bash
grep -rnE --exclude='*.stories.tsx' 'projectsShell|features/projects|models/project|schema\.project|["`]/projects|"projects?"[[:space:]]*:|projects\.(nav|task)|quotas\.projects|limits\.projects|project\.(created|updated|deleted)|resourceType: "project"|\bprojects:|\bprojectId\b|\bPROJECTS\b' src/features src/models src/app src/locales src/shared/config scripts
```

A story, a comment or a test of a shared component that says "projects" as an example fails nothing: leave it, or change it when you like.

## Phase 4: Customize the Project

### Branding

- Set `APP_NAME` and `HELP_URL` in `src/shared/config/app.ts`. `APP_NAME` is the name of the product: the tabs of the browser, the metadata, the footer and the logo of the shell. `HELP_URL` is where the Help entry of the navigation leads, a page or a `mailto:` link, and `null` leaves the entry out
- Draw your logo in `src/shared/components/shell/logo.tsx`: a tile with a glyph, then the name of the product. Swap the glyph, or the whole tile, for your own
- Update `src/app/[locale]/(marketing)/page.tsx` (landing page)
- `src/shared/lib/seo.ts` builds the metadata of the public pages (title, canonical address, Open Graph, Twitter card): each page passes its own description and image to `generatePageMetadata`
- Update `src/locales/en.json` and `src/locales/fr.json` (translations)

### Rebrand in one file

`src/styles/theme.css` is the brand. Colors, corners, shadows and typefaces are tokens there, and the shared components read them: none holds a color of its own. The neutral theme is called Graphite. Edit the values in `:root` (light) and their counterparts in `.dark` (dark mode).

| Token | What it sets |
|-------|--------------|
| `--brand` | The brand color: primary button, links, focus ring, quota bar |
| `--brand-2` | The second color of the signature gradient (`bg-signature`, the `signature` progress bar) |
| `--brand-on` | The ink on `--brand`: the label of the primary button and of a brand badge |
| `--typeface-ui`, `--typeface-display`, `--typeface-mono` | Body text, headings, code |
| `--corner-xs` to `--corner-dialog` | The corner radii (`--corner-card` rounds cards, `--corner-field` inputs and buttons) |

The tints, the focus ring, the quota bar, the gradient and the hover and press of the primary button (`--brand-tint`, `--brand-tint-ink`, `--focus-ring`, `--bar`, `--gradient-signature`, `--btn-primary-hover`, `--btn-primary-active`) are derived from the brand in their own rules, so they follow `--brand` with no edit. Only the two button states may need one, for a mid-tone brand (step 3). Ink, surfaces, status tones, shadows and the scrim are neutral and can stay.

1. Set `--brand`, `--brand-2` and `--brand-on` in `:root`. `.dark` has its own copy of the three: a lighter `--brand` and `--brand-2`, and a `--brand-on` that suits the lighter brand (a dark ink, where the light theme has white).
2. Change the typefaces. `src/styles/fonts.ts` loads them with `next/font` (Geist by default) and exposes the variables `--font-geist-sans` and `--font-geist-mono`, which `--typeface-*` read in `theme.css`. Swap the fonts in `fonts.ts`, and point `--typeface-*` at the new variables, together.
3. Run `npx vitest run tests/unit/ui/theme-contrast.test.ts`. It measures every text and background pair of the theme, in light and in dark (text 4.5:1, controls 3:1), so a brand color too light for its label fails there before anyone sees it. A mid-tone brand (a red, an orange) often needs a dark `--brand-on` and a hover and a press that lighten the button instead of darkening it. Edit the derived rule itself: in the `:root, [data-brand-scope]` rule, change the `#000` of `--btn-primary-hover` and `--btn-primary-active` to `#fff`. Do not override the two tokens in the first `:root` block: that rule has the same specificity and comes before the derived one, so the derived one wins. (The `.dark` rule already mixes with `#fff`.)
4. Run `npm run storybook` and open Foundations > Other brand: one container rebranded with inline tokens, with the header, buttons, badges, progress bar, card and segmented control inside. Compare it with the other stories, in light and dark. It is the recipe above, written as an inline style.

Good to know:
- The contrast test reads colors written as hex (`#2557F2`), `var(--token)` or `color-mix(in oklab, …)`. Keep the brand tokens in those forms: `oklch()`, `hsl()` and `rgb()` stop it with an "Unsupported color" error instead of a measure.
- `bg-signature`, the gradient from `--brand` to `--brand-2`, is decorative (a bar, an edge, an illustration). Never put text on it: the tests hold its ends to 3:1 as a graphic, not to 4.5:1 under text.
- A new color token needs a value in `.dark` and a place in the lists of `theme-contrast.test.ts` (`REQUIRED_TOKENS`, and a pair if text sits on it).
- A raw palette color or a hex color in `src/shared`, `src/features` or `src/app`, and a `font-family` anywhere in `src`, fails `tests/unit/ui/no-raw-palette.test.ts`: write the value in `theme.css` (or `fonts.ts`) and use the token. The exceptions are listed in the test, each with its reason: the logos of third-party services (`social-buttons.tsx`, `connected-accounts.tsx`), the second brand of the "Other brand" story (`other-brand.ts`), the pages drawn outside the theme (`global-error.tsx`, `not-found.tsx`), the e-mail templates (`src/features/email/templates`), and the two files that name the typefaces (`theme.css`, `fonts.ts`).

To rebrand one subtree (a preview, a section), set `data-brand-scope` and an inline `--brand` on its root:

```tsx
<div data-brand-scope style={{ "--brand": tenant.color } as React.CSSProperties}>
  {children}
</div>
```

A derived token is computed where it is declared, so a `--brand` set lower in the tree does not reach the tints, the ring, the bar, the gradient or the button states computed on `:root`. `data-brand-scope` makes `theme.css` declare them again on that element, from its own `--brand`. Without it, the primary button takes the new color and keeps the old hover, ring and bar. The corners, the typefaces and `--brand-2` can be set inline the same way.

`data-brand-scope` covers its own DOM only. The layers that Radix renders in a portal under `document.body` (DropdownMenu, Select, Popover, Tooltip, Dialog, Sheet) sit outside the element, so they keep the brand of the page. So does the toaster, which is mounted once at the root of the layout. Choose the scope that fits:

- **An app-wide or per-tenant brand:** set the tokens on `<html>`, as a `:root` override after `theme.css` or inline (the `style` of `<html>` in the layout). The derived tokens recompute there and no attribute is needed. The color then applies in light and in dark alike. A `:root` override can give dark its own value: write a `.dark` rule after it. An inline `style` on `<html>` beats any `.dark` rule, so a different dark value has to be set from script each time the `dark` class of `<html>` changes. Or skip the inline style and emit a `<style>` element with a `:root` rule and a `.dark` rule instead (the layout can write one from the tenant's colors).
- **A true subtree:** also render its portals into the scoped element, with the `container` prop of the Radix `Portal`. The wrappers in `src/shared/components/ui/` render a bare `Portal` today: add the prop where you need it.

### Dark mode

`next-themes` puts the `dark` class on `<html>`. It follows the system, and `ThemeToggle` (in the headers) overrides it. `.dark` in `theme.css` holds the tokens that change: ink, surfaces, brand, tones, shadows, scrim. The corners and the typefaces are shared. For a new color token, write the dark value next to the light one and run the contrast test, which checks both modes. In Storybook, the Theme toolbar flips the class and the Language toolbar switches between en and fr.

### Add a component with shadcn

`npx shadcn add <name>` writes the component to `src/shared/components/ui/` and it takes the theme with no further work: `components.json` points at `src/styles/global.css`, which maps every shadcn color name (`bg-primary`, `text-muted-foreground`, `border-input`, `bg-popover`...) to a token of `theme.css`. Run it in a terminal. A component that is built on others that the project already has (`sidebar` uses `button`, `separator`, `sheet`, `tooltip`, `input` and `skeleton`) asks "overwrite?" for each of them, and `--yes` does not answer: without a terminal the command installs its packages, writes no file and exits 0. Answer no to each, so that the versions of the design system stay.

The CLI also adds its own packages to `package.json` (`sidebar` brings `cn` and `radix-ui`, and its file imports `cn` from that package, not from `@/shared/utils/cn`), and the file it writes breaks the import order and two other rules: run `npx eslint . --fix`. The variables that the sidebar reads through `var()` (`--sidebar-border`, `--sidebar-accent`...) are defined in `src/styles/global.css`, as aliases of the sidebar tokens in light and in dark. The CLI finds them there and writes none of its own `hsl()` colors, so the sidebar follows the theme: keep `components.json` pointing at that file. Then run `npm run test`: `tests/unit/ui/no-raw-palette.test.ts` lists any raw Tailwind color or hex the generated code brings (`text-white`, `bg-red-500`, `fill="#fff"`), to swap for a token (`text-primary-foreground`, `bg-danger`).

### Database models

Add your business models in `src/models/`. Follow the existing pattern:

```typescript
// src/models/my-model.ts
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const myModel = pgTable("my_model", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("my_model_org_id_idx").on(t.organizationId),
]);
```

Then export it from `src/models/index.ts` and run `npm run db:generate`.

A Better Auth plugin added in `src/features/auth/auth.ts` needs its tables and columns in `src/models` (otherwise Better Auth refuses every request with `SCHEMA_MISMATCH`) and a migration for them, and `tests/integration/auth-schema.test.ts` catches a mismatch.

### App shell

The signed-in app is drawn by one shell, laid out by the width of the screen: a sidebar from 1024 px, a header with a Menu button that opens a drawer from 480 to 1024 px, and under 480 px a tab bar whose last tab, More, opens the drawer. The shell (`src/shared/shell` and `src/shared/components/shell`) knows no feature. A feature that appears in the shell says what it adds in a `shell.ts` that exports a `FeatureShell`, and `src/features/registry.ts` lists those features, in the order the shell reads them.

Every field of `FeatureShell` (`src/shared/shell/contract.ts`) but `id` is optional:

| Field | What it adds |
|-------|--------------|
| `id` | The name of the feature |
| `nav` | Links of the sidebar and of the tab bar, in the main, secondary or admin list |
| `settings` | Tabs of the settings pages |
| `account` | Links of the account menu |
| `plans` | The plan of each of the workspaces it is given, read together (one query for all of them): its name, its limits, where to upgrade and from which role (`upgradeMinRole`: below it, the quota cards have no Upgrade link). The first feature of the registry that gives them is the one asked, once per request, for every workspace of the person |
| `quotas` | Figures counted against a limit of the plan, on the home and in the account menu. They are shown, not enforced: see below. The shell counts them while it reads the plans, and shows the ones the plan has a limit for. A `usage` that asks for what other quotas or steps ask for (a count) wraps its query in React's `cache()`, so that a request reads it once |
| `tasks` | First steps of the home, done or not |
| `activity` | The latest events of a workspace, for the home. The first provider is the one asked |
| `homeSections` | Blocks of the home page |
| `HomeAction` | The main action of the header of the home. The first one wins |
| `Provider` | A component that wraps the shell, for what its pages share (a client store, a poller) |
| `Notifications` | The bell. The first one is drawn |
| `SidebarActions` | Rows under the secondary navigation |
| `onWorkspaceDelete` | What the feature cleans up on the server before a workspace is deleted, outside the rows that go with it: billing cancels the subscription, upload deletes the stored files. The cleanups run in `order` (one that may be refused before one that cannot be undone); one that throws keeps the workspace, and its `failureKey` says why. `run` answers the message key of what it did, shown when a later step keeps the workspace (billing's says that the subscription is cancelled already), or `null` |

**Plan limits are shown, not enforced yet.** A quota card says how much of a limit is used (members, projects, uploads, AI credits), and nothing stops a workspace from going over it: the server actions that create a project, invite a member or upload a file do not compare the count with the plan. The example entity is the model people copy, so the check goes in its action when a limit must hold: read the plan of the workspace (`getWorkspacePlan` in `src/features/billing/queries.ts`), count, and refuse in `createProject` (`src/features/projects/actions.ts`) before it writes.

To add a feature, write its `shell.ts`, then add its line to `FEATURES` in `src/features/registry.ts`. `tests/unit/shell/boundaries.test.ts` fails when a `shell.ts` is not listed there, and when something in `src/shared` imports a feature.

```ts
// src/features/tickets/shell.ts
import type { FeatureShell } from "@/shared/shell/contract";
import { TicketIcon } from "lucide-react";

export const ticketsShell: FeatureShell = {
  id: "tickets",
  nav: [
    {
      id: "tickets",
      section: "main",
      href: "/tickets",
      labelKey: "tickets.nav", // a full message key: add it to both locale files
      icon: TicketIcon,
      order: 25, // ascending: Projects is 20, the assistant is 30
    },
  ],
};
```

The page goes under `src/app/[locale]/(app)/(shell)/tickets/`, and its prefix, `"/tickets"`, goes in `APP_PATH_PREFIXES` (`src/shared/config/app.ts`) so that the proxy sends a visitor with no session cookie to sign in.

**The proxy is not the protection.** It only checks that a session cookie exists: it cannot tell a valid one from a forged or an expired one, and its matcher leaves out every address that holds a dot. Every page that reads data calls a guard first, which checks the session, the workspace and the role: `requireAuth()`, `requireWorkspace()` (a page takes its workspace from it, never from a parameter), `requireAdmin()` or `requireRole(orgId, minRole)`. A page without one shows its data to whoever sends any cookie.

**A redirect keeps the language.** A guard that sends someone away (`/sign-in`, `/dashboard`, `/onboarding`) calls `redirectTo()` (`src/features/auth/redirect-to.ts`), which reads the language of the request and sends to `/fr/sign-in`, not to a bare `/sign-in` that the proxy would redirect a second time. A page or a layout, which receives `params`, uses the localized `redirect` of `@/shared/lib/i18n-navigation` with its `locale`. No file of `src` imports `redirect` from `next/navigation` (`tests/unit/localized-redirects.test.ts`).

**Page families.** A page of the app is headed by `PageHeader` (`src/shared/components/data/page-header.tsx`): a tile, the title, a context line, one main action, a « ⋯ » menu for the others, and the tabs. The page of one thing that lives in a list is headed by `EntityHeader` (`entity-header.tsx`, in the same folder): the trail back to the list, its name, its actions and its tabs. A page uses one of the two, never both. `SettingsNav` (`src/shared/components/shell/settings-nav.tsx`) draws the tabs of the settings pages from the `settings` entries of the features: every settings page puts `<SettingsNav />` in the `tabs` of its `PageHeader`. `tests/unit/settings/settings-family.test.ts` lists the settings pages and fails when one has no header, no tabs or no title, or when a folder is missing from its list.

**States of a route.** Every page of the signed-in app has a loading state, an error boundary and, inside the shell, a not-found:

- `loading.tsx` draws a skeleton to the size of the page, inside `LoadingRegion`.
- `error.tsx` draws `RouteError` with the `retry` of the boundary, and reports the error with `useReportError(error)`.
- `(shell)/not-found.tsx` stays in the shell.

The files sit in the folder of the page or in one above it: `(shell)/error.tsx` covers the pages that have none of their own. `tests/unit/app/route-states.test.ts` reads the folders, so a page you add is checked with nothing to list. It fails when a page has no loading state, no error boundary or no title, and when a loading state sits above a layout that decides a 404 (the status of a response is sent with its first boundary).

**Titles.** Each page names its tab with `appPageMetadata(page, { context })` from `@/features/app-shell`, in its `generateMetadata`. The title is the page, then the workspace (or the `context` you give), then `APP_NAME`: `Projects · Acme — SaaS Boilerplate`. The page is kept out of search engines.

### New features

Create a new feature module following the pattern:

```
src/features/my-feature/
  shell.ts         # If the feature appears in the app shell, what it adds (see "App shell")
  actions.ts       # Server Actions ("use server"), each starting with a guard
  queries.ts       # Server reads (import "server-only", never "use server")
  components/      # React components
  hooks/           # Client-side hooks
```

**Rule:** `queries.ts` uses `import "server-only"`, never `"use server"`. `actions.ts` uses `"use server"`, and every exported function starts with a guard: `requireAuth()`, `requireAdmin()` or `requireRole(orgId, minRole)`, taking the user from the session, never from an id sent by the client. Every function exported from a `"use server"` module can be called by any browser with a direct POST and arguments of its choice. `tests/unit/server-action-conventions.test.ts` fails the CI otherwise.

If it has a `shell.ts`, list the feature in `src/features/registry.ts`. Give each of its pages the three states of a route (see "App shell"). Put its tests where Phase 3 looks for them, so that removing the feature removes them: its units in `tests/unit/<feature>/`, and the tests of its pages in `tests/integration/<feature>*` (`billing-page.test.tsx`, `projects-pages.test.tsx`; the admin pages: `admin-*-page.test.tsx`).

### Screenshots

The pictures of the README are taken from the app by a script, so that they stay true to it: `docs/screenshots/` holds one picture for each page and device.

```bash
npx playwright install chromium   # once
npm run screenshots
```

Before you run it: stop `npm run dev`; port 3089 must be free (the script serves the app there and stops if something else holds it); and the machine needs a network connection, because the build downloads the Geist font from Google Fonts. The script builds the app on a throwaway database, seeds its own under `.screenshots/` with the demo workspace of Phase 5, serves the app on port 3089, signs in as one of the demo people and writes the 15 PNG files to `docs/screenshots/`. To add a picture, add a test to `tests/screenshots/readme.screenshots.ts`.

## Phase 5: Initialize Database

```bash
# Generate migrations from your schema changes
npm run db:generate

# Apply migrations to PostgreSQL (needs DATABASE_URL; it cannot reach the PGlite ./local.db)
npm run db:migrate

# Seed with default plans and admin user. It applies pending migrations first: with PGlite this
# is the command that creates or upgrades ./local.db, and it is safe to re-run. Stop npm run dev
# first: it holds ./local.db while it runs, and the seed refuses a directory another process holds.
npm run db:seed
```

The seed creates:
- 3 billing plans (Free, Pro, Enterprise)
- 1 admin user: `admin@example.com` / `admin123`
- 1 dev user: `dev@example.com` / `admin123`
- A demo workspace, with three people (`camille@example.com`, `lea@example.com` and `tom@example.com`, all with the password `admin123`) and two workspaces. Acme is on the Pro plan: the three of them, 12 example projects, a month of use, an assistant conversation and some activity. Northwind is on the Free plan, with Camille alone, and has the credits of that plan for the month, so the assistant answers in both workspaces. The pictures of the README are taken from it.

You can sign in immediately with any of these accounts — no SMTP or OAuth setup needed. They have a known password, so the seed makes them outside production only, and on a local database only: with `NODE_ENV=production` it writes the plans and nothing else, and when `DATABASE_URL` names a host other than `localhost`, `127.0.0.1` or `::1` it writes the plans, says that it refuses the accounts and how to ask for them (`SEED_DEMO=1`). The host is the one `pg` connects to: a `host` parameter (`postgres://user@localhost/app?host=db.example.com`) replaces the one in front of it, so it is not taken for local. An address that names no host is not local, because the machine behind it comes from `PGHOST`, which the seed does not read. The path of a socket is this machine, and is still asked to confirm with `SEED_DEMO=1`: the seed takes no database for its own that is not named `localhost`, `127.0.0.1` or `::1`. The seed prints the database it targets before it connects: the host and port of `DATABASE_URL` (never its user, password or database), `socket` or the path of the socket when the address names no host, or `local PGlite (<directory>)`.

`db:seed`, `db:migrate` and `db:generate` read the `.env*` files the way `next dev` does, so a `DATABASE_URL` in `.env.local` is the one they use. A variable that is already set in your shell wins over the files, even when it is set to nothing.

### Where the local database lives

PGlite keeps its data in the directory `./local.db`. `PGLITE_DATA_DIR` names another one: a path (its missing parent folders are created), a `file://` path, or `memory://` for a throwaway database that lives as long as the process. The app and the seed read it the same way. With `DATABASE_URL` set, both use PostgreSQL instead.

### One process at a time on `./local.db`

PGlite is PostgreSQL running inside the process that opens the directory, with no server to share it: two processes on one directory break it for good, even if one of them only opened it. So:

- **The app opens it at its first query**, not when its code is loaded. `next dev` loads each page in a worker of its own, and `next build` loads all of them in a pool of worker processes: none of them queries, so none of them opens the directory. Only the server does.
- **A process locks the directory before it opens it.** The lock is a file in it, `process-<pid>.lock`, which says how that process was started (`npm run dev`), and it goes when the process exits. A lock whose process is gone (killed) is taken over. Within one process, the app and a script share one client per directory (`openPglite()`): close it only when the process is done with the directory.
- **While a process holds it, another one is refused.** The seed, run while `npm run dev` holds `./local.db`, stops at once with:

  ```
  Seed failed: Error: The local database ./local.db is open in another process: pid 12345 (npm run dev). Two processes on one PGlite directory break it, so this one does not open it. Stop `npm run dev` first, then run this command again: it holds the database for as long as it runs. Or set PGLITE_DATA_DIR to give this process a directory of its own. If no process of yours has it open, the lock is left over: delete local.db/process-12345.lock.
  ```

  It means what it says: stop the process it names, or give the second one a directory of its own (`PGLITE_DATA_DIR=.scratch/db npm run db:seed`; git ignores `.scratch/`). When the holder is another command, the seed, say, the message asks to wait for it to end, or to stop it: `npm run dev` meets this when its first query comes while the seed runs, and its next query tries again. In one checkout, Next refuses a second `next dev` before it makes any query ("Another next dev server is already running"): only a process from another checkout whose `PGLITE_DATA_DIR` names the same directory reaches the lock. The end-to-end tests and the screenshots already run on directories of their own (`.e2e/`, `.screenshots/`). Delete the lock file only when no process with that pid has the database open: after a restart of the machine, a new process can have the old pid.
- **The Drizzle commands never open it.** `db:migrate` and `db:studio` talk to PostgreSQL only (`DATABASE_URL`, or `postgresql://localhost:5432/boilerplate` without one), and `db:generate` opens no database. The seed is what migrates `./local.db`, under the lock.

### A broken `./local.db`

A directory that was opened by two processes at once cannot be opened again. Every query then fails, and the app answers 500 (sign-in included). The server log gives the cause of each failed query:

```
The local database ./local.db cannot be opened: PostgreSQL could not start on it. It is broken, most likely because two processes had it open at once. Stop the processes that use it (`npm run dev`), delete it, then run `npm run db:seed` to make it again: what it held is lost.
```

To recover, stop `npm run dev`, then:

```bash
rm -rf local.db      # or the directory PGLITE_DATA_DIR names
npm run db:seed      # a new database, with the plans and the demo accounts
npm run dev
```

What the directory held is lost: the seed makes the demo data again, not what you added.

## Phase 6: Verify Everything Works

```bash
npm run dev          # Start dev server
npm run lint         # Should be 0 errors
npm run check:types  # Should be 0 errors
npm run test         # All tests should pass
npm run build        # Production build should succeed
```

## Phase 7: Deploy

### Vercel (recommended)

1. Push to GitHub
2. Import in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Docker

```bash
npm run docker:up
```

### Post-deploy checklist

- [ ] Set all production environment variables
- [ ] Run `npm run db:migrate` on production database
- [ ] Run `npm run db:seed` with `NODE_ENV=production` for the plans
- [ ] Configure Stripe webhook endpoint: `https://your-app.com/api/stripe/webhook`
- [ ] Configure OAuth redirect URIs with your production URL
- [ ] Test sign-up, sign-in, and email flows
- [ ] Switch CSP from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `next.config.ts` after verification
