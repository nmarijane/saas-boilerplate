import type {Column, Query, RecordRow, Selection, Sort, View} from "../models/records";
import {
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Spinner,
} from "@patternfly/react-core";
import { EllipsisVIcon } from "@patternfly/react-icons";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  
  emptyQuery,
  parseViews,
  
  queryRows,
  
  selected,
  
  selectionCount,
  
  toggleId
  
} from "../models/records";
import { ActionButton, Inspector, StatusPill } from "./Primitives";
import { CompactSelect, QueryBuilder } from "./QueryBuilder";
export interface RecordTableProps {
  rows: RecordRow[];
  columns: Column[];
  label: string;
  /** Demonstrator uses a bounded local dataset. Production adapter must supply authorised records. */
  onInspect: (row: RecordRow) => void;
  onExport?: (ids: string[]) => void;
  initialState?: "ready" | "loading" | "error";
  /** Opt-in only for non-sensitive preferences/fixtures; use a server view store in production. */
  viewStore?: { load: () => unknown; save: (views: View[]) => void };
}
export function RecordTable({
  rows,
  columns: initialColumns,
  label,
  onInspect,
  onExport,
  initialState = "ready",
  viewStore,
}: RecordTableProps) {
  const [columns, setColumns] = useState(
      initialColumns.map((c) => ({ ...c, visible: true })),
    );
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState<Query>(emptyQuery);
    const [sorts, setSorts] = useState<Sort[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [selection, setSelection] = useState<Selection>({
      kind: "explicit",
      ids: [],
    });
    const [mode, setMode] = useState<"table" | "grid">("table");
    const [density, setDensity] = useState<"compact" | "comfortable">("compact");
    const [panel, setPanel] = useState<"filters" | "columns" | "sort" | null>(null);
    const [draft, setDraft] = useState<Query>(emptyQuery);
    const [views, setViews] = useState<View[]>(() => {
      try {
        return parseViews(viewStore?.load(), initialColumns);
      } catch {
        return [];
      }
    });
    const [viewName, setViewName] = useState("");
    const [viewId, setViewId] = useState("");
    const [message, setMessage] = useState("");
    const [state, setState] = useState(initialState);
  const visible = columns.filter((c) => c.visible);
    const filtered = useMemo(
      () => queryRows(rows, search, query, sorts),
      [rows, search, query, sorts],
    );
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, maxPage);
    const shown = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setPage(1);
    setSelection({ kind: "explicit", ids: [] });
  }, [search, query, sorts]);
  useEffect(() => {
    setSelection({ kind: "explicit", ids: [] });
  }, [rows]);
  const count = selectionCount(selection);
    const ids = filtered.filter((r) => selected(selection, r.id)).map((r) => r.id);
    const allPage = shown.length > 0 && shown.every((r) => selected(selection, r.id));
    const somePage = shown.some((r) => selected(selection, r.id));
  const view = (): View => ({
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
    const v = view();
      const next = [...views.filter((x) => x.id !== v.id), v];
    try {
      viewStore?.save(next);
      setViews(next);
      setViewId(v.id);
      setMessage(viewStore ? "View saved." : "View saved for this session.");
    } catch {
      setMessage("Unable to save view. Your current settings are preserved.");
    }
  };
  const restore = (id: string) => {
    const v = views.find((x) => x.id === id);
    setViewId(id);
    if (!v) return;
    setViewName(v.name);
    setSearch(v.search);
    setQuery(v.query);
    setSorts(v.sorts);
    setDensity(v.density);
    setMode(v.mode);
    setPageSize(v.pageSize);
    setPage(1);
    setColumns(
      v.columns.map((c) => ({
        ...initialColumns.find((x) => x.key === c.key)!,
        ...c,
      })),
    );
    setSelection({ kind: "explicit", ids: [] });
  };
  const width = (key: string, n: number) =>
    setColumns((prev) =>
      prev.map((c) =>
        c.key === key
          ? {
              ...c,
              width: Math.round(Math.max(c.minWidth ?? 80, Math.min(800, n))),
            }
          : c,
      ),
    );
  const resize = (
    key: string,
    e: React.PointerEvent<HTMLSpanElement>,
    start: number,
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = e.currentTarget;
      const x = e.clientX;
    const move = (p: PointerEvent) => width(key, start + p.clientX - x);
    const end = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };
  const actions = (row?: RecordRow) => (
    <RecordActions
      label={row ? `Actions for ${row.id}` : `Actions for ${count} selected`}
      items={
        row
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
            ]
      }
    />
  );
  const cell = (row: RecordRow, key: string) =>
    key === "status" ? (
      <StatusPill
        tone={
          row[key] === "Failed"
            ? "danger"
            : row[key] === "Needs review"
              ? "warning"
              : row[key] === "Completed"
                ? "success"
                : "info"
        }
      >
        {String(row[key] ?? "—")}
      </StatusPill>
    ) : (
      String(row[key] ?? "—")
    );
  return (
    <section className="ac-records" aria-label={label} data-density={density}>
      <div className="ac-toolbar">
        <CompactSelect
          label="Saved views"
          value={viewId}
          options={[
            { value: "", label: "Current view" },
            ...views.map((v) => ({ value: v.id, label: v.name })),
          ]}
          onChange={restore}
        />
        <input
          aria-label="View name"
          placeholder="Name this view"
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
        />
        <ActionButton onClick={save} variant="secondary">
          Save view
        </ActionButton>
        <span role="status">{message}</span>
      </div>
      <div className="ac-toolbar">
        <div className="ac-search">
          <input
            ref={searchRef}
            type="search"
            aria-label={`Search ${label}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
          />
          {search && (
            <ActionButton
              variant="plain"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
            >
              ×
            </ActionButton>
          )}
        </div>
        <ActionButton
          variant="secondary"
          onClick={() => {
            setDraft(query);
            setPanel("filters");
          }}
        >
          Filter
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => setPanel("sort")}>
          Sort ({sorts.length})
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => setPanel("columns")}>
          Columns
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() =>
            setDensity(density === "compact" ? "comfortable" : "compact")
          }
        >
          {density === "compact" ? "Compact" : "Comfortable"}
        </ActionButton>
        <div className="ac-inline" role="group" aria-label="Display mode">
          <ActionButton
            variant={mode === "table" ? "primary" : "secondary"}
            aria-pressed={mode === "table"}
            onClick={() => setMode("table")}
          >
            Table
          </ActionButton>
          <ActionButton
            variant={mode === "grid" ? "primary" : "secondary"}
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            Grid
          </ActionButton>
        </div>
      </div>
      {count > 0 && (
        <div
          className="ac-selection"
          role="region"
          aria-label="Selected records"
        >
          <strong>{count} selected</strong>
          <ActionButton
            variant="link"
            onClick={() =>
              setSelection({
                kind: "query",
                snapshot: JSON.stringify({ search, query }),
                total: filtered.length,
                excludedIds: [],
              })
            }
          >
            Select all {filtered.length} matching
          </ActionButton>
          {actions()}
          <ActionButton
            variant="plain"
            aria-label="Clear selection"
            onClick={() => setSelection({ kind: "explicit", ids: [] })}
          >
            ×
          </ActionButton>
        </div>
      )}
      <div className="ac-record-frame" aria-busy={state === "loading"}>
        {state === "loading" ? (
          <div className="ac-state" role="status">
            <Spinner size="md" aria-label="Loading records" />
            Loading records…
          </div>
        ) : state === "error" ? (
          <div className="ac-state" role="alert">
            Unable to load records.
            <ActionButton onClick={() => setState("ready")}>
              Retry demo load
            </ActionButton>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ac-state">
            <h2>{rows.length ? "No matching records" : "No records yet"}</h2>
            {rows.length > 0 && (
              <ActionButton
                onClick={() => {
                  setSearch("");
                  setQuery(emptyQuery());
                }}
              >
                Clear filters
              </ActionButton>
            )}
          </div>
        ) : (
          <>
            <div
              className={mode === "table" ? "ac-desktop-table" : "ac-hidden"}
            >
              <Table
                role="table"
                aria-label={label}
                variant="compact"
                gridBreakPoint=""
                className="ac-table"
              >
                <colgroup>
                  <col style={{ width: 44 }} />
                  {visible.map((c) => (
                    <col key={c.key} style={{ width: c.width }} />
                  ))}
                  <col style={{ width: 48 }} />
                </colgroup>
                <Thead>
                  <Tr>
                    <Th>
                      <Checkbox
                        id="select-page"
                        aria-label="Select current page"
                        isChecked={somePage && !allPage ? null : allPage}
                        onChange={(_, v) => {
                          let next = selection;
                          for (const r of shown)
                            if (selected(next, r.id) !== v)
                              next = toggleId(next, r.id);
                          setSelection(next);
                        }}
                      />
                    </Th>
                    {visible.map((c) => (
                      <Th
                        key={c.key}
                        aria-sort={
                          sorts[0]?.field === c.key
                            ? sorts[0].direction === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        <button
                          className="ac-sort-button"
                          onClick={() =>
                            setSorts([
                              {
                                field: c.key,
                                direction:
                                  sorts[0]?.field === c.key &&
                                  sorts[0].direction === "asc"
                                    ? "desc"
                                    : "asc",
                              },
                            ])
                          }
                        >
                          {c.label}
                          {sorts.some((s) => s.field === c.key)
                            ? ` ${sorts.findIndex((s) => s.field === c.key) + 1} ${sorts.find((s) => s.field === c.key)?.direction === "asc" ? "↑" : "↓"}`
                            : ""}
                        </button>
                        <span
                          className="ac-resize"
                          tabIndex={0}
                          role="separator"
                          aria-label={`Resize ${c.label}`}
                          aria-orientation="vertical"
                          aria-valuenow={c.width}
                          aria-valuemin={c.minWidth ?? 80}
                          aria-valuemax={800}
                          onPointerDown={(e) => resize(c.key, e, c.width)}
                          onKeyDown={(e) => {
                            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                              e.preventDefault();
                              width(
                                c.key,
                                c.width + (e.key === "ArrowRight" ? 8 : -8),
                              );
                            }
                          }}
                        />
                      </Th>
                    ))}
                    <Th screenReaderText="Row actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {shown.map((row) => (
                    <Tr
                      key={row.id}
                      className={
                        selected(selection, row.id) ? "ac-selected" : ""
                      }
                    >
                      <Td>
                        <Checkbox
                          id={`row-${row.id}`}
                          aria-label={`Select ${row.id}`}
                          isChecked={selected(selection, row.id)}
                          onChange={() =>
                            setSelection(toggleId(selection, row.id))
                          }
                        />
                      </Td>
                      {visible.map((c, i) => (
                        <Td key={c.key} dataLabel={c.label}>
                          <div
                            className="ac-cell"
                            title={String(row[c.key] ?? "—")}
                          >
                            {i === 0 ? (
                              <button
                                className="ac-record-link"
                                onClick={() => onInspect(row)}
                              >
                                {cell(row, c.key)}
                              </button>
                            ) : (
                              cell(row, c.key)
                            )}
                          </div>
                        </Td>
                      ))}
                      <Td>{actions(row)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
            <ul
              className={mode === "grid" ? "ac-card-grid" : "ac-mobile-list"}
              aria-label={`${label} alternate view`}
            >
              {shown.map((row) => (
                <li
                  key={row.id}
                  className={selected(selection, row.id) ? "ac-selected" : ""}
                >
                  <Checkbox
                    id={`mobile-${row.id}`}
                    aria-label={`Select ${row.id}`}
                    isChecked={selected(selection, row.id)}
                    onChange={() => setSelection(toggleId(selection, row.id))}
                  />
                  <button
                    className="ac-record-link"
                    onClick={() => onInspect(row)}
                  >
                    {String(row[visible[0]?.key] ?? row.id)}
                  </button>
                  {cell(row, "status")}
                  {actions(row)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <footer className="ac-toolbar ac-pagination">
        <span>
          {filtered.length ? (safePage - 1) * pageSize + 1 : 0}–
          {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
        </span>
        <CompactSelect
          label="Rows per page"
          value={String(pageSize)}
          options={[10, 25, 50].map((v) => ({
            value: String(v),
            label: String(v),
          }))}
          onChange={(v) => {
            setPageSize(Number(v));
            setPage(1);
          }}
        />
        <ActionButton
          aria-label="Previous page"
          isDisabled={safePage <= 1}
          onClick={() => setPage(safePage - 1)}
        >
          ‹
        </ActionButton>
        <span>
          Page {safePage} of {maxPage}
        </span>
        <ActionButton
          aria-label="Next page"
          isDisabled={safePage >= maxPage}
          onClick={() => setPage(safePage + 1)}
        >
          ›
        </ActionButton>
      </footer>
      <Inspector
        open={panel !== null}
        title={
          panel === "filters"
            ? "Filter records"
            : panel === "columns"
              ? "Columns"
              : "Sort records"
        }
        onClose={() => setPanel(null)}
      >
        {panel === "filters" && (
          <>
            <QueryBuilder
              value={draft}
              onChange={setDraft}
              columns={initialColumns}
            />
            <div className="ac-toolbar">
              <ActionButton
                onClick={() => {
                  setQuery(draft);
                  setPanel(null);
                }}
              >
                Apply filters
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() => {
                  setDraft(emptyQuery());
                  setQuery(emptyQuery());
                  setPanel(null);
                }}
              >
                Clear filters
              </ActionButton>
            </div>
          </>
        )}
        {panel === "columns" && (
          <div className="ac-stack">
            {columns.map((c, i) => (
              <div className="ac-column-row" key={c.key}>
                <Checkbox
                  id={`column-${c.key}`}
                  label={c.label}
                  isDisabled={c.required}
                  isChecked={c.visible}
                  onChange={(_, v) =>
                    setColumns(
                      columns.map((x) =>
                        x.key === c.key ? { ...x, visible: v } : x,
                      ),
                    )
                  }
                />
                <ActionButton
                  variant="plain"
                  aria-label={`Move ${c.label} up`}
                  isDisabled={i === 0}
                  onClick={() => {
                    const next = [...columns];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    setColumns(next);
                  }}
                >
                  ↑
                </ActionButton>
                <ActionButton
                  variant="plain"
                  aria-label={`Move ${c.label} down`}
                  isDisabled={i === columns.length - 1}
                  onClick={() => {
                    const next = [...columns];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    setColumns(next);
                  }}
                >
                  ↓
                </ActionButton>
                <input
                  type="number"
                  aria-label={`${c.label} width`}
                  min={c.minWidth ?? 80}
                  max={800}
                  value={c.width}
                  onChange={(e) => width(c.key, Number(e.target.value))}
                />
              </div>
            ))}
            <ActionButton
              variant="secondary"
              onClick={() =>
                setColumns(initialColumns.map((c) => ({ ...c, visible: true })))
              }
            >
              Reset columns
            </ActionButton>
          </div>
        )}
        {panel === "sort" && (
          <div className="ac-stack">
            {sorts.map((s, i) => (
              <div className="ac-query-row" key={i}>
                <CompactSelect
                  label={`Sort field ${i + 1}`}
                  value={s.field}
                  options={initialColumns
                    .filter(
                      (c) =>
                        c.key === s.field ||
                        !sorts.some((x) => x.field === c.key),
                    )
                    .map((c) => ({ value: c.key, label: c.label }))}
                  onChange={(field) =>
                    setSorts(
                      sorts.map((x, j) => (i === j ? { ...x, field } : x)),
                    )
                  }
                />
                <CompactSelect
                  label={`Sort direction ${i + 1}`}
                  value={s.direction}
                  options={[
                    { value: "asc", label: "Ascending" },
                    { value: "desc", label: "Descending" },
                  ]}
                  onChange={(direction) =>
                    setSorts(
                      sorts.map((x, j) =>
                        i === j
                          ? { ...x, direction: direction as "asc" | "desc" }
                          : x,
                      ),
                    )
                  }
                />
                <ActionButton
                  aria-label={`Remove sort ${i + 1}`}
                  variant="plain"
                  onClick={() => setSorts(sorts.filter((_, j) => i !== j))}
                >
                  ×
                </ActionButton>
              </div>
            ))}
            <ActionButton
              isDisabled={sorts.length >= initialColumns.length}
              onClick={() => {
                const c = initialColumns.find(
                  (c) => !sorts.some((s) => s.field === c.key),
                );
                if (c) setSorts([...sorts, { field: c.key, direction: "asc" }]);
              }}
            >
              Add sort
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => setSorts([])}>
              Clear sorting
            </ActionButton>
          </div>
        )}
      </Inspector>
    </section>
  );
}
export function RecordActions({
  label,
  items,
}: {
  label: string;
  items: { label: string; run: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={() => setOpen(false)}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          aria-label={label}
          isExpanded={open}
          variant="plain"
          onClick={() => setOpen(!open)}
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
    >
      <DropdownList>
        {items.map((i) => (
          <DropdownItem
            key={i.label}
            onClick={() => {
              setOpen(false);
              i.run();
            }}
          >
            {i.label}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
}
