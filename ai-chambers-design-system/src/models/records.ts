export type Scalar = string | number | boolean | null;
export type RecordRow = { id: string } & Record<string, Scalar>;
export type Operator = "eq" | "contains" | "gt" | "lt" | "empty";
export interface Condition {
  kind: "condition";
  field: string;
  operator: Operator;
  value: string;
}
export type Query =
  Condition | { kind: "group"; match: "all" | "any"; children: Query[] };
export interface Sort { field: string; direction: "asc" | "desc" }
export interface Column {
  key: string;
  label: string;
  width: number;
  minWidth?: number;
  required?: boolean;
}
export interface View {
  version: 1;
  id: string;
  name: string;
  search: string;
  query: Query;
  sorts: Sort[];
  columns: { key: string; width: number; visible: boolean }[];
  density: "compact" | "comfortable";
  mode: "table" | "grid";
  pageSize: number;
}
export type Selection =
  | { kind: "explicit"; ids: string[] }
  | { kind: "query"; snapshot: string; total: number; excludedIds: string[] };
export const emptyQuery = (): Query => ({
  kind: "group",
  match: "all",
  children: [],
});
export function matches(row: RecordRow, q: Query): boolean {
  if (q.kind === "group")
    return (
      q.children.length === 0 ||
      (q.match === "all"
        ? q.children.every((x) => matches(row, x))
        : q.children.some((x) => matches(row, x)))
    );
  const raw = row[q.field];
  const s = String(raw ?? "").toLocaleLowerCase("en-AU");
  const v = q.value.toLocaleLowerCase("en-AU");
  switch (q.operator) {
    case "eq":
      return s === v;
    case "contains":
      return s.includes(v);
    case "empty":
      return raw == null || raw === "";
    case "gt":
      return (
        raw !== null &&
        raw !== "" &&
        Number.isFinite(Number(raw)) &&
        Number.isFinite(Number(q.value)) &&
        Number(raw) > Number(q.value)
      );
    case "lt":
      return (
        raw !== null &&
        raw !== "" &&
        Number.isFinite(Number(raw)) &&
        Number.isFinite(Number(q.value)) &&
        Number(raw) < Number(q.value)
      );
  }
}
export function queryRows(
  rows: RecordRow[],
  search: string,
  query: Query,
  sorts: Sort[],
): RecordRow[] {
  const s = search.trim().toLocaleLowerCase("en-AU");
  return rows
    .filter(
      (row) =>
        matches(row, query) &&
        (!s ||
          Object.values(row).some((v) =>
            String(v ?? "")
              .toLocaleLowerCase("en-AU")
              .includes(s),
          )),
    )
    .sort((a, b) => {
      for (const sort of sorts) {
        const x = a[sort.field];
          const y = b[sort.field];
        const n =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x ?? "").localeCompare(String(y ?? ""), "en-AU", {
                numeric: true,
              });
        if (n) return sort.direction === "asc" ? n : -n;
      }
      return a.id.localeCompare(b.id);
    });
}
export function toggleId(selection: Selection, id: string): Selection {
  if (selection.kind === "query")
    return {
      ...selection,
      excludedIds: selection.excludedIds.includes(id)
        ? selection.excludedIds.filter((x) => x !== id)
        : [...selection.excludedIds, id],
    };
  return {
    kind: "explicit",
    ids: selection.ids.includes(id)
      ? selection.ids.filter((x) => x !== id)
      : [...selection.ids, id],
  };
}
export function selected(selection: Selection, id: string) {
  return selection.kind === "explicit"
    ? selection.ids.includes(id)
    : !selection.excludedIds.includes(id);
}
export function selectionCount(selection: Selection) {
  return selection.kind === "explicit"
    ? selection.ids.length
    : Math.max(0, selection.total - selection.excludedIds.length);
}
export function viewStorageKey(
  workspace: string,
  user: string,
  resource: string,
) {
  return ["ac-view-v1", workspace, user, resource]
    .map(encodeURIComponent)
    .join(":");
}
export function parseViews(input: unknown, allowed: Column[]): View[] {
  if (!Array.isArray(input)) return [];
  const keys = new Set(allowed.map((c) => c.key));
  const validQuery = (q: unknown, depth = 0): q is Query => {
    if (depth > 5 || !q || typeof q !== "object") return false;
    const x = q as Record<string, unknown>;
    if (x.kind === "group")
      return (
        ["all", "any"].includes(String(x.match)) &&
        Array.isArray(x.children) &&
        x.children.length <= 20 &&
        x.children.every((y) => validQuery(y, depth + 1))
      );
    return (
      x.kind === "condition" &&
      keys.has(String(x.field)) &&
      ["eq", "contains", "gt", "lt", "empty"].includes(String(x.operator)) &&
      typeof x.value === "string"
    );
  };
  return input.filter((v): v is View => {
    if (!v || typeof v !== "object") return false;
    return (
      v.version === 1 &&
      typeof v.id === "string" &&
      typeof v.name === "string" &&
      typeof v.search === "string" &&
      validQuery(v.query) &&
      Array.isArray(v.sorts) &&
      v.sorts.every(
        (s: Sort) => keys.has(s.field) && ["asc", "desc"].includes(s.direction),
      ) &&
      Array.isArray(v.columns) &&
      new Set(v.columns.map((c: Column) => c.key)).size === v.columns.length &&
      v.columns.every(
        (c: View["columns"][number]) =>
          keys.has(c.key) &&
          Number.isFinite(c.width) &&
          c.width >= 80 &&
          c.width <= 800 &&
          typeof c.visible === "boolean",
      ) &&
      allowed
        .filter((c) => c.required)
        .every((c) =>
          v.columns.some(
            (x: View["columns"][number]) => x.key === c.key && x.visible,
          ),
        ) &&
      ["compact", "comfortable"].includes(v.density) &&
      ["table", "grid"].includes(v.mode) &&
      [10, 25, 50].includes(v.pageSize)
    );
  });
}
