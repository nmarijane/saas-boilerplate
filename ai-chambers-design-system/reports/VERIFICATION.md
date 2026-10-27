# Verification — 25 October 2026

## Executed and passed
- `npm run verify`: generated tokens, Prettier formatting check, TypeScript strict typecheck, 11 model tests, static checks and production reference/library build.
- Static checks: 16 text/semantic contrast pairs across light/dark; focus checks; 20 PatternFly CSS bridge properties verified against installed package styles; disclosure schema and anti-pattern checks.
- Strict premium contract/source audit: zero findings. This auditor does not execute the UI and is not included as a package dependency; its report is included.
- `npm run test:browser`: 21 passing interaction checks in Chromium 141.0.7390.37 with no page errors. See browser-checks.json and browser.log.
- Automated axe checks: zero violations in the tested desktop light, desktop dark and mobile dark states (WCAG2A/AA and2.1AA rules).
- Responsive computed grids:24/12/4 columns at1440/1024/390;360px reflow; no page overflow in checked contexts.
- Interaction coverage includes search/clear, explicit/query selection, column resize/visibility, saved-view restoration, nested filters, inspector Escape/focus return, command shortcut, searchable select, form validation, mobile sheet, reduced motion and retry.
- `npm audit` and production-only audit: zero reported vulnerabilities at verification time.
- Visual inspection of desktop light/dark and mobile reference screenshots. Original supplied dark logo retained unchanged.

## Scope limits
This is a design specification and executable reference library, not a completed AI Chambers SaaS. Calendar/autocomplete adapters, full chat streaming, notification delivery, server saved views, private upload pipeline, tenant authorisation, approvals, n8n and Stripe are specified host integrations. No real external writes, payments, messages or deployments were performed.

No claim is made of manual screen-reader certification, Safari/Firefox/device coverage, every WCAG2.2 criterion, full-app performance budgets or production security. Brand-final light artwork was not supplied; sidebar uses the original dark asset. Component registry and enterprise-patterns.json distinguish implementation from contracts.

## Archive verification
`scripts/package.py` creates a ZIP with a SHA256 manifest, reopens it, checks CRC integrity, validates safe unique paths and verifies every manifest hash. Installed node_modules, preview-dist, caches and obsolete failure screenshots are excluded. The archive contains source, compiled library, documentation, original logo, references, tests and reports. Run npm ci before development; npm run build recreates the preview.
