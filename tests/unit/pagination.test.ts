import { describe, expect, it } from "vitest";
import { clampPage, pageFrom, totalPagesOf } from "@/shared/utils/pagination";

// What a list that is read a page at a time takes from its address and from its size: the page asked for is a
// whole number from 1 on, and a page past the last is the last, not an empty page that says "Page 99 of 2".

describe("the page an address asks for", () => {
  it.each([
    ["2", 2],
    ["1", 1],
    ["17", 17],
    ["007", 7],
    ["3abc", 3],
  ])("is %s: %i", (param, page) => {
    expect(pageFrom(param)).toBe(page);
  });

  it.each([undefined, "", "0", "-1", "-20", "abc", "NaN", "Infinity", "1e3x", " ", "99999999999999999999999"])("is the first page for %s", (param) => {
    expect(pageFrom(param)).toBe(1);
  });
});

describe("the pages of a list", () => {
  it.each([
    [0, 12, 0],
    [1, 12, 1],
    [12, 12, 1],
    [13, 12, 2],
    [24, 12, 2],
    [25, 12, 3],
    [101, 20, 6],
  ])("holds %i rows in pages of %i: %i pages", (total, size, pages) => {
    expect(totalPagesOf(total, size)).toBe(pages);
  });

  it.each([
    [1, 3, 1],
    [2, 3, 2],
    [3, 3, 3],
    // Past the last: the last
    [4, 3, 3],
    [99, 3, 3],
    // Nothing to read: the first page, which is empty, and not page 0
    [1, 0, 1],
    [5, 0, 1],
  ])("shows page %i of %i as page %i", (requested, pages, shown) => {
    expect(clampPage(requested, pages)).toBe(shown);
  });
});
