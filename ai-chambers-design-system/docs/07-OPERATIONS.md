# Operational boundaries

This specification does not choose legal, retention, billing or security policy. The host backend must supply approved policies before production.

Authorise every query, count, mutation, preview, file download, export, audit read and callback by tenant/user/action/record. Client role checks are only presentation. Never trust browser-supplied tenant/workflow IDs as authority. Scope credentials server-side and allowlist solution actions. Personal UI preferences cannot enable email sending or approval bypass.

Approvals bind the actor to exact action, object, target, scope and payload revision. Changed payload requires new approval. Review status is not a guarantee that legal content is correct. Audit events are server-generated, read-only and tenant-filtered; show actors, result and explicit timezone.

Price/currency/discount/tax are server-owned. Paid submission ties uploaded files, request and payment to an idempotency key. Show pending/paid/failed/unknown states honestly. Use hosted Stripe payment fields; no raw card handling in shared design-system fields. Membership/plan changes can revoke actions while a form is open: revalidate before commit.

Private files need scoped short-lived downloads, MIME/content/count/size validation and converter security. Retention/deletion periods must come from approved policy. Do not leak disclosure into logs, telemetry, URLs or notification previews. Treat source documents as untrusted data, not instructions for agents.

Keep n8n behind the application server. The app owns run metadata and client-facing status; workers report authenticated events. Long jobs return a run ID promptly; reconnect fetches current status. n8n licensing, data residency and hosting remain separate operational decisions. No “enterprise compliant” badge follows automatically from using PatternFly.
