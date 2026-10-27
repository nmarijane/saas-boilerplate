/** Host integration helpers. They do not persist drafts or retry external writes. */
export type SaveState<T> =
  | { kind: "clean"; value: T; revision: string }
  | { kind: "dirty"; value: T; revision: string }
  | { kind: "saving"; value: T; revision: string; operationId: string }
  | { kind: "failed"; value: T; revision: string; message: string }
  | {
      kind: "conflict";
      value: T;
      revision: string;
      serverValue: T;
      serverRevision: string;
    };
export function editDraft<T>(s: SaveState<T>, value: T): SaveState<T> {
  if (s.kind === "saving")
    throw new Error("Wait for the active save before editing.");
  if (s.kind === "conflict") return { ...s, value };
  return { kind: "dirty", value, revision: s.revision };
}
export function startSave<T>(
  s: SaveState<T>,
  operationId: string,
): SaveState<T> {
  if (s.kind !== "dirty" && s.kind !== "failed")
    throw new Error("Resolve conflicts or finish the active operation first.");
  return { kind: "saving", value: s.value, revision: s.revision, operationId };
}
export function saveSucceeded<T>(
  s: SaveState<T>,
  operationId: string,
  value: T,
  revision: string,
): SaveState<T> {
  if (s.kind !== "saving" || s.operationId !== operationId) return s;
  return { kind: "clean", value, revision };
}
export function saveConflict<T>(
  s: SaveState<T>,
  operationId: string,
  serverValue: T,
  serverRevision: string,
): SaveState<T> {
  if (s.kind !== "saving" || s.operationId !== operationId) return s;
  return {
    kind: "conflict",
    value: s.value,
    revision: s.revision,
    serverValue,
    serverRevision,
  };
}
export function reloadConflict<T>(s: SaveState<T>): SaveState<T> {
  if (s.kind !== "conflict") return s;
  return { kind: "clean", value: s.serverValue, revision: s.serverRevision };
}
/** Resolving a conflict requires the host to present and approve merged values. */
export function resolveConflict<T>(
  s: SaveState<T>,
  reviewedValue: T,
): SaveState<T> {
  if (s.kind !== "conflict") throw new Error("No conflict to resolve.");
  return { kind: "dirty", value: reviewedValue, revision: s.serverRevision };
}
