# AI Chambers enterprise design system — 1.0.0

A strict product design specification and executable React reference kit for AI Chambers, using PatternFly React 6.7.0. This is a design-system handoff, not a completed SaaS application. No production authentication, authorisation, payments, document storage or n8n workflows are connected.

## Start here

1. Read DESIGN.md (visual authority), UX-CONTRACT.md (behaviour), and docs/00-ADOPTION.md (integration).
2. Install Node 22.12+ or Node 24 LTS; use `npm ci` from this folder. Dependencies are pinned in package-lock.json.
3. `npm run verify` generates tokens, typechecks, tests models, checks contracts/contrast, and builds the library and preview.
4. `npm run dev` opens the Vite reference at http://localhost:4173. Navigate the Records, Workspace settings, Preferences and Disclosure form examples. They are labelled demonstrations, not production services.
5. With Chromium available, `npm run test:browser` exercises the reference and runs axe. See reports/VERIFICATION.md for what was actually run in this environment.

## Contents

- `tokens/tokens.json`: canonical light/dark design tokens. Generate CSS and TypeScript using `npm run tokens`; never hand-edit exports.
- `src/styles/`: token exports, PatternFly bridge and dense responsive layout.
- `src/components/`: executable shared wrappers, RecordTable, nested query builder, select, inspector, timeline and shell.
- `src/models/records.ts`: filter/sort, selection and validated saved-view data contracts.
- `docs/`: component contracts, shell/layout recipes, responsive and operational policies, screen specifications and release gates.
- `tokens/disclosure.schema.json`: faithful normalisation of the supplied 22 October Gravity Forms export, including exact terms. Not a payment implementation.
- `assets/`: supplied logo, unchanged. `references/`: selected final concept images, subordinate to the specification.
- `tests/`, `scripts/`, `reports/`: executable checks and verification evidence.

## Scope and honesty

The local RecordTable demonstrates a bounded fixture dataset, client-side filtering/paging and session-only views. Its viewStore adapter is opt-in. Production uses server paging/queries, authorised records, tenant/user/resource scoped view persistence, immutable selection snapshots and protected exports. Do not wire the local filter helper to an unbounded production dataset.

Component contracts identify features that are specified rather than implemented (such as shared cloud views, virtualisation, conflict-aware saves, retry delivery, full chat streaming and the notification backend). Do not present a disabled or mock service as working.

## Import into an application

Copy or package `src`, `tokens` and `assets`; install the pinned PatternFly dependencies. Import `src/styles/index.css` once at the application root after removing competing UI resets. Set `data-ac-theme="dark"` and `pf-v6-theme-dark` on `<html>` for dark mode. Use `AppShell`, `PageHeader`, `RecordTable`, `Inspector`, `Field`, `ActionButton`, `StatusPill`, `CompactSelect`, `QueryBuilder`, `ActivityTimeline` through `src/index.ts`.

The package exports compiled ESM and declarations after build. Bundler module resolution is required because the library source uses extensionless imports; its CSS export remains source CSS for bundling. This private starter package is intentionally not published.

## Authority

User requirements > supplied form schema and approved business policy > DESIGN.md/tokens > UX-CONTRACT/component contracts > runnable examples > concept images. Image text, generated logos, dates and stock data are not authoritative.
