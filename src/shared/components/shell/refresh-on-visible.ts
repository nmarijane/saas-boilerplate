/** The part of the page that the shell reads: whether the tab is in sight, and when that changes. */
interface VisibilityPage {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
}

/** The shortest time between two reads of the app: a person who goes back and forth between tabs does not read it every time. */
const MIN_INTERVAL_MS = 30_000;

/**
 * Calls `refresh` each time the tab comes back into sight. The shell is drawn on
 * the server with its layout, and a navigation inside the app does not draw it
 * again: a workspace switched in another tab, a role changed or a removal made
 * by someone else would not show until the next full load, and the sidebar would
 * name a workspace the pages no longer read. Reading the app again when the
 * person comes back to it shows what the session holds, as the bell reads its
 * count.
 *
 * It reads at most once in 30 seconds: each read draws the layout again on the
 * server, and a person who goes back and forth between tabs ten times a minute
 * needs it once. The window starts when the shell is drawn, whose layout was just
 * read, and at each read. A return inside it reads nothing and does not move it,
 * so the first return after it reads. The clock is the wall clock, which counts
 * the time a laptop sleeps, and a clock that was put back reads, rather than
 * holding the shell back for ever. Returns the function that stops it.
 */
export function refreshWhenVisible(
  refresh: () => void,
  page: VisibilityPage = document,
): () => void {
  let lastRead = Date.now();
  const refreshIfVisible = () => {
    if (page.visibilityState !== "visible") {
      return;
    }

    const elapsed = Date.now() - lastRead;
    // A negative time is a clock that was put back: nothing says how long it has been
    if (elapsed >= 0 && elapsed < MIN_INTERVAL_MS) {
      return;
    }

    lastRead = Date.now();
    refresh();
  };

  page.addEventListener("visibilitychange", refreshIfVisible);
  return () => {
    page.removeEventListener("visibilitychange", refreshIfVisible);
  };
}
