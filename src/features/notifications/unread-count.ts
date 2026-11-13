// What the bell needs to know how many notifications wait: one question to the
// API, and the rhythm at which it is asked. Plain functions, with no React in
// them, so that the rhythm can be tested with a clock and a page of our own.

const COUNT_URL = "/api/notifications?countOnly=true";

/**
 * How many notifications are unread, or null when the server cannot say: the
 * network is down, the session is gone, the answer is no count. The caller
 * keeps the count it had and asks again at the next interval, so that a failure
 * is not reported every 30 seconds for as long as the person is offline.
 */
export async function readUnreadCount(): Promise<number | null> {
  try {
    const answer = await fetch(COUNT_URL);
    if (!answer.ok) {
      return null;
    }

    const { count } = (await answer.json()) as { count?: unknown };
    return typeof count === "number" && Number.isInteger(count) && count >= 0
      ? count
      : null;
  } catch {
    return null;
  }
}

/** The part of the page that polling reads: whether the tab is in sight, and when that changes. */
interface PollPage {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
}

/**
 * Calls `read` now and then every `intervalMs`, but only while the tab is in
 * sight: a tab nobody looks at asks nothing of the server. When the tab comes
 * back into sight it reads at once, instead of showing a count that is a whole
 * interval old. Returns the function that stops it.
 */
export function pollWhileVisible(
  read: () => void,
  intervalMs: number,
  page: PollPage = document,
): () => void {
  const readIfVisible = () => {
    if (page.visibilityState === "visible") {
      read();
    }
  };

  readIfVisible();
  const timer = setInterval(readIfVisible, intervalMs);
  page.addEventListener("visibilitychange", readIfVisible);

  return () => {
    clearInterval(timer);
    page.removeEventListener("visibilitychange", readIfVisible);
  };
}

type UnreadAction =
  /** The server gave the count. */
  | { kind: "counted"; count: number }
  /** A notification was read, and the server was told. */
  | { kind: "read" }
  /** Every notification was read, and the server was told. */
  | { kind: "allRead" };

/**
 * The count the bell shows. A notification that was read takes one off at once,
 * and "mark all as read" takes everything off, without waiting for the count to
 * be read again: that read comes behind, and says what the server holds. The
 * count never goes below zero: it can be a poll behind the list.
 */
export function unreadReducer(count: number, action: UnreadAction): number {
  switch (action.kind) {
    case "counted":
      return action.count;
    case "read":
      return Math.max(0, count - 1);
    case "allRead":
      return 0;
  }
}
