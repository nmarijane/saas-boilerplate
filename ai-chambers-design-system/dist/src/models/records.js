export const emptyQuery = () => ({
    kind: "group",
    match: "all",
    children: [],
});
export function matches(row, q) {
    if (q.kind === "group")
        return (q.children.length === 0 ||
            (q.match === "all"
                ? q.children.every((x) => matches(row, x))
                : q.children.some((x) => matches(row, x))));
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
            return (raw !== null &&
                raw !== "" &&
                Number.isFinite(Number(raw)) &&
                Number.isFinite(Number(q.value)) &&
                Number(raw) > Number(q.value));
        case "lt":
            return (raw !== null &&
                raw !== "" &&
                Number.isFinite(Number(raw)) &&
                Number.isFinite(Number(q.value)) &&
                Number(raw) < Number(q.value));
    }
}
export function queryRows(rows, search, query, sorts) {
    const s = search.trim().toLocaleLowerCase("en-AU");
    return rows
        .filter((row) => matches(row, query) &&
        (!s ||
            Object.values(row).some((v) => String(v ?? "")
                .toLocaleLowerCase("en-AU")
                .includes(s))))
        .sort((a, b) => {
        for (const sort of sorts) {
            const x = a[sort.field], y = b[sort.field];
            const n = typeof x === "number" && typeof y === "number"
                ? x - y
                : String(x ?? "").localeCompare(String(y ?? ""), "en-AU", {
                    numeric: true,
                });
            if (n)
                return sort.direction === "asc" ? n : -n;
        }
        return a.id.localeCompare(b.id);
    });
}
export function toggleId(selection, id) {
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
export function selected(selection, id) {
    return selection.kind === "explicit"
        ? selection.ids.includes(id)
        : !selection.excludedIds.includes(id);
}
export function selectionCount(selection) {
    return selection.kind === "explicit"
        ? selection.ids.length
        : Math.max(0, selection.total - selection.excludedIds.length);
}
export function viewStorageKey(workspace, user, resource) {
    return ["ac-view-v1", workspace, user, resource]
        .map(encodeURIComponent)
        .join(":");
}
export function parseViews(input, allowed) {
    if (!Array.isArray(input))
        return [];
    const keys = new Set(allowed.map((c) => c.key));
    const validQuery = (q, depth = 0) => {
        if (depth > 5 || !q || typeof q !== "object")
            return false;
        const x = q;
        if (x.kind === "group")
            return (["all", "any"].includes(String(x.match)) &&
                Array.isArray(x.children) &&
                x.children.length <= 20 &&
                x.children.every((y) => validQuery(y, depth + 1)));
        return (x.kind === "condition" &&
            keys.has(String(x.field)) &&
            ["eq", "contains", "gt", "lt", "empty"].includes(String(x.operator)) &&
            typeof x.value === "string");
    };
    return input.filter((v) => {
        if (!v || typeof v !== "object")
            return false;
        return (v.version === 1 &&
            typeof v.id === "string" &&
            typeof v.name === "string" &&
            typeof v.search === "string" &&
            validQuery(v.query) &&
            Array.isArray(v.sorts) &&
            v.sorts.every((s) => keys.has(s.field) && ["asc", "desc"].includes(s.direction)) &&
            Array.isArray(v.columns) &&
            new Set(v.columns.map((c) => c.key)).size === v.columns.length &&
            v.columns.every((c) => keys.has(c.key) &&
                Number.isFinite(c.width) &&
                c.width >= 80 &&
                c.width <= 800 &&
                typeof c.visible === "boolean") &&
            allowed
                .filter((c) => c.required)
                .every((c) => v.columns.some((x) => x.key === c.key && x.visible)) &&
            ["compact", "comfortable"].includes(v.density) &&
            ["table", "grid"].includes(v.mode) &&
            [10, 25, 50].includes(v.pageSize));
    });
}
