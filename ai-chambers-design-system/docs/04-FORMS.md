# Forms and inputs

Use labels above compact controls, required indicators with text alternatives and explicit optional labels. Labels activate controls. Connect errors/help using aria-describedby and expose aria-invalid. Forms use noValidate and product-owned validation. Validate after interaction or submit, not before input. Focus the first invalid control; preserve values on failure. Error summaries link to fields.

## Select, date and autocomplete

PF Select is the authored popup owner. Search, clear, selected state, bounded scrolling, collision handling, keyboard selection, Escape and focus return must be tested. Do not pretend a native select is authored by removing its arrow. Autocomplete queries are cancellable and display loading/no-results/error; respect IME composition.

Host DateField uses PF DatePicker with en-AU labels, typed input, calendar toggle, today/clear, validation and keyboard dismissal. Date-only values remain ISO dates, never timezone-shifted instants. Show unambiguous display hints. Store instants UTC and display explicit user/workspace timezone. A range validates start <= end. PF TimePicker is preferred when the app owns time input behaviour; native time is acceptable only when OS-owned popup geometry/locale is explicitly accepted. The kit specifies but does not implement the calendar adapter.

## Disclosure Tool 1

Authority: tokens/disclosure.schema.json, normalised from the supplied 22 October export.

- Required: your first/last name, email, client's name, disclosure material, payment details and terms acceptance.
- Optional: matter number and discount code. Hidden Job ID is server-generated; administrative status is not an editable customer field.
- Formats: pdf, jpg, gif, png, jpeg, doc, docx, txt. Up to 20 files, 100 MB each.
- Base price AUD49.99 per run. Page pricing is disabled. Do not activate stale 50MB/per-page settings from the disabled plugin block.
- Server owns price, tax, discount eligibility and payment confirmation. No invented GST treatment. Supplied full terms remain accessible and unchanged pending legal review.

Uploads need a picker alternative, local and server validation, per-file progress/error/retry/cancel/remove, duplicate handling and truthful ready state. Validate content/MIME, converter limits and malware policy server-side. Do not start a paid job before files and total are confirmed.

## Saving and recovery

Fixed-width busy button, duplicate-submit guard and distinct clean/dirty/validating/saving/saved/offline/failed/conflicted states. “Saved locally” is not “Saved.” Guard unsaved navigation with a PF modal; use beforeunload only for actual page unload. Confidential drafts need an approved server/encrypted persistence policy, expiry and logout cleanup, not casual localStorage.

For 409/412 conflict compare server revision with local edits. Preserve drafts while reviewing/reloading; do not silently overwrite newer data. On uncertain completion of charge/send/delete, check operation status before retry. Payment input must be hosted Stripe Elements/Checkout; the example intentionally does not collect real card details.

Micro UI: contextual help, accessible tooltips, profile-prefill labels, distinct read-only/disabled controls, real character limits only. Auto-grow textareas with resize:none and reachable content. Mask secrets with labelled show/hide; allow password managers and paste. Submit shortcuts must respect validation, IME and explicit payment intent.
