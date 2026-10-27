# Strict host application acceptance gate

These are downstream release requirements, not claims that the kit has already passed them. Attach exact commands, versions, screenshots, pass/fail counts, limitations and waiver owners. Never mark an unrun test as passed.

## Foundations

- Verify computed24/12/4 grids at1440/1024/390, short viewports, natural form scrolling and no body overflow.
- Regenerate tokens without diff; enforce one icon family, no screen-level colours, compact headers/buttons and nowrap records.
- Check light/dark/forced colours; text4.5:1, meaningful UI/focus3:1;200% zoom/reflow and virtual keyboard.

## Data

- One configurable RecordTable on every object list; full values without hover-only access.
- Nested typed queries, IME input, request cancellation, out-of-order responses, empty/no-results/error/retry and page boundaries.
- Pointer/keyboard resize, show/hide/reorder/reset, required identity column and multi-sort priority.
- Saved views survive authorised reload, isolate tenants/users, validate schemas and handle migrations/failures.
- Explicit page/all-results selection, exclusions, expired snapshots, changed queries, partial bulk failures and duplicate prevention.
- Inspector focus return, private source access, read-only actor/time/timezone audit history.

## Forms and navigation

- Labels activate controls; errors associate correctly; first invalid field gets focus; input is preserved; duplicate submit is prevented.
- Select/date/autocomplete open states tested for keyboard, Escape, touch, long options, viewport edges and locale.
- Dirty-navigation guard, safe drafts, session expiry and409/412 comparison without silent overwrite.
- Command permissions, advertised shortcuts, IME/input safety, nav collapse and workspace cache invalidation.

## Motion and feedback

- Reduced motion, stable busy geometry, no false Saved, no endless spinner, correct portal themes and modal focus.
- Truthful Undo, idempotent retry, uncertain completion checks and readable partial-failure results.

## Mobile

-360/390px single-line lists, actual44px targets, visible selection counts and ellipsis actions, safe bottom sheets and full-screen complex editors.

- All important columns reachable through inspector. Preserve permissions and scope; do not merely shrink a desktop table.

## Operations and regressions

- Backend tenant isolation across queries/files/exports/notifications/webhooks; a role cannot grant itself access through UI.
- Real payment/n8n actions tested only with approved test accounts and test mode; verify dedupe/late events.
- Measure initial JS, INP, query latency, scroll performance and memory against an agreed device/network baseline. Set explicit regression thresholds from real measurements, not invented pass metrics.
- Run interaction and visual tests for major routes, both themes, viewports, open overlays, long text, loading/empty/error/denied states. Automated axe supplements manual screen-reader review.
