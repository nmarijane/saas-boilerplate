import type {Column, RecordRow} from "../src";
import { Alert, Form, Switch } from "@patternfly/react-core";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ActionButton,
  ActivityTimeline,
  AppShell,
  
  CompactSelect,
  Field,
  Inspector,
  PageHeader,
  
  RecordTable,
  StatusPill
} from "../src";
import "../src/styles/index.css";
const rows: RecordRow[] = [
  {
    id: "RUN024",
    tool: "Organise Disclosure Material",
    matter: "DEMO024",
    status: "Needs review",
    interface: "Form",
    price: 49.99,
  },
  {
    id: "RUN023",
    tool: "Matter Assistant",
    matter: "DEMO023",
    status: "Completed",
    interface: "Chat",
    price: null,
  },
  {
    id: "RUN022",
    tool: "Organise Disclosure Material",
    matter: "DEMO022",
    status: "Failed",
    interface: "Form",
    price: 49.99,
  },
  {
    id: "RUN021",
    tool: "Chronology Builder",
    matter: "DEMO021",
    status: "Processing",
    interface: "Form",
    price: null,
  },
  {
    id: "RUN020",
    tool: "Organise Disclosure Material",
    matter: "DEMO020",
    status: "Completed",
    interface: "Form",
    price: 49.99,
  },
];
const columns: Column[] = [
  { key: "id", label: "Run ID", width: 128, required: true },
  { key: "tool", label: "Tool", width: 260 },
  { key: "matter", label: "Matter", width: 144 },
  { key: "status", label: "Status", width: 144 },
  { key: "interface", label: "Interface", width: 112 },
  { key: "price", label: "Price (AUD)", width: 112 },
];
function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
    const [route, setRoute] = useState(location.hash || "#runs");
    const [record, setRecord] = useState<RecordRow | null>(null);
    const [notice, setNotice] = useState("");
    const [initialState, setInitialState] = useState<"ready" | "loading" | "error">(
      "ready",
    );
  useEffect(() => {
    document.documentElement.dataset.acTheme = theme;
    document.documentElement.classList.toggle(
      "pf-v6-theme-dark",
      theme === "dark",
    );
  }, [theme]);
  useEffect(() => {
    const h = () => setRoute(location.hash || "#runs");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const title =
    route === "#settings"
      ? "Workspace settings"
      : route === "#preferences"
        ? "Preferences"
        : route === "#form"
          ? "Organise Disclosure Material"
          : route === "#tools"
            ? "AI Tools"
            : route === "#solutions"
              ? "Tailored Solutions"
              : "Runs & Results";
  useEffect(() => {
    document.title = `${title} · AI Chambers reference`;
  }, [title]);
  const exportRows = (ids: string[]) => {
    const chosen = rows.filter((r) => ids.includes(r.id));
    const blob = new Blob([JSON.stringify(chosen, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "demo-records.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${ids.length} demo records.`);
  };
  return (
    <AppShell
      workspace="Bennett Criminal Law"
      current={route}
      theme={theme}
      onThemeChange={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <PageHeader
        title={title}
        meta={<StatusPill>Reference only</StatusPill>}
      />
      <nav className="ac-demo-nav" aria-label="Reference examples">
        <a href="#runs">Records</a>
        <a href="#settings">Workspace settings</a>
        <a href="#preferences">Preferences</a>
        <a href="#form">Disclosure form</a>
      </nav>
      {notice && <Alert isInline title={notice} variant="info" />}
      {route === "#settings" ? (
        <Settings />
      ) : route === "#preferences" ? (
        <Preferences />
      ) : route === "#form" ? (
        <Disclosure />
      ) : (
        <>
          <p>
            <small>
              Fictional data. No production accounts, payments or workflows are
              connected.
            </small>
          </p>
          <div className="ac-toolbar">
            <ActionButton onClick={() => setInitialState("ready")}>
              Ready state
            </ActionButton>
            <ActionButton onClick={() => setInitialState("loading")}>
              Loading state
            </ActionButton>
            <ActionButton onClick={() => setInitialState("error")}>
              Error state
            </ActionButton>
          </div>
          <RecordTable
            key={initialState}
            rows={rows}
            columns={columns}
            label="runs"
            initialState={initialState}
            onInspect={setRecord}
            onExport={exportRows}
          />
        </>
      )}
      <Inspector
        open={!!record}
        title={`Run ${record?.id ?? ""}`}
        onClose={() => setRecord(null)}
      >
        {record && (
          <>
            <dl>
              {Object.entries(record).map(([k, v]) => (
                <div className="ac-settings-row" key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
            <h2>Activity</h2>
            <ActivityTimeline
              events={[
                {
                  id: "e1",
                  action: "Uploaded",
                  actor: "Jordan Lee",
                  at: "2026-10-25T02:02:00Z",
                },
                {
                  id: "e2",
                  action: "Processing started",
                  actor: "Service",
                  at: "2026-10-25T02:03:00Z",
                },
              ]}
            />
          </>
        )}
      </Inspector>
    </AppShell>
  );
}
function Settings() {
  const [name, setName] = useState("Bennett Criminal Law");
    const [email, setEmail] = useState("admin@example.test");
    const [timezone, setTimezone] = useState("Australia/Perth");
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
  return (
    <div className="ac-grid">
      <Form
        className="ac-main-panel ac-surface"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          if (!name.trim()) {
            setError("Workspace name is required.");
            e.currentTarget.querySelector("input")?.focus();
            return;
          }
          if (!/^\S[^\s@]*@\S[^\s.]*\.\S+$/.test(email)) {
            setError("Enter a valid email address.");
            e.currentTarget
              .querySelector<HTMLInputElement>("input[type=email]")
              ?.focus();
            return;
          }
          setError("");
          setSaved(true);
        }}
      >
        <h2>Workspace profile</h2>
        <div className="ac-form-grid">
          <Field
            label="Workspace name"
            required
            error={error.includes("name") ? error : undefined}
            value={name}
            onChange={(v) => {
              setName(v);
              setSaved(false);
            }}
          />
          <Field
            label="Contact email"
            type="email"
            required
            value={email}
            onChange={(v) => {
              setEmail(v);
              setSaved(false);
            }}
            error={error.includes("email") ? error : undefined}
          />
        </div>
        <h2>Regional defaults</h2>
        <CompactSelect
          label="Timezone"
          value={timezone}
          onChange={setTimezone}
          options={[
            { value: "Australia/Perth", label: "Australia/Perth" },
            { value: "Australia/Sydney", label: "Australia/Sydney" },
            { value: "Asia/Makassar", label: "Asia/Makassar" },
          ]}
        />
        {error && (
          <p className="ac-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p role="status">
            Demo values accepted. No server write was performed.
          </p>
        )}
        <div className="ac-toolbar">
          <ActionButton type="submit">Validate changes</ActionButton>
        </div>
      </Form>
      <aside className="ac-side-panel ac-surface">
        <h2>Workspace scope</h2>
        <p>Defaults apply to new members. Backend policies govern access.</p>
        <p>
          This reference validates locally and does not save production
          settings.
        </p>
      </aside>
    </div>
  );
}
function Preferences() {
  const [density, setDensity] = useState("compact");
    const [mode, setMode] = useState("table");
    const [remember, setRemember] = useState(true);
  return (
    <section className="ac-surface">
      <h2>Tables & navigation</h2>
      <div className="ac-settings-row">
        <span>Density</span>
        <CompactSelect
          label="Density"
          value={density}
          onChange={setDensity}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
          ]}
        />
      </div>
      <div className="ac-settings-row">
        <span>Default catalogue view</span>
        <CompactSelect
          label="Catalogue view"
          value={mode}
          onChange={setMode}
          options={[
            { value: "table", label: "Table" },
            { value: "grid", label: "Grid" },
          ]}
        />
      </div>
      <div className="ac-settings-row">
        <Switch
          id="remember"
          label="Remember views"
          isChecked={remember}
          onChange={(_, v) => setRemember(v)}
        />
      </div>
      <p>
        <small>
          Example state only. Personal preferences never grant permissions.
        </small>
      </p>
    </section>
  );
}
function Disclosure() {
  const [first, setFirst] = useState("");
    const [last, setLast] = useState("");
    const [email, setEmail] = useState("");
    const [client, setClient] = useState("");
    const [matter, setMatter] = useState("");
    const [terms, setTerms] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
  const formats = ["pdf", "jpg", "gif", "png", "jpeg", "doc", "docx", "txt"];
  return (
    <Form
      noValidate
      className="ac-surface"
      onSubmit={(e) => {
        e.preventDefault();
        const list = [];
        if (!first || !last || !client)
          list.push("Your name and client name are required.");
        if (!/^\S[^\s@]*@\S[^\s.]*\.\S+$/.test(email))
          list.push("Enter a valid email address.");
        if (!files.length) list.push("Add disclosure material.");
        if (
          files.length > 20 ||
          files.some(
            (f) =>
              f.size > 100 * 1024 * 1024 ||
              !formats.includes(f.name.split(".").pop()?.toLowerCase() ?? ""),
          )
        )
          list.push("Use an accepted format, up to 20 files, 100 MB each.");
        if (!terms) list.push("Accept the terms of use and disclaimer.");
        setErrors(
          list.length
            ? list
            : ["Demo validated. Payment is deliberately not connected."],
        );
      }}
    >
      <h2>Your details</h2>
      <div className="ac-form-grid">
        <Field label="First name" required value={first} onChange={setFirst} />
        <Field label="Last name" required value={last} onChange={setLast} />
        <Field
          label="Your email"
          type="email"
          required
          value={email}
          onChange={setEmail}
        />
      </div>
      <h2>Matter details</h2>
      <div className="ac-form-grid">
        <Field
          label="Client name"
          required
          value={client}
          onChange={setClient}
        />
        <Field
          label="Matter number (optional)"
          value={matter}
          onChange={setMatter}
        />
      </div>
      <label htmlFor="files">Disclosure material (required)</label>
      <input
        id="files"
        type="file"
        multiple
        accept=".pdf,.jpg,.gif,.png,.jpeg,.doc,.docx,.txt"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <small>Up to 20 files · 100 MB each · PDF, images, Word and text</small>
      <ul>
        {files.map((f, i) => (
          <li key={i}>
            {f.name} · {Math.ceil(f.size / 1024)} KB
          </li>
        ))}
      </ul>
      <h2>Terms of use and disclaimer</h2>
      <p>
        Outputs may contain errors. You remain responsible for reviewing all
        results.
      </p>
      <a href="/tokens/disclosure.schema.json" target="_blank" rel="noreferrer">
        Read full supplied terms
      </a>
      <label>
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
        />{" "}
        I agree to the terms of use and disclaimer
      </label>
      <p>
        Configured base price: AUD 49.99. This demonstration does not charge or
        submit a job.
      </p>
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <ActionButton type="submit">Validate request</ActionButton>
    </Form>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
