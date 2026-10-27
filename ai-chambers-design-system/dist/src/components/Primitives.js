import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
import { Button as PFButton, TextInput, FormGroup, HelperText, HelperTextItem, Spinner, Label, Modal, ModalHeader, ModalBody, ModalFooter, } from "@patternfly/react-core";
export function ActionButton({ busy = false, children, ...props }) {
    return (_jsxs(PFButton, { ...props, size: "sm", className: `ac-button ${props.className ?? ""}`, isDisabled: busy || props.isDisabled, "aria-busy": busy, children: [_jsx("span", { className: busy ? "ac-invisible" : undefined, children: children }), busy && (_jsx("span", { className: "ac-button-progress", children: _jsx(Spinner, { size: "sm", "aria-label": "Working" }) }))] }));
}
export function PageHeader({ title, meta, actions, }) {
    return (_jsxs("header", { className: "ac-page-header", children: [_jsxs("div", { className: "ac-inline", children: [_jsx("h1", { children: title }), meta] }), _jsx("div", { className: "ac-inline", children: actions })] }));
}
export function Field({ label, value, onChange, error, help, required = false, type = "text", autoComplete, }) {
    const id = useId();
    return (_jsxs(FormGroup, { label: label, fieldId: id, isRequired: required, children: [_jsx(TextInput, { id: id, value: value, onChange: (_, v) => onChange(v), type: type, required: required, autoComplete: autoComplete, validated: error ? "error" : "default", "aria-invalid": !!error, "aria-describedby": error || help ? `${id}-help` : undefined }), (error || help) && (_jsx(HelperText, { id: `${id}-help`, children: _jsx(HelperTextItem, { variant: error ? "error" : "default", children: error || help }) }))] }));
}
export function StatusPill({ children, tone = "neutral", }) {
    return (_jsx(Label, { className: `ac-pill ac-pill-${tone}`, isCompact: true, children: children }));
}
export function Inspector({ open, title, children, onClose, }) {
    return (_jsxs(Modal, { className: "ac-overlay ac-inspector", isOpen: open, onClose: onClose, "aria-labelledby": "ac-inspector-title", variant: "medium", children: [_jsx(ModalHeader, { title: title, labelId: "ac-inspector-title" }), _jsx(ModalBody, { children: children }), _jsx(ModalFooter, { children: _jsx(ActionButton, { variant: "secondary", onClick: onClose, children: "Close" }) })] }));
}
export function ActivityTimeline({ events, }) {
    return (_jsx("ol", { className: "ac-timeline", children: events.map((e) => (_jsxs("li", { children: [_jsx("strong", { children: e.action }), _jsxs("span", { children: [e.actor, " \u00B7", " ", _jsxs("time", { dateTime: e.at, children: [new Intl.DateTimeFormat("en-AU", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                    timeZone: "Australia/Perth",
                                }).format(new Date(e.at)), " ", "AWST"] })] }), e.detail && _jsx("p", { children: e.detail })] }, e.id))) }));
}
