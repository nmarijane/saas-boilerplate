# AI Chambers design authority

## Product and audience

A unified operational workspace for Western Australian criminal defence lawyers: discover tools, run form/chat tools, use client-specific solutions, review outputs, manage access and recover failed work. Desktop is dense and keyboard-efficient; mobile is purpose-built rather than a scaled desktop screenshot.

## North Star

Compact, calm, traceable. The defining layout is a single-line record surface with a reusable inspector. The interface prioritises records and source evidence over decorative dashboard cards.

## Brand and anti-references

Purple belongs to the supplied identity, not to every control. Original supplied PNG approximates #8A1BE1; the operational accent is slate #526B87. No purple page fills, gradients, neon status colours, promotional hero sections, large display headings or arbitrary card dashboards. No invented seals, efficiency claims, legal conclusions or certifications. Concept imagery is illustrative and must not dictate business data.

## Foundations

The canonical numeric/colour values live ONLY in tokens/tokens.json; src/styles/tokens.css and src/tokens.ts are generated. Standard type: page 18/24 weight 500; sections 14/20 weight 500; body 13/20 weight 400; metadata 12/16. Mobile body 14; editable text fields 16 to avoid mobile zoom. Use Inter if locally licensed/provided, otherwise Segoe UI/Arial. No remote font dependency; no bundled unlicensed font.

Spacing: 4,8,12,16,24,32. Page padding 16 desktop,12 mobile; content gaps 12 desktop,8 mobile. Header vertical padding 8, no obligatory subtitle, one row containing title, count/status and actions. Section margins 12 above/6 below. Buttons 28 high and 4x8 padding; inputs 30; desktop rows 36 compact/44 comfortable. All touch targets at least 44x44 through actual hit regions, without overlap. Desktop density never reduces mobile hit areas. Keep body reading line heights usable.

One-pixel borders, four-pixel radius, 16px icons. Prefer PatternFly icons (one family) over mixing Lucide and PatternFly. Border/divider tokens differ: controls need visible boundaries, ornamental separators can be softer. Only drawers/popovers/modals receive elevation. No shadow around every section. Icon-only actions require labels plus accessible help; ellipsis menus must not be hover-only.

## Layout

Navigation is outside the 24-column desktop content grid. Desktop >=1200: 24 columns, typical 16/8 content-inspector. Tablet 768–1199: 12 columns,8/4 or stack when min widths fail. Mobile <768:4 columns,full-width sections. Do not force PatternFly's built-in 12-column Grid to pretend to be24: use the namespaced CSS grid. Main nav192 expanded/56 collapsed; settings secondary nav176; masthead40. Form panels retain document scrolling. Only active record surfaces own a bounded overflow area. Never clip a long form to fit a neighbouring table.

## Components

PatternFly6 owns primitive accessibility and behaviour. AI Chambers wrappers own compact tokens, naming and composition. No new shadcn, Ant Design, MUI or parallel component library. Built-in stock dashboard typography is not the product theme. See docs/02-COMPONENTS.md for the ownership registry and implementation levels.

## Themes and accessibility

Both light and dark semantic tokens are mandatory. Maintain WCAG2.2AA text >=4.5:1, meaningful UI boundaries/focus >=3:1 as applicable; do not claim compliance solely from palette ratios. Focus-visible two-pixel ring with2px offset; never suppress it. Status combines wording and icons where useful. Respect forced colours, reduced motion and200% zoom. Portals inherit root tokens. Backgrounds under a modal are not interactive. Every truncated important value is inspectable by keyboard/touch, not only a title tooltip.

## Motion

120ms micro-feedback;180ms standard;220ms drawer. Use ease-out, avoid spring/bounce and page-load theatre. Reduced motion removes spatial transitions and keeps state immediate. Busy buttons retain their label geometry. Progress is determinate only with reliable work measurement.

## Content

Sentence case, Australian English, direct action verbs. Default workspace timezone Australia/Perth; personal date display may vary. Store instants in UTC, date-only values as dates, never convert a date-only deadline through UTC. Explicit AUD currency, tabular figures. Tool1 is a Form, priced AUD49.99 per run in supplied configuration. No legal copy changes without review.

## Verification and exceptions

Run generated-token drift checks, typecheck, tests and browser checks before release. Docs/09-ACCEPTANCE.md is the downstream app release gate. Exact viewport geometry and interactions are tested on code, not certified by generated images. Exceptions require a documented business reason, owner, expiry and regression test. Do not fix a violation by rewriting the standard to match it.
