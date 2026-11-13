import type {
  NotificationItem,
  NotificationListState,
} from "@/features/notifications/list-state";
import { describe, expect, it } from "vitest";
import {
  hasUnreadRows,
  INITIAL_NOTIFICATION_LIST,
  notificationListReducer as reduce,
} from "@/features/notifications/list-state";

function item(id: string, read = false): NotificationItem {
  return {
    id,
    title: `Title ${id}`,
    body: "Body",
    read,
    type: "info",
    link: null,
    createdAt: "2026-11-03T10:00:00.000Z",
  };
}

function ready(items: NotificationItem[], refreshing = false): NotificationListState {
  return { status: "ready", items, refreshing };
}

describe("the list of the panel", () => {
  it("starts out being read", () => {
    expect(INITIAL_NOTIFICATION_LIST).toEqual({ status: "loading" });
  });

  describe("when it is read", () => {
    it("is being read for the first time: the skeleton", () => {
      expect(reduce({ status: "loading" }, { kind: "read" })).toEqual({ status: "loading" });
    });

    it("starts over after a failure: the skeleton, and not the message", () => {
      expect(reduce({ status: "error" }, { kind: "read" })).toEqual({ status: "loading" });
    });

    it("keeps the rows it has while it is read again, and says it is busy", () => {
      const rows = [item("a"), item("b", true)];

      expect(reduce(ready(rows), { kind: "read" })).toEqual(ready(rows, true));
    });
  });

  describe("when the answer comes", () => {
    it("shows the rows, and is no longer busy", () => {
      const rows = [item("a")];

      expect(reduce({ status: "loading" }, { kind: "listed", items: rows })).toEqual(ready(rows));
      expect(reduce(ready([item("old")], true), { kind: "listed", items: rows })).toEqual(ready(rows));
    });

    it("shows an empty list as a list, not as a failure", () => {
      expect(reduce({ status: "loading" }, { kind: "listed", items: [] })).toEqual(ready([]));
    });
  });

  describe("when the list cannot be read", () => {
    it("says so when there were no rows to show", () => {
      expect(reduce({ status: "loading" }, { kind: "unreadable" })).toEqual({ status: "error" });
      expect(reduce({ status: "error" }, { kind: "unreadable" })).toEqual({ status: "error" });
    });

    it("keeps the rows that were already there: a refresh that fails is not worth losing them", () => {
      const rows = [item("a"), item("b", true)];

      expect(reduce(ready(rows, true), { kind: "unreadable" })).toEqual(ready(rows, false));
    });
  });

  describe("when notifications are marked read", () => {
    const rows = [item("a"), item("b"), item("c", true)];

    it("marks the ones that were told, and only those", () => {
      const next = reduce(ready(rows), { kind: "marked", ids: ["b"] });

      expect(next).toEqual(ready([item("a"), item("b", true), item("c", true)]));
    });

    it("marks every row for all", () => {
      expect(reduce(ready(rows), { kind: "marked", ids: "all" })).toEqual(
        ready(rows.map(({ id }) => item(id, true))),
      );
    });

    it("changes nothing for an id the list does not hold", () => {
      expect(reduce(ready(rows), { kind: "marked", ids: ["zzz"] })).toEqual(ready(rows));
    });

    it("keeps the list busy if it was: the answer to come is still to be read", () => {
      expect(reduce(ready(rows, true), { kind: "marked", ids: ["a"] })).toMatchObject({
        status: "ready",
        refreshing: true,
      });
    });

    it("has nothing to mark while there is no list", () => {
      const loading: NotificationListState = { status: "loading" };
      const error: NotificationListState = { status: "error" };

      expect(reduce(loading, { kind: "marked", ids: "all" })).toBe(loading);
      expect(reduce(error, { kind: "marked", ids: ["a"] })).toBe(error);
    });

    it("does not touch the list it was given", () => {
      const before = ready(rows);
      const frozen = JSON.stringify(before);

      reduce(before, { kind: "marked", ids: "all" });

      expect(JSON.stringify(before)).toBe(frozen);
    });
  });

  describe("hasUnreadRows", () => {
    it("is true when a row of the list is not read", () => {
      expect(hasUnreadRows(ready([item("a", true), item("b")]))).toBe(true);
    });

    it("is false when every row is read, when there is none, and while there is no list", () => {
      expect(hasUnreadRows(ready([item("a", true)]))).toBe(false);
      expect(hasUnreadRows(ready([]))).toBe(false);
      expect(hasUnreadRows({ status: "loading" })).toBe(false);
      expect(hasUnreadRows({ status: "error" })).toBe(false);
    });
  });
});
