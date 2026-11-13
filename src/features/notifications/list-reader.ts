import type { NotificationItem, NotificationListAction } from "./list-state";

// How the panel reads its list: one request to the API, and the order in which
// the answers of several requests are taken. Plain functions, with no React in
// them, so that the order is tested with reads that the test settles itself.

/** The latest ten: the panel lists them, and links to the rest. */
const LATEST_URL = "/api/notifications?limit=10";

/**
 * Reads the latest notifications. It rejects when the network fails, when the
 * server refuses and when the answer holds no list; a request that was aborted
 * rejects too, which is how `fetch` stops.
 */
export async function readLatestNotifications(
  signal: AbortSignal,
): Promise<NotificationItem[]> {
  const answer = await fetch(LATEST_URL, { signal });
  if (!answer.ok) {
    throw new Error(`The notifications could not be read (${answer.status})`);
  }

  const { notifications } = (await answer.json()) as { notifications?: unknown };
  if (!Array.isArray(notifications)) {
    throw new TypeError("The answer holds no list of notifications");
  }

  return notifications as NotificationItem[];
}

interface ListReaderDeps {
  read: (signal: AbortSignal) => Promise<NotificationItem[]>;
  dispatch: (action: NotificationListAction) => void;
  /** Hears the error of a read that failed: handled with the message of the panel, not hidden. */
  report: (error: unknown) => void;
}

/**
 * Reads the list for the panel, one read at a time: the one that is asked last
 * is the one that shows. A read that is replaced, or cancelled, is aborted and
 * its answer is dropped, whenever it comes and even if the request goes on.
 *
 * `settled` is for the moment the server has been told that notifications are
 * read. The rows are marked, and a read that is still running was asked before
 * that: it would bring back the dots that were just taken away, so it is
 * replaced by a read that is asked now.
 */
export function createListReader({ read, dispatch, report }: ListReaderDeps) {
  let current: AbortController | null = null;

  async function load(): Promise<void> {
    current?.abort();
    const own = new AbortController();
    current = own;
    dispatch({ kind: "read" });

    try {
      const items = await read(own.signal);
      if (!own.signal.aborted) {
        dispatch({ kind: "listed", items });
      }
    } catch (error) {
      if (!own.signal.aborted) {
        dispatch({ kind: "unreadable" });
        report(error);
      }
    } finally {
      if (current === own) {
        current = null;
      }
    }
  }

  return {
    load,
    cancel() {
      current?.abort();
      current = null;
    },
    /** Whether a read is running. */
    reading: () => current !== null,
    settled(ids: readonly string[] | "all") {
      dispatch({ kind: "marked", ids });
      if (current !== null) {
        void load();
      }
    },
  };
}
