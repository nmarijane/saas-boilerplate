import type {Query, Selection, View} from "../src/models/records";
import assert from "node:assert/strict";
import { it } from "vitest";
import {
  resolveConflict,
  saveConflict,
  saveSucceeded,
  startSave,
} from "../src/models/operations";
import {
  matches,
  parseViews,
  
  queryRows,
  selected,
  
  selectionCount,
  toggleId,
  
  viewStorageKey
} from "../src/models/records";
const rows = [
  { id: "r1", tool: "Disclosure", status: "Failed", amount: 49.99 },
  { id: "r2", tool: "Disclosure", status: "Needs review", amount: 49.99 },
  { id: "r3", tool: "Chat", status: "Completed", amount: 0 },
];
const q: Query = {
  kind: "group",
  match: "all",
  children: [
    { kind: "condition", field: "tool", operator: "eq", value: "Disclosure" },
    {
      kind: "group",
      match: "any",
      children: [
        { kind: "condition", field: "status", operator: "eq", value: "Failed" },
        {
          kind: "condition",
          field: "status",
          operator: "eq",
          value: "Needs review",
        },
      ],
    },
  ],
};
it("nested all/any restricts scope correctly", () =>
  assert.deepEqual(
    rows.filter((r) => matches(r, q)).map((r) => r.id),
    ["r1", "r2"],
  ));
it("search and deterministic multi sort compose", () =>
  assert.deepEqual(
    queryRows(rows, "disclosure", q, [
      { field: "status", direction: "desc" },
      { field: "id", direction: "asc" },
    ]).map((r) => r.id),
    ["r2", "r1"],
  ));
it("numeric comparison excludes absent and nonnumeric values", () => {
  const condition: Query = {
    kind: "condition",
    field: "amount",
    operator: "gt",
    value: "20",
  };
  assert.equal(matches(rows[0], condition), true);
  assert.equal(matches({ id: "x", amount: null }, condition), false);
  assert.equal(matches({ id: "x", amount: "abc" }, condition), false);
});
it("explicit selection toggles without duplicates", () => {
  let s: Selection = { kind: "explicit", ids: [] };
  s = toggleId(s, "r1");
  s = toggleId(s, "r2");
  assert.equal(selectionCount(s), 2);
  s = toggleId(s, "r1");
  assert.equal(selected(s, "r1"), false);
});
it("all-results selection uses exclusions", () => {
  let s: Selection = {
    kind: "query",
    snapshot: "immutable-query",
    total: 15,
    excludedIds: [],
  };
  s = toggleId(s, "r1");
  assert.equal(selectionCount(s), 14);
  assert.equal(selected(s, "r1"), false);
  s = toggleId(s, "r1");
  assert.equal(selectionCount(s), 15);
});
const cols = [{ key: "tool", label: "Tool", width: 200, required: true }];
const view: View = {
  version: 1,
  id: "v1",
  name: "My view",
  search: "",
  query: { kind: "group", match: "all", children: [] },
  sorts: [],
  columns: [{ key: "tool", width: 200, visible: true }],
  density: "compact",
  mode: "table",
  pageSize: 25,
};
it("saved views roundtrip and reject missing required identity column", () => {
  assert.equal(parseViews([view], cols).length, 1);
  assert.equal(
    parseViews(
      [{ ...view, columns: [{ key: "tool", width: 200, visible: false }] }],
      cols,
    ).length,
    0,
  );
});
it("invalid view schemas and query fields are rejected", () => {
  assert.equal(
    parseViews(
      [
        { ...view, version: 999 },
        { ...view, pageSize: 100000 },
        {
          ...view,
          query: {
            kind: "condition",
            field: "secret",
            operator: "eq",
            value: "",
          },
        },
        { ...view, columns: [{ key: "tool", width: Number.NaN, visible: true }] },
      ],
      cols,
    ).length,
    0,
  );
});
it("view storage keys isolate tenant/user/resource without delimiter collisions", () => {
  assert.notEqual(
    viewStorageKey("a:b", "c", "runs"),
    viewStorageKey("a", "b:c", "runs"),
  );
  assert.notEqual(
    viewStorageKey("a", "u1", "runs"),
    viewStorageKey("a", "u2", "runs"),
  );
});
it("duplicate save cannot start while saving", () => {
  const s = startSave({ kind: "dirty", value: "mine", revision: "v1" }, "op1");
  assert.throws(() => startSave(s, "op2"));
});
it("stale completion cannot overwrite a different operation", () => {
  const s = startSave({ kind: "dirty", value: "mine", revision: "v1" }, "op2");
  assert.deepEqual(saveSucceeded(s, "op1", "stale", "v2"), s);
});
it("conflict retains local draft and requires reviewed resolution", () => {
  const s = startSave({ kind: "dirty", value: "mine", revision: "v1" }, "op1");
  const c = saveConflict(s, "op1", "theirs", "v2");
  assert.equal(c.kind, "conflict");
  assert.equal(c.value, "mine");
  assert.throws(() => startSave(c, "op2"));
  assert.deepEqual(resolveConflict(c, "merged"), {
    kind: "dirty",
    value: "merged",
    revision: "v2",
  });
});
