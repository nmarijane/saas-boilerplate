/** Host integration helpers. They do not persist drafts or retry external writes. */
export type SaveState<T> = {
    kind: "clean";
    value: T;
    revision: string;
} | {
    kind: "dirty";
    value: T;
    revision: string;
} | {
    kind: "saving";
    value: T;
    revision: string;
    operationId: string;
} | {
    kind: "failed";
    value: T;
    revision: string;
    message: string;
} | {
    kind: "conflict";
    value: T;
    revision: string;
    serverValue: T;
    serverRevision: string;
};
export declare function editDraft<T>(s: SaveState<T>, value: T): SaveState<T>;
export declare function startSave<T>(s: SaveState<T>, operationId: string): SaveState<T>;
export declare function saveSucceeded<T>(s: SaveState<T>, operationId: string, value: T, revision: string): SaveState<T>;
export declare function saveConflict<T>(s: SaveState<T>, operationId: string, serverValue: T, serverRevision: string): SaveState<T>;
export declare function reloadConflict<T>(s: SaveState<T>): SaveState<T>;
/** Resolving a conflict requires the host to present and approve merged values. */
export declare function resolveConflict<T>(s: SaveState<T>, reviewedValue: T): SaveState<T>;
