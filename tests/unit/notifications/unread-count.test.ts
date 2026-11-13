import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pollWhileVisible,
  readUnreadCount,
  unreadReducer,
} from "@/features/notifications/unread-count";

/** A page whose tab is in sight or not, and that says so when it changes, as `document` does. */
class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }

  /** How many listeners are on the page: what is left behind when polling stops. */
  listeners = 0;

  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    this.listeners += 1;
    super.addEventListener(...args);
  }

  override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) {
    this.listeners -= 1;
    super.removeEventListener(...args);
  }
}

describe("pollWhileVisible", () => {
  let page: FakePage;
  const read = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    read.mockClear();
    page = new FakePage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads at once, then at every interval", () => {
    const stop = pollWhileVisible(read, 30_000, page);

    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(29_999);
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(read).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60_000);
    expect(read).toHaveBeenCalledTimes(4);

    stop();
  });

  it("asks nothing of the server while the tab is hidden", () => {
    page.visibilityState = "hidden";
    const stop = pollWhileVisible(read, 30_000, page);

    expect(read).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120_000);
    expect(read).not.toHaveBeenCalled();

    stop();
  });

  it("skips the intervals that fall while the tab is hidden, and goes on once it is back", () => {
    const stop = pollWhileVisible(read, 30_000, page);
    read.mockClear();

    page.visibilityState = "hidden";
    vi.advanceTimersByTime(90_000);
    expect(read).not.toHaveBeenCalled();

    page.visibilityState = "visible";
    vi.advanceTimersByTime(30_000);
    expect(read).toHaveBeenCalledTimes(1);

    stop();
  });

  it("reads at once when the tab comes back into sight, instead of waiting for the next interval", () => {
    const stop = pollWhileVisible(read, 30_000, page);
    page.setVisibility("hidden");
    read.mockClear();

    vi.advanceTimersByTime(10_000);
    page.setVisibility("visible");

    expect(read).toHaveBeenCalledTimes(1);

    stop();
  });

  it("does not read when the tab goes out of sight", () => {
    const stop = pollWhileVisible(read, 30_000, page);
    read.mockClear();

    page.setVisibility("hidden");

    expect(read).not.toHaveBeenCalled();

    stop();
  });

  it("stops: no timer left, and no listener left on the page", () => {
    const stop = pollWhileVisible(read, 30_000, page);
    expect(page.listeners).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    stop();
    read.mockClear();

    expect(page.listeners).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(120_000);
    page.setVisibility("visible");
    expect(read).not.toHaveBeenCalled();
  });
});

describe("readUnreadCount", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function answer(body: unknown, init: { ok?: boolean } = {}) {
    fetchMock.mockResolvedValue({
      ok: init.ok ?? true,
      json: async () => body,
    });
  }

  it("asks the API for the count only", async () => {
    answer({ count: 3 });

    expect(await readUnreadCount()).toBe(3);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/notifications?countOnly=true");
  });

  it("reads zero as a count, not as a failure", async () => {
    answer({ count: 0 });

    expect(await readUnreadCount()).toBe(0);
  });

  it("says nothing when the server refuses, whatever its body holds: the caller keeps the count it had", async () => {
    answer({ error: "Unauthorized" }, { ok: false });
    expect(await readUnreadCount()).toBeNull();

    // A gateway page can carry anything: only an answer that is ok is a count.
    answer({ count: 7 }, { ok: false });
    expect(await readUnreadCount()).toBeNull();
  });

  it("says nothing when the network is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await readUnreadCount()).toBeNull();
  });

  it("says nothing when the answer is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });

    expect(await readUnreadCount()).toBeNull();
  });

  it.each([
    ["no count", {}],
    ["a count that is a string", { count: "3" }],
    ["a negative count", { count: -1 }],
    ["a fractional count", { count: 1.5 }],
    ["a count that is not a number", { count: Number.NaN }],
    ["null", null],
  ])("says nothing when the answer holds %s", async (_name, body) => {
    answer(body);

    expect(await readUnreadCount()).toBeNull();
  });
});

describe("unreadReducer", () => {
  it("takes the count the server gave", () => {
    expect(unreadReducer(0, { kind: "counted", count: 5 })).toBe(5);
    expect(unreadReducer(5, { kind: "counted", count: 0 })).toBe(0);
  });

  it("takes one off when a notification is read, at once and without asking", () => {
    expect(unreadReducer(3, { kind: "read" })).toBe(2);
    expect(unreadReducer(1, { kind: "read" })).toBe(0);
  });

  it("never goes below zero: the count can be a poll behind the list", () => {
    expect(unreadReducer(0, { kind: "read" })).toBe(0);
  });

  it("is zero once everything is read", () => {
    expect(unreadReducer(7, { kind: "allRead" })).toBe(0);
    expect(unreadReducer(0, { kind: "allRead" })).toBe(0);
  });
});
