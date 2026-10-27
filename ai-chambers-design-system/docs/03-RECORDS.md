# RecordTable contract

## Structure

Saved views > search/query toolbar > selection bar when active > header/rows > pagination. Default table, optional grid with identical query, ordering, selection and actions. Use one configurable owner for tools, solutions, runs, documents, members, clients and admin registries.

Every record row is one line: no avatar/subtitle stacks and no wrapped metadata. Use ellipsis and an inspector for full values. A native title tooltip is supplementary, never the only access. Prefer a recognisable identity column as the inspect button. Compact desktop rows are 36px; comfortable rows 44px. Mobile rows are at least 44px. Do not put every cell inside a pill.

## Query and search

Support nested ALL/ANY groups, field/operator/value controls and atomic Apply/Cancel. The reference supports scalar eq, contains, gt, lt and empty. A production adapter must enforce typed fields, date/number semantics, allowed operators, maximum total terms, payload limits and query timeout. Reference nesting is bounded to five levels and twenty children per group.

Remote search is 300ms debounced, IME-safe and cancellable. Clear is immediate and restores search focus. Ignore stale responses. Changing query/sort resets page and selection. Never compile untrusted field names into SQL. Sensitive search text must not enter URLs or localStorage by default.

## Columns and saved views

Multi-sort shows priority and direction; ties have deterministic ordering. Resize with pointer and keyboard (8px steps); default range 80–800px. Show/hide, required identity column, reorder, reset and optional approved pinning share one schema. Reorder always has a non-drag option. Pinning is a host extension, not implemented in this reference.

View version 1 includes search, query, sort, widths, column order/visibility, density, mode and page size; it excludes selected IDs. Persist on an authorised server scoped by workspace/user/resource/schema version. Validate on load. Handle removed columns, invalid values, duplicate names, save failures and permissions for shared views. The demo's views are session-only unless an explicit adapter is supplied. Do not silently add localStorage for matter filters.

## Selection and actions

Header checkbox selects current page with a mixed state. “Select all N matching” is a separate scope. Display count and exclusions. Production needs an immutable authorised query snapshot; if it expires, require re-selection. Refresh must not silently change an executing bulk operation's scope.

Mutating bulk actions require scope preview, permission checks and confirmation when consequential. Report partial successes/failures by record. Retry failed items only, with idempotency. Cosmetic reversible actions can be immediate. Context and bulk ellipsis menus use action verbs and explain unavailable actions. Clearing selection uses X, not a trash icon.

## States, performance and inspector

Use server pagination 10/25/50 by default; never load unbounded tenant data. Initial loading retains frame/header geometry. Background refresh retains previous rows with an updating indicator. Distinguish no records from no results. Retry preserves query. Clamp page after filter/deletion. Table owns its internal overflow; switching to a form must restore natural scrolling.

Reusable inspector tabs are Details/Files/Activity where relevant. Closing restores trigger focus and list context. Timeline entries include actor, action, result, instant and timezone. Audit history is server-owned and read-only. Permission-check every private preview and abort obsolete requests. Handle revision conflicts through compare/reload rather than silent overwrite.
