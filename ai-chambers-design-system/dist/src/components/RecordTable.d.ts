import { type Column, type RecordRow, type View } from "../models/records";
export interface RecordTableProps {
    rows: RecordRow[];
    columns: Column[];
    label: string;
    /** Demonstrator uses a bounded local dataset. Production adapter must supply authorised records. */
    onInspect: (row: RecordRow) => void;
    onExport?: (ids: string[]) => void;
    initialState?: "ready" | "loading" | "error";
    /** Opt-in only for non-sensitive preferences/fixtures; use a server view store in production. */
    viewStore?: {
        load: () => unknown;
        save: (views: View[]) => void;
    };
}
export declare function RecordTable({ rows, columns: initialColumns, label, onInspect, onExport, initialState, viewStore, }: RecordTableProps): import("react").JSX.Element;
export declare function RecordActions({ label, items, }: {
    label: string;
    items: {
        label: string;
        run: () => void;
    }[];
}): import("react").JSX.Element;
