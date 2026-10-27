import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@patternfly/react-table";
import { Checkbox, Dropdown, DropdownList, DropdownItem, MenuToggle, Spinner, } from "@patternfly/react-core";
import { EllipsisVIcon } from "@patternfly/react-icons";
import { ActionButton, Inspector, StatusPill } from "./Primitives";
import { CompactSelect, QueryBuilder } from "./QueryBuilder";
import { emptyQuery, queryRows, selected, selectionCount, toggleId, parseViews, } from "../models/records";
export function RecordTable({ rows, columns: initialColumns, label, onInspect, onExport, initialState = "ready", viewStore, }) {
    const [columns, setColumns] = useState(initialColumns.map((c) => ({ ...c, visible: true }))), [search, setSearch] = useState(""), [query, setQuery] = useState(emptyQuery), [sorts, setSorts] = useState([]), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [selection, setSelection] = useState({
        kind: "explicit",
        ids: [],
    }), [mode, setMode] = useState("table"), [density, setDensity] = useState("compact"), [panel, setPanel] = useState(null), [draft, setDraft] = useState(emptyQuery), [views, setViews] = useState(() => {
        try {
            return parseViews(viewStore?.load(), initialColumns);
        }
        catch {
            return [];
        }
    }), [viewName, setViewName] = useState(""), [viewId, setViewId] = useState(""), [message, setMessage] = useState(""), [state, setState] = useState(initialState);
    const visible = columns.filter((c) => c.visible), filtered = useMemo(() => queryRows(rows, search, query, sorts), [rows, search, query, sorts]), maxPage = Math.max(1, Math.ceil(filtered.length / pageSize)), safePage = Math.min(page, maxPage), shown = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const searchRef = useRef(null);
    useEffect(() => {
        setPage(1);
        setSelection({ kind: "explicit", ids: [] });
    }, [search, query, sorts]);
    useEffect(() => {
        setSelection({ kind: "explicit", ids: [] });
    }, [rows]);
    const count = selectionCount(selection), ids = filtered.filter((r) => selected(selection, r.id)).map((r) => r.id), allPage = shown.length > 0 && shown.every((r) => selected(selection, r.id)), somePage = shown.some((r) => selected(selection, r.id));
    const view = () => ({
        version: 1,
        id: viewId || crypto.randomUUID(),
        name: viewName.trim(),
        search,
        query,
        sorts,
        columns: columns.map(({ key, width, visible }) => ({
            key,
            width,
            visible,
        })),
        density,
        mode,
        pageSize,
    });
    const save = () => {
        if (!viewName.trim()) {
            setMessage("Enter a view name.");
            return;
        }
        const v = view(), next = [...views.filter((x) => x.id !== v.id), v];
        try {
            viewStore?.save(next);
            setViews(next);
            setViewId(v.id);
            setMessage(viewStore ? "View saved." : "View saved for this session.");
        }
        catch {
            setMessage("Unable to save view. Your current settings are preserved.");
        }
    };
    const restore = (id) => {
        const v = views.find((x) => x.id === id);
        setViewId(id);
        if (!v)
            return;
        setViewName(v.name);
        setSearch(v.search);
        setQuery(v.query);
        setSorts(v.sorts);
        setDensity(v.density);
        setMode(v.mode);
        setPageSize(v.pageSize);
        setPage(1);
        setColumns(v.columns.map((c) => ({
            ...initialColumns.find((x) => x.key === c.key),
            ...c,
        })));
        setSelection({ kind: "explicit", ids: [] });
    };
    const width = (key, n) => setColumns((prev) => prev.map((c) => c.key === key
        ? {
            ...c,
            width: Math.round(Math.max(c.minWidth ?? 80, Math.min(800, n))),
        }
        : c));
    const resize = (key, e, start) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const el = e.currentTarget, x = e.clientX;
        const move = (p) => width(key, start + p.clientX - x);
        const end = () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", end);
            el.removeEventListener("pointercancel", end);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
    };
    const actions = (row) => (_jsx(RecordActions, { label: row ? `Actions for ${row.id}` : `Actions for ${count} selected`, items: row
            ? [
                { label: "Inspect record", run: () => onInspect(row) },
                ...(onExport
                    ? [{ label: "Export record", run: () => onExport([row.id]) }]
                    : []),
            ]
            : [
                ...(onExport
                    ? [
                        {
                            label: `Export ${count} selected`,
                            run: () => onExport(ids),
                        },
                    ]
                    : []),
                {
                    label: "Clear selection",
                    run: () => setSelection({ kind: "explicit", ids: [] }),
                },
            ] }));
    const cell = (row, key) => key === "status" ? (_jsx(StatusPill, { tone: row[key] === "Failed"
            ? "danger"
            : row[key] === "Needs review"
                ? "warning"
                : row[key] === "Completed"
                    ? "success"
                    : "info", children: String(row[key] ?? "—") })) : (String(row[key] ?? "—"));
    return (_jsxs("section", { className: "ac-records", "aria-label": label, "data-density": density, children: [_jsxs("div", { className: "ac-toolbar", children: [_jsx(CompactSelect, { label: "Saved views", value: viewId, options: [
                            { value: "", label: "Current view" },
                            ...views.map((v) => ({ value: v.id, label: v.name })),
                        ], onChange: restore }), _jsx("input", { "aria-label": "View name", placeholder: "Name this view", value: viewName, onChange: (e) => setViewName(e.target.value) }), _jsx(ActionButton, { onClick: save, variant: "secondary", children: "Save view" }), _jsx("span", { role: "status", children: message })] }), _jsxs("div", { className: "ac-toolbar", children: [_jsxs("div", { className: "ac-search", children: [_jsx("input", { ref: searchRef, type: "search", "aria-label": `Search ${label}`, value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search records\u2026" }), search && (_jsx(ActionButton, { variant: "plain", "aria-label": "Clear search", onClick: () => {
                                    setSearch("");
                                    searchRef.current?.focus();
                                }, children: "\u00D7" }))] }), _jsx(ActionButton, { variant: "secondary", onClick: () => {
                            setDraft(query);
                            setPanel("filters");
                        }, children: "Filter" }), _jsxs(ActionButton, { variant: "secondary", onClick: () => setPanel("sort"), children: ["Sort (", sorts.length, ")"] }), _jsx(ActionButton, { variant: "secondary", onClick: () => setPanel("columns"), children: "Columns" }), _jsx(ActionButton, { variant: "secondary", onClick: () => setDensity(density === "compact" ? "comfortable" : "compact"), children: density === "compact" ? "Compact" : "Comfortable" }), _jsxs("div", { className: "ac-inline", role: "group", "aria-label": "Display mode", children: [_jsx(ActionButton, { variant: mode === "table" ? "primary" : "secondary", "aria-pressed": mode === "table", onClick: () => setMode("table"), children: "Table" }), _jsx(ActionButton, { variant: mode === "grid" ? "primary" : "secondary", "aria-pressed": mode === "grid", onClick: () => setMode("grid"), children: "Grid" })] })] }), count > 0 && (_jsxs("div", { className: "ac-selection", role: "region", "aria-label": "Selected records", children: [_jsxs("strong", { children: [count, " selected"] }), _jsxs(ActionButton, { variant: "link", onClick: () => setSelection({
                            kind: "query",
                            snapshot: JSON.stringify({ search, query }),
                            total: filtered.length,
                            excludedIds: [],
                        }), children: ["Select all ", filtered.length, " matching"] }), actions(), _jsx(ActionButton, { variant: "plain", "aria-label": "Clear selection", onClick: () => setSelection({ kind: "explicit", ids: [] }), children: "\u00D7" })] })), _jsx("div", { className: "ac-record-frame", "aria-busy": state === "loading", children: state === "loading" ? (_jsxs("div", { className: "ac-state", role: "status", children: [_jsx(Spinner, { size: "md", "aria-label": "Loading records" }), "Loading records\u2026"] })) : state === "error" ? (_jsxs("div", { className: "ac-state", role: "alert", children: ["Unable to load records.", _jsx(ActionButton, { onClick: () => setState("ready"), children: "Retry demo load" })] })) : filtered.length === 0 ? (_jsxs("div", { className: "ac-state", children: [_jsx("h2", { children: rows.length ? "No matching records" : "No records yet" }), rows.length > 0 && (_jsx(ActionButton, { onClick: () => {
                                setSearch("");
                                setQuery(emptyQuery());
                            }, children: "Clear filters" }))] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: mode === "table" ? "ac-desktop-table" : "ac-hidden", children: _jsxs(Table, { role: "table", "aria-label": label, variant: "compact", gridBreakPoint: "", className: "ac-table", children: [_jsxs("colgroup", { children: [_jsx("col", { style: { width: 44 } }), visible.map((c) => (_jsx("col", { style: { width: c.width } }, c.key))), _jsx("col", { style: { width: 48 } })] }), _jsx(Thead, { children: _jsxs(Tr, { children: [_jsx(Th, { children: _jsx(Checkbox, { id: "select-page", "aria-label": "Select current page", isChecked: somePage && !allPage ? null : allPage, onChange: (_, v) => {
                                                            let next = selection;
                                                            for (const r of shown)
                                                                if (selected(next, r.id) !== v)
                                                                    next = toggleId(next, r.id);
                                                            setSelection(next);
                                                        } }) }), visible.map((c) => (_jsxs(Th, { "aria-sort": sorts[0]?.field === c.key
                                                        ? sorts[0].direction === "asc"
                                                            ? "ascending"
                                                            : "descending"
                                                        : undefined, children: [_jsxs("button", { className: "ac-sort-button", onClick: () => setSorts([
                                                                {
                                                                    field: c.key,
                                                                    direction: sorts[0]?.field === c.key &&
                                                                        sorts[0].direction === "asc"
                                                                        ? "desc"
                                                                        : "asc",
                                                                },
                                                            ]), children: [c.label, sorts.some((s) => s.field === c.key)
                                                                    ? ` ${sorts.findIndex((s) => s.field === c.key) + 1} ${sorts.find((s) => s.field === c.key)?.direction === "asc" ? "↑" : "↓"}`
                                                                    : ""] }), _jsx("span", { className: "ac-resize", tabIndex: 0, role: "separator", "aria-label": `Resize ${c.label}`, "aria-orientation": "vertical", "aria-valuenow": c.width, "aria-valuemin": c.minWidth ?? 80, "aria-valuemax": 800, onPointerDown: (e) => resize(c.key, e, c.width), onKeyDown: (e) => {
                                                                if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                                                                    e.preventDefault();
                                                                    width(c.key, c.width + (e.key === "ArrowRight" ? 8 : -8));
                                                                }
                                                            } })] }, c.key))), _jsx(Th, { screenReaderText: "Row actions" })] }) }), _jsx(Tbody, { children: shown.map((row) => (_jsxs(Tr, { className: selected(selection, row.id) ? "ac-selected" : "", children: [_jsx(Td, { children: _jsx(Checkbox, { id: `row-${row.id}`, "aria-label": `Select ${row.id}`, isChecked: selected(selection, row.id), onChange: () => setSelection(toggleId(selection, row.id)) }) }), visible.map((c, i) => (_jsx(Td, { dataLabel: c.label, children: _jsx("div", { className: "ac-cell", title: String(row[c.key] ?? "—"), children: i === 0 ? (_jsx("button", { className: "ac-record-link", onClick: () => onInspect(row), children: cell(row, c.key) })) : (cell(row, c.key)) }) }, c.key))), _jsx(Td, { children: actions(row) })] }, row.id))) })] }) }), _jsx("ul", { className: mode === "grid" ? "ac-card-grid" : "ac-mobile-list", "aria-label": `${label} alternate view`, children: shown.map((row) => (_jsxs("li", { className: selected(selection, row.id) ? "ac-selected" : "", children: [_jsx(Checkbox, { id: `mobile-${row.id}`, "aria-label": `Select ${row.id}`, isChecked: selected(selection, row.id), onChange: () => setSelection(toggleId(selection, row.id)) }), _jsx("button", { className: "ac-record-link", onClick: () => onInspect(row), children: String(row[visible[0]?.key] ?? row.id) }), cell(row, "status"), actions(row)] }, row.id))) })] })) }), _jsxs("footer", { className: "ac-toolbar ac-pagination", children: [_jsxs("span", { children: [filtered.length ? (safePage - 1) * pageSize + 1 : 0, "\u2013", Math.min(safePage * pageSize, filtered.length), " of ", filtered.length] }), _jsx(CompactSelect, { label: "Rows per page", value: String(pageSize), options: [10, 25, 50].map((v) => ({
                            value: String(v),
                            label: String(v),
                        })), onChange: (v) => {
                            setPageSize(Number(v));
                            setPage(1);
                        } }), _jsx(ActionButton, { "aria-label": "Previous page", isDisabled: safePage <= 1, onClick: () => setPage(safePage - 1), children: "\u2039" }), _jsxs("span", { children: ["Page ", safePage, " of ", maxPage] }), _jsx(ActionButton, { "aria-label": "Next page", isDisabled: safePage >= maxPage, onClick: () => setPage(safePage + 1), children: "\u203A" })] }), _jsxs(Inspector, { open: panel !== null, title: panel === "filters"
                    ? "Filter records"
                    : panel === "columns"
                        ? "Columns"
                        : "Sort records", onClose: () => setPanel(null), children: [panel === "filters" && (_jsxs(_Fragment, { children: [_jsx(QueryBuilder, { value: draft, onChange: setDraft, columns: initialColumns }), _jsxs("div", { className: "ac-toolbar", children: [_jsx(ActionButton, { onClick: () => {
                                            setQuery(draft);
                                            setPanel(null);
                                        }, children: "Apply filters" }), _jsx(ActionButton, { variant: "secondary", onClick: () => {
                                            setDraft(emptyQuery());
                                            setQuery(emptyQuery());
                                            setPanel(null);
                                        }, children: "Clear filters" })] })] })), panel === "columns" && (_jsxs("div", { className: "ac-stack", children: [columns.map((c, i) => (_jsxs("div", { className: "ac-column-row", children: [_jsx(Checkbox, { id: `column-${c.key}`, label: c.label, isDisabled: c.required, isChecked: c.visible, onChange: (_, v) => setColumns(columns.map((x) => x.key === c.key ? { ...x, visible: v } : x)) }), _jsx(ActionButton, { variant: "plain", "aria-label": `Move ${c.label} up`, isDisabled: i === 0, onClick: () => {
                                            const next = [...columns];
                                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                            setColumns(next);
                                        }, children: "\u2191" }), _jsx(ActionButton, { variant: "plain", "aria-label": `Move ${c.label} down`, isDisabled: i === columns.length - 1, onClick: () => {
                                            const next = [...columns];
                                            [next[i + 1], next[i]] = [next[i], next[i + 1]];
                                            setColumns(next);
                                        }, children: "\u2193" }), _jsx("input", { type: "number", "aria-label": `${c.label} width`, min: c.minWidth ?? 80, max: 800, value: c.width, onChange: (e) => width(c.key, Number(e.target.value)) })] }, c.key))), _jsx(ActionButton, { variant: "secondary", onClick: () => setColumns(initialColumns.map((c) => ({ ...c, visible: true }))), children: "Reset columns" })] })), panel === "sort" && (_jsxs("div", { className: "ac-stack", children: [sorts.map((s, i) => (_jsxs("div", { className: "ac-query-row", children: [_jsx(CompactSelect, { label: `Sort field ${i + 1}`, value: s.field, options: initialColumns
                                            .filter((c) => c.key === s.field ||
                                            !sorts.some((x) => x.field === c.key))
                                            .map((c) => ({ value: c.key, label: c.label })), onChange: (field) => setSorts(sorts.map((x, j) => (i === j ? { ...x, field } : x))) }), _jsx(CompactSelect, { label: `Sort direction ${i + 1}`, value: s.direction, options: [
                                            { value: "asc", label: "Ascending" },
                                            { value: "desc", label: "Descending" },
                                        ], onChange: (direction) => setSorts(sorts.map((x, j) => i === j
                                            ? { ...x, direction: direction }
                                            : x)) }), _jsx(ActionButton, { "aria-label": `Remove sort ${i + 1}`, variant: "plain", onClick: () => setSorts(sorts.filter((_, j) => i !== j)), children: "\u00D7" })] }, i))), _jsx(ActionButton, { isDisabled: sorts.length >= initialColumns.length, onClick: () => {
                                    const c = initialColumns.find((c) => !sorts.some((s) => s.field === c.key));
                                    if (c)
                                        setSorts([...sorts, { field: c.key, direction: "asc" }]);
                                }, children: "Add sort" }), _jsx(ActionButton, { variant: "secondary", onClick: () => setSorts([]), children: "Clear sorting" })] }))] })] }));
}
export function RecordActions({ label, items, }) {
    const [open, setOpen] = useState(false);
    return (_jsx(Dropdown, { isOpen: open, onOpenChange: setOpen, onSelect: () => setOpen(false), toggle: (ref) => (_jsx(MenuToggle, { ref: ref, "aria-label": label, isExpanded: open, variant: "plain", onClick: () => setOpen(!open), children: _jsx(EllipsisVIcon, {}) })), children: _jsx(DropdownList, { children: items.map((i) => (_jsx(DropdownItem, { onClick: () => {
                    setOpen(false);
                    i.run();
                }, children: i.label }, i.label))) }) }));
}
