import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshWhenVisible } from "@/shared/components/shell/refresh-on-visible";
import { sourceOf } from "../../helpers/source";

/** A page whose visibility the test sets, as the browser would. */
class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  /** How many listeners are on the page: what is left behind when it stops. */
  listeners = 0;

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }

  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    this.listeners += 1;
    super.addEventListener(...args);
  }

  override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) {
    this.listeners -= 1;
    super.removeEventListener(...args);
  }
}

// The shell is drawn on the server when its layout is, and a navigation inside the
// app does not draw it again: a workspace switched in another tab, or a role
// changed or a removal made by someone else, would not show until the next full
// load. The shell reads itself again when the person comes back to the tab, as the
// bell reads its count.
describe("the shell catching up with the session", () => {
  const SECOND = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The tab goes out of sight and comes back. */
  function comeBack(page: FakePage) {
    page.setVisibility("hidden");
    page.setVisibility("visible");
  }

  it("reads the app again when the tab comes back into sight after a while, and not before", () => {
    const page = new FakePage();
    const refresh = vi.fn();
    const stop = refreshWhenVisible(refresh, page);

    // Nothing at the start: the layout was just drawn
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(40 * SECOND);
    page.setVisibility("hidden");
    expect(refresh).not.toHaveBeenCalled();

    page.setVisibility("visible");
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(40 * SECOND);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("reads once in 30 seconds however often the tab comes and goes", () => {
    const page = new FakePage();
    const refresh = vi.fn();
    const stop = refreshWhenVisible(refresh, page);
    vi.advanceTimersByTime(31 * SECOND);

    for (let returns = 0; returns < 10; returns += 1) {
      comeBack(page);
      vi.advanceTimersByTime(SECOND);
    }
    expect(refresh).toHaveBeenCalledTimes(1);

    // The read was 10 seconds ago, then 29.9 seconds after it is still the window, and 30 seconds is out of it
    vi.advanceTimersByTime(19_900);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("counts the 30 seconds from the moment the shell is drawn: its layout was just read", () => {
    const page = new FakePage();
    const refresh = vi.fn();
    const stop = refreshWhenVisible(refresh, page);

    vi.advanceTimersByTime(29 * SECOND);
    comeBack(page);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SECOND);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(1);

    stop();
  });

  it("counts the 30 seconds from the last read, and a return that read nothing does not move them", () => {
    const page = new FakePage();
    const refresh = vi.fn();
    const stop = refreshWhenVisible(refresh, page);
    vi.advanceTimersByTime(30 * SECOND);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(1);

    // Returns inside the window read nothing, and do not start a window of their own
    vi.advanceTimersByTime(20 * SECOND);
    comeBack(page);
    vi.advanceTimersByTime(9 * SECOND);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(1);

    // 30 seconds after the read, not after the last return
    vi.advanceTimersByTime(SECOND);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("reads when the clock was put back, rather than holding the shell back for ever", () => {
    const page = new FakePage();
    const refresh = vi.fn();
    const stop = refreshWhenVisible(refresh, page);
    vi.advanceTimersByTime(30 * SECOND);
    comeBack(page);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-11-18T09:00:00Z"));
    comeBack(page);

    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });

  it("leaves nothing behind once it stops", () => {
    const page = new FakePage();
    const refresh = vi.fn();
    const stop = refreshWhenVisible(refresh, page);

    stop();
    page.setVisibility("hidden");
    page.setVisibility("visible");

    expect(refresh).not.toHaveBeenCalled();
    expect(page.listeners).toBe(0);
  });

  it("is what the shell does with its router, from the moment it is drawn", () => {
    // An effect does not run in static markup: the call is read where it is written
    const shell = sourceOf(join(__dirname, "../../../src/shared/components/shell/app-shell.tsx"));

    expect(shell).toMatch(/useEffect\(\s*\(\) => refreshWhenVisible\(\(\) => router\.refresh\(\)\),\s*\[router\],?\s*\)/);
  });
});
