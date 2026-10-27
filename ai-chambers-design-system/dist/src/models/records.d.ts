export type Scalar = string | number | boolean | null;
export type RecordRow = {
    id: string;
} & Record<string, Scalar>;
export type Operator = "eq" | "contains" | "gt" | "lt" | "empty";
export type Condition = {
    kind: "condition";
    field: string;
    operator: Operator;
    value: string;
};
export type Query = Condition | {
    kind: "group";
    match: "all" | "any";
    children: Query[];
};
export type Sort = {
    field: string;
    direction: "asc" | "desc";
};
export type Column = {
    key: string;
    label: string;
    width: number;
    minWidth?: number;
    required?: boolean;
};
export type View = {
    version: 1;
    id: string;
    name: string;
    search: string;
    query: Query;
    sorts: Sort[];
    columns: {
        key: string;
        width: number;
        visible: boolean;
    }[];
    density: "compact" | "comfortable";
    mode: "table" | "grid";
    pageSize: number;
};
export type Selection = {
    kind: "explicit";
    ids: string[];
} | {
    kind: "query";
    snapshot: string;
    total: number;
    excludedIds: string[];
};
export declare const emptyQuery: () => Query;
export declare function matches(row: RecordRow, q: Query): boolean;
export declare function queryRows(rows: RecordRow[], search: string, query: Query, sorts: Sort[]): RecordRow[];
export declare function toggleId(selection: Selection, id: string): Selection;
export declare function selected(selection: Selection, id: string): boolean;
export declare function selectionCount(selection: Selection): number;
export declare function viewStorageKey(workspace: string, user: string, resource: string): string;
export declare function parseViews(input: unknown, allowed: Column[]): View[];
