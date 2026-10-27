import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import brandLogo from "../../assets/logo-dark-original.png";
import { useState } from "react";
import { ActionButton, Inspector } from "./Primitives";
export const workspaceNav = [
    { label: "Workspace", items: [{ label: "Overview", href: "#overview" }] },
    {
        label: "AI Tools",
        items: [
            { label: "All tools", href: "#tools" },
            { label: "Saved tools", href: "#saved" },
        ],
    },
    {
        label: "Tailored Solutions",
        items: [
            { label: "My solutions", href: "#solutions" },
            { label: "Connections", href: "#connections" },
        ],
    },
    {
        label: "Operations",
        items: [
            { label: "Runs & Results", href: "#runs" },
            { label: "Documents", href: "#documents" },
            { label: "Settings", href: "#settings" },
        ],
    },
];
export function AppShell({ children, workspace, nav = workspaceNav, current, theme, onThemeChange, }) {
    const [collapsed, setCollapsed] = useState(false), [mobileOpen, setMobileOpen] = useState(false), [commands, setCommands] = useState(false), [q, setQ] = useState("");
    const links = nav.flatMap((g) => g.items);
    const navigation = (_jsx("nav", { "aria-label": "Module navigation", children: nav.map((g) => (_jsxs("details", { open: true, children: [_jsx("summary", { children: collapsed ? g.label.slice(0, 1) : g.label }), g.items.map((i) => (_jsx("a", { href: i.href, "aria-current": current === i.href ? "page" : undefined, title: i.label, onClick: () => setMobileOpen(false), children: collapsed ? i.label.slice(0, 1) : i.label }, i.href)))] }, g.label))) }));
    return (_jsxs("div", { className: "ac-shell", "data-collapsed": collapsed, children: [_jsx("a", { className: "ac-skip", href: "#main", children: "Skip to content" }), _jsxs("aside", { className: "ac-sidebar", children: [_jsx("div", { className: "ac-brand", children: _jsx(_Fragment, { children: collapsed ? (_jsx("span", { "aria-label": "AI Chambers", children: "AI" })) : (_jsx("img", { src: brandLogo, alt: "AI Chambers", width: 144, height: 41 })) }) }), _jsx("div", { className: "ac-workspace", children: collapsed ? "BC" : workspace }), navigation, _jsx(ActionButton, { variant: "plain", "aria-label": collapsed ? "Expand navigation" : "Collapse navigation", onClick: () => setCollapsed(!collapsed), children: collapsed ? "›" : "‹ Collapse" })] }), _jsxs("div", { className: "ac-workspace-body", children: [_jsxs("div", { className: "ac-topbar", children: [_jsx(ActionButton, { className: "ac-mobile-only", onClick: () => setMobileOpen(true), "aria-label": "Open navigation", children: "\u2630" }), _jsx("span", { children: "AI Chambers / Reference workspace" }), _jsxs(ActionButton, { variant: "secondary", onClick: () => setCommands(true), children: ["Search commands ", _jsx("kbd", { children: "Ctrl K" })] }), _jsx(ActionButton, { variant: "secondary", onClick: onThemeChange, children: theme === "light" ? "Dark theme" : "Light theme" })] }), _jsx("main", { id: "main", tabIndex: -1, children: children })] }), _jsxs("div", { className: "ac-mobile-bottom", children: [_jsx("a", { href: "#tools", children: "Tools" }), _jsx("a", { href: "#solutions", children: "Solutions" }), _jsx("a", { href: "#runs", children: "Runs" }), _jsx("a", { href: "#settings", children: "Settings" })] }), _jsx(Inspector, { open: mobileOpen, title: "Navigation", onClose: () => setMobileOpen(false), children: navigation }), _jsxs(Inspector, { open: commands, title: "Commands", onClose: () => {
                    setCommands(false);
                    setQ("");
                }, children: [_jsxs("div", { className: "ac-search", children: [_jsx("input", { autoFocus: true, "aria-label": "Search commands", value: q, onChange: (e) => setQ(e.target.value) }), q && (_jsx(ActionButton, { "aria-label": "Clear command search", onClick: () => setQ(""), children: "\u00D7" }))] }), _jsx("ul", { className: "ac-command-list", children: links
                            .filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
                            .map((i) => (_jsx("li", { children: _jsx("a", { href: i.href, onClick: () => setCommands(false), children: i.label }) }, i.href))) }), _jsx("p", { children: "Use Tab to navigate, Enter to open, Escape to close." })] }), _jsx(KeyboardCommand, { onOpen: () => setCommands(true) })] }));
}
function KeyboardCommand({ onOpen }) {
    useKeyboardCommand(onOpen);
    return null;
}
import { useEffect } from "react";
function useKeyboardCommand(onOpen) {
    useEffect(() => {
        const h = (e) => {
            if (e.isComposing)
                return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                onOpen();
            }
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onOpen]);
}
