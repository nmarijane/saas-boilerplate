import type {ReactNode} from "react";
import {  useEffect, useState  } from "react";
import brandLogo from "../../assets/logo-dark-original.png";
import { ActionButton, Inspector } from "./Primitives";
export interface NavGroup {
  label: string;
  items: { label: string; href: string }[];
}
export const workspaceNav: NavGroup[] = [
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
export function AppShell({
  children,
  workspace,
  nav = workspaceNav,
  current,
  theme,
  onThemeChange,
}: {
  children: ReactNode;
  workspace: string;
  nav?: NavGroup[];
  current: string;
  theme: "light" | "dark";
  onThemeChange: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [commands, setCommands] = useState(false);
    const [q, setQ] = useState("");
  const links = nav.flatMap((g) => g.items);
  const navigation = (
    <nav aria-label="Module navigation">
      {nav.map((g) => (
        <details open key={g.label}>
          <summary>{collapsed ? g.label.slice(0, 1) : g.label}</summary>
          {g.items.map((i) => (
            <a
              key={i.href}
              href={i.href}
              aria-current={current === i.href ? "page" : undefined}
              title={i.label}
              onClick={() => setMobileOpen(false)}
            >
              {collapsed ? i.label.slice(0, 1) : i.label}
            </a>
          ))}
        </details>
      ))}
    </nav>
  );
  return (
    <div className="ac-shell" data-collapsed={collapsed}>
      <a className="ac-skip" href="#main">
        Skip to content
      </a>
      <aside className="ac-sidebar">
        <div className="ac-brand">
          <>
            {collapsed ? (
              <span aria-label="AI Chambers">AI</span>
            ) : (
              <img src={brandLogo} alt="AI Chambers" width={144} height={41} />
            )}
          </>
        </div>
        <div className="ac-workspace">{collapsed ? "BC" : workspace}</div>
        {navigation}
        <ActionButton
          variant="plain"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "›" : "‹ Collapse"}
        </ActionButton>
      </aside>
      <div className="ac-workspace-body">
        <div className="ac-topbar">
          <ActionButton
            className="ac-mobile-only"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </ActionButton>
          <span>AI Chambers / Reference workspace</span>
          <ActionButton variant="secondary" onClick={() => setCommands(true)}>
            Search commands <kbd>Ctrl K</kbd>
          </ActionButton>
          <ActionButton variant="secondary" onClick={onThemeChange}>
            {theme === "light" ? "Dark theme" : "Light theme"}
          </ActionButton>
        </div>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <div className="ac-mobile-bottom">
        <a href="#tools">Tools</a>
        <a href="#solutions">Solutions</a>
        <a href="#runs">Runs</a>
        <a href="#settings">Settings</a>
      </div>
      <Inspector
        open={mobileOpen}
        title="Navigation"
        onClose={() => setMobileOpen(false)}
      >
        {navigation}
      </Inspector>
      <Inspector
        open={commands}
        title="Commands"
        onClose={() => {
          setCommands(false);
          setQ("");
        }}
      >
        <div className="ac-search">
          <input
            autoFocus
            aria-label="Search commands"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <ActionButton
              aria-label="Clear command search"
              onClick={() => setQ("")}
            >
              ×
            </ActionButton>
          )}
        </div>
        <ul className="ac-command-list">
          {links
            .filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
            .map((i) => (
              <li key={i.href}>
                <a href={i.href} onClick={() => setCommands(false)}>
                  {i.label}
                </a>
              </li>
            ))}
        </ul>
        <p>Use Tab to navigate, Enter to open, Escape to close.</p>
      </Inspector>
      <KeyboardCommand onOpen={() => setCommands(true)} />
    </div>
  );
}
function KeyboardCommand({ onOpen }: { onOpen: () => void }) {
  useKeyboardCommand(onOpen);
  return null;
}
function useKeyboardCommand(onOpen: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onOpen]);
}
