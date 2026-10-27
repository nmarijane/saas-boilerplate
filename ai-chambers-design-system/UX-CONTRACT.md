# Shared behaviour contract

MUST is a release requirement. SHOULD requires a documented reason to deviate. This contract governs UI consequences, not new billing/security/legal policy.

## Canonical ownership map

| Capability      | Canonical owner                                | Source of truth       | Allowed variants                | Verification                   |
| --------------- | ---------------------------------------------- | --------------------- | ------------------------------- | ------------------------------ |
| Table Selection | RecordTable + models/records                   | docs/03-RECORDS.md    | explicit,query snapshot         | model + browser tests          |
| Select/Listbox  | CompactSelect + PF Select                      | docs/04-FORMS.md      | searchable authored             | browser open/close/focus       |
| Date            | PF DatePicker adapter in host app              | docs/04-FORMS.md      | date-only,instant display       | host locale/calendar tests     |
| Form            | Field + PF Form                                | docs/04-FORMS.md      | create/edit/paid request        | validation + host submit tests |
| Scrollbar       | src/styles/layout.css                          | DESIGN.md             | global baseline                 | computed styles + overflow     |
| Toast           | host notification provider using PF AlertGroup | docs/06-FEEDBACK.md   | info/success/warning/error      | host live-region tests         |
| CRUD            | host routes/services                           | docs/07-OPERATIONS.md | create/edit/delete/review       | host full-flow tests           |
| Inspector       | Inspector + PF Modal                           | docs/05-NAVIGATION.md | desktop edge modal,mobile sheet | browser focus/Escape           |

## Interaction ledger

List > inspect: retain search, filters, sort, page and scroll; closing inspector restores trigger focus. Create > successful save: return to owning list, preserve context and announce success. Edit > save: stay in inspector and refresh authoritative row; cancel restores pre-edit values. Delete: authorised, explicit confirmation with record/scope and consequence; return to list with page clamped. Undo only when actually reversible. Paid submission: show exact total and action; create immutable idempotency key; verify payment and authorisation server-side; uncertain completion checks existing request before retry.

Search: local input responds immediately; remote search300ms debounce, IME safe and AbortController/stale-response guard. Clear acts immediately and refocuses search. Filter/sort changes reset page and clear selection; active bulk operations pin their selection snapshot. Saved views do not include selected records. A table must never interpret current-page selection as all-results selection.

## Business-source traceability

| Domain                       | Authority                                                                              | UI consequence                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Tool1 fields/price/terms     | supplied gravityforms-export-2026-10-22.json, normalised tokens/disclosure.schema.json | required fields,accepted formats,price49.99,no active per-page pricing          |
| Visual system                | user's design instructions and supplied logo                                           | compact slate interface,purple identity only                                    |
| Permissions/tenant isolation | host backend policy,not supplied                                                       | deny by default until policy exists;display cannot grant access                 |
| Retention/deletion           | host approved policy,not supplied                                                      | do not invent retention durations or irreversible delete options                |
| Subscription allowances/tax  | host billing contract,not supplied                                                     | sample allowances are illustrations,not real entitlements                       |
| n8n external actions         | host solution policy,not supplied                                                      | server-enforced scoped tools and approvals,never arbitrary browser workflow IDs |

## State requirements

Every data surface MUST show loading,empty,no-results,error,refreshing,partial failure andpermission-lost where relevant. Forms MUST distinguish clean,dirty,validating,saving,saved,offline,failed andconflicted; preserve values onfailure. Auth expiry must preserve safe drafts before reauthentication and revalidate permissions afterward. Never store disclosure text,mail,credentials,card data or sensitive filter terms in URLs,localStorage,analytics or console logs.

## Safe persistence override

Unlike generic shareable-table defaults, confidential matter searches/filters MUST NOT appear in URLs by default. Persist view content on an authorised server keyed by workspace,user,resource,schemaVersion. A URL may contain an opaque view ID only. Non-sensitive density/column preferences can be local with tenant/user scoping; clear caches on logout or membership loss. Reference examples save views only in component memory unless an adapter is explicitly provided.

## Accessible semantics

Use native buttons/links, labelled form controls, semantic tables and authored selects. Modal drawers use PF focus isolation and restoration; persistent desktop inspectors may be nonmodal only as an explicit host variant with no false aria-modal. Single-line truncation never removes the ability to inspect the full record. Keyboard resize/reorder alternatives are mandatory. Reduced motion,contrast,200%zoom and coarse-pointer checks are release gates.
