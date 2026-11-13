import type {
  NotificationItem,
  NotificationListAction,
  NotificationListState,
} from "@/features/notifications/list-state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createListReader,
  readLatestNotifications,
} from "@/features/notifications/list-reader";
import {
  INITIAL_NOTIFICATION_LIST,
  notificationListReducer,
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

describe("readLatestNotifications", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the API for the latest ten, and hands the signal to the request", async () => {
    const signal = new AbortController().signal;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ notifications: [item("a")] }) });

    expect(await readLatestNotifications(signal)).toEqual([item("a")]);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/notifications?limit=10", { signal });
  });

  it("rejects when the server refuses, saying how", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(readLatestNotifications(new AbortController().signal)).rejects.toThrow("500");
  });

  it("rejects when the answer holds no list", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ notifications: "none" }) });

    await expect(readLatestNotifications(new AbortController().signal)).rejects.toThrow(/list/);
  });

  it("rejects when the network is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readLatestNotifications(new AbortController().signal)).rejects.toThrow("Failed to fetch");
  });
});

/** A read that the test settles when it wants. */
interface PendingRead {
  signal: AbortSignal;
  resolve: (items: NotificationItem[]) => void;
  reject: (error: unknown) => void;
}

/**
 * The reader with a read the test holds. By default a read fails the way
 * `fetch` does when it is aborted; with `ignoreAbort` it goes on and answers
 * all the same, which a reader must not trust to never happen.
 */
function harness({ ignoreAbort = false } = {}) {
  const reads: PendingRead[] = [];
  const actions: NotificationListAction[] = [];
  let list: NotificationListState = INITIAL_NOTIFICATION_LIST;
  const report = vi.fn();

  const reader = createListReader({
    read: (signal) =>
      new Promise<NotificationItem[]>((resolve, reject) => {
        reads.push({ signal, resolve, reject });
        if (!ignoreAbort) {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }
      }),
    dispatch: (action) => {
      actions.push(action);
      list = notificationListReducer(list, action);
    },
    report,
  });

  return {
    reader,
    reads,
    report,
    kinds: () => actions.map(({ kind }) => kind),
    list: () => list,
  };
}

describe("createListReader", () => {
  describe("a read", () => {
    it("starts, then shows what came", async () => {
      const h = harness();

      const done = h.reader.load();
      expect(h.kinds()).toEqual(["read"]);
      expect(h.reader.reading()).toBe(true);

      h.reads[0]?.resolve([item("a")]);
      await done;

      expect(h.kinds()).toEqual(["read", "listed"]);
      expect(h.list()).toEqual({ status: "ready", items: [item("a")], refreshing: false });
      expect(h.reader.reading()).toBe(false);
    });

    it("says so, and tells the reporter, when it fails with nothing to show", async () => {
      const h = harness();
      const failure = new Error("down");

      const done = h.reader.load();
      h.reads[0]?.reject(failure);
      await done;

      expect(h.list()).toEqual({ status: "error" });
      expect(h.report).toHaveBeenCalledExactlyOnceWith(failure);
      expect(h.reader.reading()).toBe(false);
    });

    it("keeps the rows it showed when a read that refreshes them fails", async () => {
      const h = harness();
      const first = h.reader.load();
      h.reads[0]?.resolve([item("a"), item("b", true)]);
      await first;

      const second = h.reader.load();
      expect(h.list()).toMatchObject({ status: "ready", refreshing: true });
      h.reads[1]?.reject(new Error("down"));
      await second;

      expect(h.list()).toEqual({
        status: "ready",
        items: [item("a"), item("b", true)],
        refreshing: false,
      });
      expect(h.report).toHaveBeenCalledOnce();
    });
  });

  describe("a read asked while one runs", () => {
    it("replaces it: the first is aborted and its answer never shows", async () => {
      const h = harness({ ignoreAbort: true });

      const first = h.reader.load();
      const second = h.reader.load();
      expect(h.reads[0]?.signal.aborted).toBe(true);
      expect(h.reads[1]?.signal.aborted).toBe(false);

      h.reads[1]?.resolve([item("fresh")]);
      await second;
      // An answer that comes late from the first, which did not stop when it was told to.
      h.reads[0]?.resolve([item("stale")]);
      await first;

      expect(h.list()).toEqual({ status: "ready", items: [item("fresh")], refreshing: false });
      expect(h.report).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("drops the answer of the read that runs, and the abort is not a failure", async () => {
      for (const ignoreAbort of [false, true]) {
        const h = harness({ ignoreAbort });

        const done = h.reader.load();
        h.reader.cancel();
        expect(h.reader.reading()).toBe(false);
        h.reads[0]?.resolve([item("a")]);
        await done;

        expect(h.kinds(), `ignoreAbort ${ignoreAbort}`).toEqual(["read"]);
        expect(h.report).not.toHaveBeenCalled();
      }
    });

    it("does nothing when nothing runs", () => {
      const h = harness();

      expect(() => h.reader.cancel()).not.toThrow();
      expect(h.kinds()).toEqual([]);
    });
  });

  describe("settled, when notifications were marked read on the server", () => {
    it("marks the rows it shows, and asks for nothing when no read is running", async () => {
      const h = harness();
      const done = h.reader.load();
      h.reads[0]?.resolve([item("a"), item("b")]);
      await done;

      h.reader.settled(["a"]);

      expect(h.list()).toEqual({
        status: "ready",
        items: [item("a", true), item("b")],
        refreshing: false,
      });
      expect(h.reads).toHaveLength(1);
    });

    it("reads again when a read was running: its answer was asked before the server was told", async () => {
      const h = harness({ ignoreAbort: true });
      const first = h.reader.load();

      h.reader.settled("all");
      expect(h.reads).toHaveLength(2);
      expect(h.reads[0]?.signal.aborted).toBe(true);

      // The answer asked before the mutation arrives, with the old state: it is not shown.
      h.reads[0]?.resolve([item("a"), item("b")]);
      await first;
      expect(h.list()).toEqual({ status: "loading" });

      // The one asked after it shows the new state.
      h.reads[1]?.resolve([item("a", true), item("b", true)]);
      await vi.waitFor(() =>
        expect(h.list()).toEqual({
          status: "ready",
          items: [item("a", true), item("b", true)],
          refreshing: false,
        }),
      );
    });

    it("reads again too for a list that is being refreshed, whose rows are about to be replaced", async () => {
      const h = harness({ ignoreAbort: true });
      const first = h.reader.load();
      h.reads[0]?.resolve([item("a")]);
      await first;
      const refresh = h.reader.load();

      h.reader.settled(["a"]);

      expect(h.reads).toHaveLength(3);
      expect(h.list()).toMatchObject({ status: "ready", refreshing: true });
      h.reads[2]?.resolve([item("a", true)]);
      await vi.waitFor(() => expect(h.list()).toMatchObject({ refreshing: false }));
      h.reads[1]?.resolve([item("a")]);
      await refresh;
      expect(h.list()).toEqual({ status: "ready", items: [item("a", true)], refreshing: false });
    });
  });
});
