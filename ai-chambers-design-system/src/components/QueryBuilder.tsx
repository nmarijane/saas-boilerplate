import type {MenuToggleElement} from "@patternfly/react-core";
import type {Ref} from "react";
import type {Column, Operator, Query} from "../models/records";
import {
  MenuToggle,
  
  Select as PFSelect,
  SelectList,
  SelectOption
} from "@patternfly/react-core";
import {  useId, useState } from "react";
import { ActionButton } from "./Primitives";
export function CompactSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
  const inputId = useId();
  return (
    <PFSelect
      isOpen={open}
      selected={value}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQ("");
      }}
      onSelect={(_, v) => {
        onChange(String(v));
        setOpen(false);
        setQ("");
      }}
      toggle={(ref: Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={ref}
          aria-label={label}
          onClick={() => setOpen(!open)}
          isExpanded={open}
        >
          {options.find((x) => x.value === value)?.label ?? value}
        </MenuToggle>
      )}
    >
      <div className="ac-select-search">
        <label className="ac-sr-only" htmlFor={inputId}>
          Search {label}
        </label>
        <input
          id={inputId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search options…"
        />
        <ActionButton
          variant="plain"
          aria-label={`Clear ${label} search`}
          onClick={() => setQ("")}
        >
          ×
        </ActionButton>
      </div>
      <SelectList aria-label={label}>
        {options
          .filter((x) => x.label.toLowerCase().includes(q.toLowerCase()))
          .map((x) => (
            <SelectOption key={x.value} value={x.value}>
              {x.label}
            </SelectOption>
          ))}
      </SelectList>
    </PFSelect>
  );
}
export function QueryBuilder({
  value,
  onChange,
  columns,
  depth = 0,
}: {
  value: Query;
  onChange: (q: Query) => void;
  columns: Column[];
  depth?: number;
}) {
  const operators: { value: Operator; label: string }[] = [
    { value: "eq", label: "is" },
    { value: "contains", label: "contains" },
    { value: "gt", label: "greater than" },
    { value: "lt", label: "less than" },
    { value: "empty", label: "is empty" },
  ];
  if (value.kind === "condition")
    return (
      <div className="ac-query-row">
        <CompactSelect
          label={`Field ${depth}`}
          value={value.field}
          options={columns.map((c) => ({ value: c.key, label: c.label }))}
          onChange={(field) => onChange({ ...value, field })}
        />
        <CompactSelect
          label={`Operator ${depth}`}
          value={value.operator}
          options={operators}
          onChange={(operator) =>
            onChange({ ...value, operator: operator as Operator })
          }
        />
        {value.operator !== "empty" && (
          <input
            aria-label="Filter value"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        )}
      </div>
    );
  const setChild = (i: number, q: Query) =>
    onChange({
      ...value,
      children: value.children.map((x, j) => (j === i ? q : x)),
    });
  return (
    <fieldset className="ac-query">
      <legend>Filter group {depth + 1}</legend>
      <CompactSelect
        label={`Match group ${depth}`}
        value={value.match}
        options={[
          { value: "all", label: "Match ALL" },
          { value: "any", label: "Match ANY" },
        ]}
        onChange={(match) =>
          onChange({ ...value, match: match as "all" | "any" })
        }
      />
      {value.children.map((child, i) => (
        <div key={i} className="ac-query-child">
          <QueryBuilder
            value={child}
            onChange={(q) => setChild(i, q)}
            columns={columns}
            depth={depth + 1}
          />
          <ActionButton
            variant="plain"
            aria-label={`Remove condition or group ${i + 1}`}
            onClick={() =>
              onChange({
                ...value,
                children: value.children.filter((_, j) => j !== i),
              })
            }
          >
            ×
          </ActionButton>
        </div>
      ))}
      <div className="ac-inline">
        <ActionButton
          variant="link"
          isDisabled={value.children.length >= 20}
          onClick={() =>
            onChange({
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
            })
          }
        >
          Add condition
        </ActionButton>
        <ActionButton
          variant="link"
          isDisabled={depth >= 4 || value.children.length >= 20}
          onClick={() =>
            onChange({
              ...value,
              children: [
                ...value.children,
                { kind: "group", match: "any", children: [] },
              ],
            })
          }
        >
          Add group
        </ActionButton>
      </div>
    </fieldset>
  );
}
