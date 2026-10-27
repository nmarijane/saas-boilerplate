import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Select as PFSelect, SelectList, SelectOption, MenuToggle, } from "@patternfly/react-core";
import { useState, useId } from "react";
import { ActionButton } from "./Primitives";
export function CompactSelect({ label, value, options, onChange, }) {
    const [open, setOpen] = useState(false), [q, setQ] = useState("");
    const inputId = useId();
    return (_jsxs(PFSelect, { isOpen: open, selected: value, onOpenChange: (v) => {
            setOpen(v);
            if (!v)
                setQ("");
        }, onSelect: (_, v) => {
            onChange(String(v));
            setOpen(false);
            setQ("");
        }, toggle: (ref) => (_jsx(MenuToggle, { ref: ref, "aria-label": label, onClick: () => setOpen(!open), isExpanded: open, children: options.find((x) => x.value === value)?.label ?? value })), children: [_jsxs("div", { className: "ac-select-search", children: [_jsxs("label", { className: "ac-sr-only", htmlFor: inputId, children: ["Search ", label] }), _jsx("input", { id: inputId, value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search options\u2026" }), _jsx(ActionButton, { variant: "plain", "aria-label": `Clear ${label} search`, onClick: () => setQ(""), children: "\u00D7" })] }), _jsx(SelectList, { "aria-label": label, children: options
                    .filter((x) => x.label.toLowerCase().includes(q.toLowerCase()))
                    .map((x) => (_jsx(SelectOption, { value: x.value, children: x.label }, x.value))) })] }));
}
export function QueryBuilder({ value, onChange, columns, depth = 0, }) {
    const operators = [
        { value: "eq", label: "is" },
        { value: "contains", label: "contains" },
        { value: "gt", label: "greater than" },
        { value: "lt", label: "less than" },
        { value: "empty", label: "is empty" },
    ];
    if (value.kind === "condition")
        return (_jsxs("div", { className: "ac-query-row", children: [_jsx(CompactSelect, { label: `Field ${depth}`, value: value.field, options: columns.map((c) => ({ value: c.key, label: c.label })), onChange: (field) => onChange({ ...value, field }) }), _jsx(CompactSelect, { label: `Operator ${depth}`, value: value.operator, options: operators, onChange: (operator) => onChange({ ...value, operator: operator }) }), value.operator !== "empty" && (_jsx("input", { "aria-label": "Filter value", value: value.value, onChange: (e) => onChange({ ...value, value: e.target.value }) }))] }));
    const setChild = (i, q) => onChange({
        ...value,
        children: value.children.map((x, j) => (j === i ? q : x)),
    });
    return (_jsxs("fieldset", { className: "ac-query", children: [_jsxs("legend", { children: ["Filter group ", depth + 1] }), _jsx(CompactSelect, { label: `Match group ${depth}`, value: value.match, options: [
                    { value: "all", label: "Match ALL" },
                    { value: "any", label: "Match ANY" },
                ], onChange: (match) => onChange({ ...value, match: match }) }), value.children.map((child, i) => (_jsxs("div", { className: "ac-query-child", children: [_jsx(QueryBuilder, { value: child, onChange: (q) => setChild(i, q), columns: columns, depth: depth + 1 }), _jsx(ActionButton, { variant: "plain", "aria-label": `Remove condition or group ${i + 1}`, onClick: () => onChange({
                            ...value,
                            children: value.children.filter((_, j) => j !== i),
                        }), children: "\u00D7" })] }, i))), _jsxs("div", { className: "ac-inline", children: [_jsx(ActionButton, { variant: "link", isDisabled: value.children.length >= 20, onClick: () => onChange({
                            ...value,
                            children: [
                                ...value.children,
                                {
                                    kind: "condition",
                                    field: columns[0].key,
                                    operator: "contains",
                                    value: "",
                                },
                            ],
                        }), children: "Add condition" }), _jsx(ActionButton, { variant: "link", isDisabled: depth >= 4 || value.children.length >= 20, onClick: () => onChange({
                            ...value,
                            children: [
                                ...value.children,
                                { kind: "group", match: "any", children: [] },
                            ],
                        }), children: "Add group" })] })] }));
}
