# Reference Interface — Design Spec

**Date:** 2026-11-01
**Scope:** The reference UI of the boilerplate: visual foundation, signed-in shell, shop. Delivered in three PRs.
**Status:** In progress — PR 1 (visual foundation) in review, PRs 2 and 3 planned

---

## Context

The boilerplate is a public product. It has to attract and serve anyone who starts a SaaS, not only the maintainer's own projects. Its first screen, the README, has to make a developer want to clone it.

Until this work, the interface was functional but generic, and every project replaced it with its own. The goal is that any SaaS started from the boilerplate has product-grade screens from day one:

- **A purchase path:** prices, payment, subscription.
- **A navigation shell** for the signed-in app.
- **Screens and their states:** loading, empty, error.
- **A design system** that a project rebrands in one file.

There is no generic interface left to redo in each project.

### Decisions

Taken by the maintainer:

- **A neutral brand, replaceable by each project.** The reference interface has a product-grade structure and a neutral default theme; each project brings its own brand.
- **The default theme is "Graphite":** a cool near-black ink, white and pale gray surfaces, one blue brand color and a cyan companion for the signature gradient.
- **Order of the work:** this spec first (visual foundation, navigation shell and shop, wired to what already exists), then a launch kit, guard rails, and a generation chain for the project generator.

---

## Goals

1. **Visual foundation.** The Graphite tokens (light and dark), the typefaces, the type scale, the primitives and the screen states. A project's brand fits in **one token file**.
2. **Navigation of the signed-in app:** the shell (sidebar, drawer, bottom tabs), the workspace switcher, the account menu, the notification bell, page headers, and a loading and error state for every route.
3. **Shop:**
   - the whole purchase path: public prices, plan choice after sign-up, embedded Stripe payment in the brand, returns, a Billing page;
   - plan limits enforced on the server and covered by tests;
   - the monthly credits of each plan granted;
   - the payment e-mails sent.
4. **A showcase in the repository:** a README that shows the product through screenshots of the real interface, refreshed in each PR (see Delivery).

## Non-goals

- **Launch kit:** the marketing landing page (except the public header and footer that the pricing page needs), analytics, the cookie banner, the favicon, the logo and the share image, the new-password page.
- **Guard rails (a later PR):** end-to-end tests in CI and other automated checks.
- **Generation chain:** the steps of the project generator.
- **Features specific to one product.** A project adds its own on top of the generic ones.

## Anti-goals

A failure even when everything works:

- **A brand that is not neutral.** The repository ships the Graphite theme and no other product's name, logo, colors or typefaces. The guards exempt the Google sign-in logo, which keeps its own colors, and three standalone surfaces that render without the theme (global error, not found, email layout).
- **A spreadsheet look:** bare tables, gray icons, figures without context. Screens are clean without being austere.
- **Raw Tailwind classes** that rebuild by hand what a design-system component provides.
- **Broken feature removal.** `docs/SETUP.md` (Phase 3) lets a project delete features. Removing billing, notifications or upload must leave the shell, the types and the build green.
- **A regression of the server conventions:** `server-only` reads, a guard on the first line of every action, `PUBLIC_ACTIONS`.

## Constraints

- **Stack:** Next.js 16 (App Router under `src/app/[locale]/`), Tailwind 4 (tokens in `src/styles/global.css`, `@theme` block), shadcn "new-york" with the Radix primitives already present, next-intl (English by default, French), next-themes (light, dark, system), Drizzle, Better Auth (organizations), Stripe (`src/features/billing/`), Inngest, Storybook 10, Vitest, Playwright; npm.
- **CI:** Lint, Type Check, Tests and Build stay green, with Storybook Build and Security Audit. So does the server-action conventions test (`tests/unit/server-action-conventions.test.ts`).
- **New dependencies:** published for at least seven days (`npm --before=<date>`), and justified one by one.
- **Copy:** every visible string goes through `src/locales/en.json` AND `fr.json` (`CONTRIBUTING.md`). French addresses the reader with "vous".
- **Accessibility (AA):**
  - text 4.5:1, controls and field borders 3:1;
  - a visible focus: 2 px of surface, then a 4 px ring;
  - 44 px targets, `prefers-reduced-motion` respected, real `<button>` and `<a>`.
- **UX rules:**
  - **Buttons:** one primary button per zone; the other actions go in a "⋯" menu (`DropdownMenu`).
  - **Color and badges:** no accent color on what is not the main information; badges stay small (12 px).
  - **Indicators:** never doubled; an explicit unit when two counters differ.
  - **Visuals:** cards rather than tables when there are few items; icons in tinted tiles; initial tiles for entities.
  - **Text:** little of it, in whole sentences.
  - **Pages:** the pages of one family look the same (see Page families).
- **Visual check:** done by eye by the maintainer, not by Playwright. Each PR ships a checklist for it.
- **For everyone:**
  - neutral, international defaults: English by default with complete French, dollars by default;
  - every option documented in `docs/SETUP.md`;
  - no assumption about hosting, accounts or organization;
  - every addition (example entity, credit packs, trial, VAT) is a module that can be removed or switched off, like the existing features.

---

## 1. Visual foundation (PR 1)

### 1.1 The Graphite tokens

`src/styles/theme.css` is the brand: light values in `:root`, dark values in `.dark`. The tokens derived from the brand (tint, ring, bar, gradient, primary button states) are computed from `--brand` in their own rules, which also match `[data-brand-scope]`. `src/styles/global.css` maps the tokens to Tailwind utilities (`bg-surface`, `text-ink-muted`, `bg-success-bg`...). The values below are the ones shipped.

| Role | Token | Light | Dark |
|---|---|---|---|
| Ink | `--ink` / `--ink-soft` / `--ink-muted` | #101217 / #3B404C / #5F6676 | #EEF1F5 / #C2C7D0 / #9AA1AE |
| Surfaces | `--surface` / `--surface-sunken` (page) / `--surface-raised` | #FFFFFF / #F5F6F8 / #F9FAFB | #14171D / #0E1014 / #1A1E25 |
| Lines | `--hairline` (cards) / `--control-border` (controls, 3:1) | #E2E5EA / #7D8495 | #262B34 / #6B7385 |
| Brand | `--brand` / `--brand-on` | #2557F2 / #FFFFFF | #6189FF / #0A1230 |
| Gradient end | `--brand-2` | #1991A7 | #3CCBE0 |
| Derived | `--brand-tint`, `--brand-tint-ink`, hover, press | `color-mix(in oklab, …)` from `--brand`; hover and press darken | same rules; hover and press lighten |
| Aliases | `--focus-ring`, `--bar` | `var(--brand)` | `var(--brand)` |
| Gradient | `--gradient-signature` | 135°, `--brand` to `--brand-2`, once per screen at most | same |
| Success | `--success` / `--success-text` / `--success-bg` | #1F9D55 / #157A43 / #E4F5EB | #34C77B / #5FD69A / #12291D |
| Warning | `--warning-bg` / `--warning-text` / `--warning-bar` | #FFF1D0 / #7A4A00 / #B87A00 | #2E2410 / #F5C451 / #E3A91E |
| Danger | `--danger` / `--danger-text` / `--danger-on` | #D92D20 / #B42318 / #FFFFFF | #F0584A / #FF8A80 / #1A0503 |
| Quotas | `--track` / `--bar` | #F0F2F5 / `--brand` | #232831 / `--brand` |
| Sidebar | `--side-bg` / `--side-active-bg` / `--side-hover-bg` | #FFFFFF / #E6EBF4 / #F2F4F8 | #11141A / #222833 / #1A1F27 |
| Initial tiles | `--tone-1…4` / `--tone-1…4-ink` | #E3EAFD/#1E3FA3, #DDF2F5/#0F5F6B, #ECE7FB/#4A2F99, #FBE7E2/#8C3521 | #1C2A55/#AFC3FF, #12343A/#8FE0EC, #2A2152/#C9B8FF, #3A1F19/#FFB4A3 |
| Corners | xs / sm / field / card / dialog | 6 / 8 / 10 / 14 / 18 px | same |
| Shadows | card / popover | `0 1px 2px rgba(16,18,23,.04)` / `0 18px 40px -20px rgba(16,18,23,.25)` | black, stronger, no ring |
| Typefaces | UI and display / mono | Geist / Geist Mono | same |

`--brand-2` is darker than a pure cyan on purpose: the signature gradient ends against `--track`, which asks 3:1. The dark values were tuned the same way, against the pairs the components really use.

- **Buttons.** The primary button is flat, in `--brand`, with a discreet inner shadow at the bottom (2 px, `--btn-primary-edge`). The `outline` button is white with the `--control-border` line. The drop on press is a token (`--btn-press`, 0 in Graphite). The treatment lives in `--btn-*` tokens, so another theme changes it without touching the component.
- **shadcn compatibility.** The variable names (`--color-primary`, `--color-muted-foreground`...) and the variant names (`default`, `outline`, `secondary`...) are kept: a component added with `npx shadcn add` takes the theme. "Primary" in this document is the `default` variant.
- **Type scale:** caption 12, meta 13, body 14, section 16 (semi-bold), panel 20, page 28 and key 40 px. Content is 1,120 px wide at most. The base body is 14 px: the app keeps it, and the public pages read at 16 px.
- **Motion:** `cubic-bezier(0.2, 0, 0, 1)`, 150 to 320 ms for controls; up to 500 ms for sheets.
- **Typefaces** load through `next/font/google`: no new dependency.

### 1.2 Primitives

The Radix primitives of the boilerplate are kept, for accessibility, and restyled.

- **Button:** variants default, destructive, outline, secondary, ghost, link; sizes default, sm, lg, icon, icon-sm; `loading` (with `loadingText`) and `disabledReason`, a tooltip that says why the button is disabled.
- **Small elements:** Badge (tones neutral, brand, success, warning, danger, outline; sizes sm and md; an optional dot), TextLink, Spinner.
- **Forms:** Input, Textarea, PasswordInput, Field (label above, hint or error below), Select, Checkbox, Switch, SegmentedControl, OptionCards.
- **Navigation and menus:** Tabs (keyboard navigation), DropdownMenu, Popover, Tooltip. The floating layers share one surface (`popover-styles.ts`).
- **Containers:** Card, List and ListRow, IconTile, StatCard, DataTable; Dialog (sm, md, lg, with header, body and footer), ConfirmDialog, Sheet.
- **Feedback:** Toast (sonner, restyled: success 6 s, undo 10 s, errors until closed), PageAlert (one under the title), InlineStatus (in progress, success, failure), StatusDot, ProgressBar (signature and quota tones, "almost out" from 80 % and "limit reached" at 100 %).
- **Storybook:** stories for most primitives and for the states, in light and dark (Theme and Language toolbars), with the a11y addon.
- **Contrast tests** (`tests/unit/ui/theme-contrast.test.ts`) measure the token pairs the components really use, in both modes.

### 1.3 Screen states and the page header

- **EmptyState:** an icon in a tinted tile, or an illustration the project provides; one sentence; one button.
- **ErrorState:** a "Try again" button, `role="alert"`.
- **Skeletons:** page header, row of cards, list, table. A page made of skeletons sits in `LoadingRegion`, which announces "Loading" once.
- **PageHeader:** a tile, the title (H1) with its context line, one primary action and the "⋯" menu for the others, then one alert and tabs when needed. It stacks on a phone and sits on one row from `sm`.

### 1.4 Rebranding

- **One file.** A project changes `--brand`, `--brand-2`, `--brand-on` (each with its `.dark` counterpart) and the typefaces. The steps are in `docs/SETUP.md` (Phase 4).
- **Proof.** A story, "Other brand", rebrands one container with inline tokens and nothing else.
- **Subtrees.** `data-brand-scope` rebrands the DOM of one element. The layers that Radix renders in a portal under `document.body` (menus, selects, popovers, tooltips, dialogs, sheets) sit outside it, and so does the toaster, mounted once at the root of the layout; for an app-wide or per-tenant brand the tokens go on `<html>`.
- **Guards.** `tests/unit/ui/no-raw-palette.test.ts` refuses raw palette colors, hex colors and font families in components: their values live in `theme.css` and `fonts.ts`. It exempts the Google sign-in logo, which keeps its own colors, and three standalone surfaces that render without the theme (global error, not found, email layout).

---

## 2. Navigation of the signed-in app (PR 2)

### 2.1 Shell

- **Frame:** a "Skip to content" link, then `main id="content"`.
- **Screen sizes:**
  - **from 1,024 px:** a 248 px sidebar;
  - **480 to 1,024 px:** a header with "Menu" (which opens a drawer), the logo and the bell;
  - **under 480 px:** a bottom tab bar with at most five entries, "More" included.
- **Sidebar:**
  - the logo and the bell;
  - the **workspace switcher** (the organization): the existing `org-switcher`, with search, creation of a workspace and the current plan;
  - the main navigation;
  - "Settings" and "Help";
  - the account row.
- **Account menu:** the existing `user-menu`. Avatar and name; plan and quotas, detailed when a limit is near; Account, Billing, theme, language, switch workspace, sign out.
- **Notifications:** mount `notification-bell` and its panel. A dot only for what needs action; the count is read again at an interval while the tab is visible.
- **Feedback:** mount `feedback-button`.
- **Navigation registry.** Each feature declares its entries (navigation, account menu, home). The shell imports no feature by hand: removing a feature removes its entries.

### 2.2 Workspace home

- **Header:** a tile, `Hello {first name}`, and the context `{workspace} · {plan} plan`.
- **Quota cards,** from the limits of `PLANS` (members, projects, storage, AI credits): bars that fill, "Almost out" at 80 %, "Limit reached" at 100 % with an action link. A card shows only if its feature is present.
- **"To do":** first steps, each declared by its feature (connect Stripe, invite the team...), with "n of m".
- **"Activity":** the latest events of the workspace, from the audit log or the notifications, four or five rows.
- **Recent projects:** with the example entity (see Resolved choices).

### 2.3 Page families and settings

- **Global pages:** Account, Team, Billing, Developers (API keys and webhooks), Notifications. Their `PageHeader` has a 56 px tile, a 28 px H1, a context line, one primary action and "⋯", one alert, and tabs if needed.
- **Entity pages:** breadcrumb, a 24 px bold H1, a short description. The two families are not mixed.
- **Settings:** the six `/settings/*` routes are linked to each other and grouped by these families, with redirects from the old addresses.
- **Tab titles:** every page exports one, as `{page} · {workspace} — {product}`.
- **Loading, error, not found:** every route group of the signed-in app has a `loading.tsx` (a skeleton faithful to the page), an `error.tsx` (ErrorState) and a `not-found`.

---

## 3. Shop (PR 3)

`PLANS` stays the only source of prices.

### 3.1 Public prices

- **Page and section:** a `/pricing` page, and a section the launch kit's landing page reuses. The public header holds the logo, the navigation, "Sign in" and "Free trial", with a menu on phones. The public footer is compact.
- **Toggle:** monthly or yearly in a SegmentedControl, with the discount read from `PLANS`.
- **Plan cards:** three cards, one recommended (a brand ring, no wash). The price rolls when the period changes. One button per card, before the "Included" list, and three reassurance items.
- **Comparison and FAQ:** an accessible comparison table (it scrolls inside its box on a phone), then an FAQ in `<details>`.
- **Buy buttons:** a visitor goes to sign-up with the plan and period kept; a signed-in user goes to payment; a subscriber goes to "Your plan". "Free trial" in the header starts the trial of the recommended plan.
- **Currency and seed:** add the currency (USD by default, another by configuration) and the trial. `scripts/seed.ts` takes its prices from `PLANS`, so that the seed and the pricing page agree.

### 3.2 Plan choice, payment, returns

- **`/choose-plan`,** right after the workspace is created (payment is per workspace) or when a free account upgrades.
  - If `PLANS` has a free plan, it offers "Continue on Free".
  - The plan and period chosen before sign-up survive e-mail verification and OAuth through a short-lived cookie, and are resumed automatically.
  - It reuses the plan cards, with a "Your plan" state, and redirects to Billing when a paid plan is active. A plain member sees a notice instead: only an admin can pay.
- **`/checkout/[sessionId]`:** a summary panel on the left (what is bought, today's price, what follows, what is included) and the **embedded Stripe Checkout** in a card on the right, with loading, error ("Try again") and expired-session states. It falls back on hosted Checkout when the publishable key is missing. New dependency: `@stripe/stripe-js`.
- **Returns:** a toast "Your plan is active", then Billing, with the `searchParams` read and removed from the URL; a waiting screen that polls until the webhook has run; on cancel, back to the prices with no error.

### 3.3 Billing page

- **Content:** plan and renewal, with the payment method in the Stripe portal; the month's quotas with their warnings; credits; invoices; "Change plan" in a modal of cards, with a proration preview before confirming (`subscriptions.update`, no new Checkout); a confirmed "Cancel" zone.
- **Trial:**
  - the card is asked at entry and Stripe charges when the trial ends; the trial is set per plan in `PLANS` (`trialDays`), 14 days on the recommended plan by default;
  - an option allows a trial without a card, which falls back to Free (`trial_settings.end_behavior.missing_payment_method: cancel`);
  - one trial per owning user, whatever the number of workspaces; a used trial is recorded on the user;
  - the webhook handles the `trialing` state;
  - an e-mail goes out three days before the end (`customer.subscription.trial_will_end`), from a new template;
  - during the trial, "Change plan" changes the plan that starts at the end, with no proration; the trial and its end date show in Billing.

### 3.4 Locks and limits, enforced

- **Server:** plan limits are enforced on the server. The actions that create (members, projects, file uploads) check them and return a typed "limit reached" error, and tests prove it.
- **Interface:** one "Included in plan X" component, as a card or a line, and a full locked page. The button leads to the right plan. It is triggered by the typed error or by the known limits.
- **AI credits:**
  - the monthly credit amounts of the plans (`CREDIT_PLANS`) are granted, and renew every month **without accumulating**; a "4,120 of 5,000" card shows what is left in the period;
  - the grant is **lazy and idempotent**: at the first use in the calendar month (UTC). It works for yearly plans (`invoice.paid` comes once a year) and without Inngest;
  - the `ai_credit_ledger` distinguishes the allocation of the period from the credits bought;
  - packs never expire and are spent after the allocation;
  - the chat shows the 402 refusal with "Top up" or "Change plan"; "Top up" opens the packs.
- **E-mails:** the existing payment-success, payment-failed, subscription-cancelled and welcome templates are sent by the webhook handlers and the sign-up.
- **Free workspaces:** a user owns at most one workspace on the Free plan (configurable), so that the free allocation is per user.
- **Onboarding:** on the Free plan (one member), the "Invite" step shows the lock inline, with "Later".

### 3.5 Stripe: test account, catalog, VAT

- **Account:** a Stripe sandbox dedicated to the boilerplate, test keys only.
- **Catalog:** `scripts/stripe-catalog.ts` creates the products, prices and customer portal in test mode, idempotently (by `lookup_key`); in production it only checks. `STRIPE_PRICE_*` goes in `.env.example`, in the environment validation and in `docs/SETUP.md`. Local webhooks use `stripe listen`.
- **VAT:** Stripe Tax is optional (`STRIPE_TAX_ENABLED`, off by default). On, Checkout uses `automatic_tax`, collects the billing address and the VAT number, and prices read "excl. VAT". Off, prices carry no mention.

---

## 4. Delivery

Three **sequential** PRs: each opens once the previous one is merged and has been checked by eye by the maintainer, so that the feedback on the tokens carries forward. The next one can be prepared locally during the review. Each PR ships a checklist for that check.

1. **Visual foundation:** the Graphite tokens (light and dark), typefaces, primitives, states, Storybook, the a11y addon, contrast tests and the rebranding documentation.
2. **Navigation:** responsive shell, workspace switcher, account menu, bell, feedback, navigation registry, workspace home, page families, grouped settings, `loading` / `error` / `not-found`.
3. **Shop:** public prices, plan choice, embedded payment, returns, Billing, plan change, cancellation, trial, enforced locks and limits, credits, e-mails.

### 4.1 README showcase

- **Screenshot script:** `npm run screenshots`, with Playwright (already a dependency). It starts the app on demo data and captures the key screens in English, light and dark, on desktop (1,440 px) and on a phone (390 px). It writes optimized PNGs to `docs/screenshots/`. A project that changes its brand regenerates them with the same command. They are README images, not a visual check.
- **Demo data:** one data set, the "Acme" workspace, shared by the screenshots and by local development (`scripts/seed.ts`).
- **README:**
  - at the top, a hero image of the signed-in app, in a `<picture>` with `prefers-color-scheme` so that readers in dark mode on GitHub see the dark version;
  - one section per strength, each with its screenshot: purchase path, signed-in app, replaceable design system, organizations, AI assistant;
  - then the quick start, which is already there. The link to the showcase page on GitHub Pages (`landing/`) stays.
- **Calendar:** PR 1, a design-system board (components, in light and dark) if it is attractive; PR 2, the signed-in app and its phone navigation; PR 3, prices, payment and billing. The README is rewritten in PR 2, once the interface has something to show.

---

## 5. Acceptance criteria

- **CI:** the CI jobs stay green in every PR, and the server-action conventions test passes.
- **Theme:** the contrast tests pass in light and dark. Changing `--brand` and the typefaces in the theme file is enough to rebrand, which the "Other brand" story shows.
- **States:** every route of the signed-in app has a loading state and an error state.
- **Copy:** no hard-coded string in the components touched; `en.json` and `fr.json` complete.
- **Feature removal:** following `docs/SETUP.md`, Phase 3, for billing, notifications and upload leaves the types and the build green. Removing a feature takes its tests with it (`grep -rl "features/<name>" tests`).
- **Purchase path,** end to end in the boilerplate's Stripe sandbox. The builder replays it with the test keys, then the maintainer checks it with the checklist:
  - prices;
  - sign-up with the plan kept;
  - embedded payment;
  - the toast on return;
  - the plan active in Billing;
  - a plan change with proration;
  - cancellation;
  - the e-mails received (development SMTP).
- **Limits:** going over a limit returns the typed error and shows the lock, with tests. Monthly credits are granted, and the 402 of the chat is shown.
- **Brand:** the repository ships the Graphite theme and no other product's name, logo, colors or typefaces. Hex colors and font families stay in the theme files, which `tests/unit/ui/no-raw-palette.test.ts` checks; it exempts the Google sign-in logo, which keeps its own colors, and three standalone surfaces that render without the theme (global error, not found, email layout).
- **README:** the screenshots are current, regenerated by `npm run screenshots`, in English, light and dark, on desktop and phone. A developer who discovers the repository sees the product before any line of code.

---

## 6. Resolved choices

- **Example entity: "Projects".** `PLANS` limits "projects", and a minimal entity gives that limit something to count. It shows the card list, the tabbed detail page, the empty state and the limit lock. A project renames it or replaces it with its own entity. It is a module that can be removed.
- **Credit packs.** One-off purchases (Checkout `mode: payment`), in addition to subscriptions: packs of AI credits, which a project can remove.
- **A Stripe sandbox dedicated to the boilerplate** for tests, with its test keys. It is needed from PR 3.
- **Primitives:** the Radix primitives of the boilerplate are kept and restyled, rather than replaced by new components.
- **Payment:** embedded Stripe Checkout in a branded page, with a fallback on hosted Checkout.
- **Prices:** USD by default, for an international audience. The prices stay those of `PLANS` (29 and 99 a month, two months free on yearly).
- **Trial:** the card is asked at entry, once per user (see 3.3).
- **Credits:** the monthly allocation does not accumulate, and is granted lazily (see 3.4). One free workspace per user by default, configurable.
- **VAT:** optional, off by default.
- **Screens not detailed above** follow the same structure and tokens.
- **Other areas:**
  - the admin moves into the new shell, with a navigation section that only admins see, its page header and its loading and error states, without a redesign;
  - the sign-in pages are restyled with the primitives, as a centered card;
  - on the public side, only the header, the footer and the prices are in scope.
