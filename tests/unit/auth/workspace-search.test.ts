import { describe, expect, it } from "vitest";
import { byName } from "@/features/auth/organization/workspace-search";

// cmdk asks each row for a score (value, search, keywords): 0 hides the row. A
// row of the workspace list has the id of its workspace for value, and the name
// for keyword.
describe("byName", () => {
  it("keeps a row whose name holds what was typed", () => {
    expect(byName("org_1", "nord", ["Studio Nord"])).toBe(1);
    expect(byName("org_1", "stu", ["Studio Nord"])).toBe(1);
  });

  it("hides a row whose name does not", () => {
    expect(byName("org_1", "sud", ["Studio Nord"])).toBe(0);
  });

  it("ignores case and accents, in the name and in what was typed", () => {
    expect(byName("org_7", "edit", ["Éditions du Phare"])).toBe(1);
    expect(byName("org_7", "ÉDIT", ["Editions du Phare"])).toBe(1);
  });

  it("never searches the id, which is the value of the row: nobody types it", () => {
    expect(byName("org_1", "org", ["Studio Nord"])).toBe(0);
    expect(byName("org_1", "org_1", ["Studio Nord"])).toBe(0);
    expect(byName("k3Jd9xQ2", "k3", ["Studio Nord"])).toBe(0);
  });

  it("keeps every row while nothing is typed", () => {
    expect(byName("org_1", "", ["Studio Nord"])).toBe(1);
    expect(byName("org_1", "   ", ["Studio Nord"])).toBe(1);
  });

  it("hides a row that has no name to search once something is typed", () => {
    expect(byName("org_1", "a", undefined)).toBe(0);
    expect(byName("org_1", "a", [])).toBe(0);
  });
});
