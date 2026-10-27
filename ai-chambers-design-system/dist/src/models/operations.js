export function editDraft(s, value) {
    if (s.kind === "saving")
        throw new Error("Wait for the active save before editing.");
    if (s.kind === "conflict")
        return { ...s, value };
    return { kind: "dirty", value, revision: s.revision };
}
export function startSave(s, operationId) {
    if (s.kind !== "dirty" && s.kind !== "failed")
        throw new Error("Resolve conflicts or finish the active operation first.");
    return { kind: "saving", value: s.value, revision: s.revision, operationId };
}
export function saveSucceeded(s, operationId, value, revision) {
    if (s.kind !== "saving" || s.operationId !== operationId)
        return s;
    return { kind: "clean", value, revision };
}
export function saveConflict(s, operationId, serverValue, serverRevision) {
    if (s.kind !== "saving" || s.operationId !== operationId)
        return s;
    return {
        kind: "conflict",
        value: s.value,
        revision: s.revision,
        serverValue,
        serverRevision,
    };
}
export function reloadConflict(s) {
    if (s.kind !== "conflict")
        return s;
    return { kind: "clean", value: s.serverValue, revision: s.serverRevision };
}
/** Resolving a conflict requires the host to present and approve merged values. */
export function resolveConflict(s, reviewedValue) {
    if (s.kind !== "conflict")
        throw new Error("No conflict to resolve.");
    return { kind: "dirty", value: reviewedValue, revision: s.serverRevision };
}
