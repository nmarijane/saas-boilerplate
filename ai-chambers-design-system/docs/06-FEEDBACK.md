# Motion and feedback

Motion: fast120ms, standard180ms, drawer220ms. Prefer opacity/transform; avoid animating table geometry, column resize or scroll position. Reduced motion removes spatial transitions and nonessential animation. Never use bounce, confetti, count-up metrics, ambient shimmer or entrance theatre in operational flows.

Initial load uses a small labelled spinner in a stable frame. Background refresh retains useful rows and indicates updating. Paging retains toolbar/header. Mutating controls remain the same size while busy. Timeouts offer a recovery action; no indefinite spinners. Determinate progress requires measured work; otherwise show stages.

## Feedback hierarchy

Field error at the field; linked summary for a form; persistent record/page banner for its scope; toast for brief acknowledgement. Host PF AlertGroup owns deduplication, stacking, announcement and dismissal. Routine updates are polite; assertive announcements are reserved for urgent blockers. Toast must not contain the only critical error detail or disclosure/secret data.

## Undo, retry and conflicts

Undo only when real: restoring a local preference/filter, reversible server soft-delete. Label the affected object and a real deadline where applicable. Never offer Undo for a sent email, charge or irreversible deletion without backend compensation. Clear selection uses X.

Bound retries and backoff for idempotent reads. Writes require operation IDs/idempotency keys. After timeout check authoritative status before retrying. Partial bulk failures report which records failed; retry those only. On reconnect revalidate data and permissions. Reauthentication must not accidentally resubmit a charge or job. Conflicts preserve local edits and require compare/reload/explicit resolution.

## Chat and jobs

Chat distinguishes connecting, streaming, stopped, partial, completed and error. Stop is explicit. Do not auto-scroll when users read earlier content; offer “New content.” Citations identify exact source document/page and open a permission-checked preview. Regenerate/copy depend on policy. A cancelled job distinguishes cancellation requested from confirmed. Progress stages and timestamps must be truthful, not fabricated estimates.
