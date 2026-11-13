// The list of the panel as plain data and one function, with no React in it,
// so that what happens to it (a read, an answer, a failure, a notification
// marked read) is tested with nothing but values.

/** A notification as the API hands it over: its date is the ISO string of the JSON. */
export interface NotificationItem {
  id: string;
  /** The words stored with it, for a type that has no message; null when its type says it (`values`). */
  title: string | null;
  body: string | null;
  read: boolean;
  /** An event (`payment.failed`), whose messages say it in the reader's language, or a word of its own. */
  type: string;
  /** What the messages of its type name (`{workspace}`, `{name}`). */
  values?: Record<string, string> | null;
  link: string | null;
  /** The workspace whose pages its link opens; null for one that is the account's. */
  organizationId?: string | null;
  createdAt: string;
}

/**
 * Where the list is: being read for the first time (`loading`), not readable
 * (`error`), or read. A list that is read has rows, and is `refreshing` while
 * it is read again: the rows stay in sight till the new ones come.
 */
export type NotificationListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: NotificationItem[]; refreshing: boolean };

export type NotificationListAction =
  /** A read of the list starts. */
  | { kind: "read" }
  /** A read of the list answered. */
  | { kind: "listed"; items: NotificationItem[] }
  /** A read of the list failed. */
  | { kind: "unreadable" }
  /** The server was told that these notifications, or all of them, are read. */
  | { kind: "marked"; ids: readonly string[] | "all" };

export const INITIAL_NOTIFICATION_LIST: NotificationListState = {
  status: "loading",
};

export function notificationListReducer(
  state: NotificationListState,
  action: NotificationListAction,
): NotificationListState {
  switch (action.kind) {
    case "read":
      return state.status === "ready"
        ? { ...state, refreshing: true }
        : { status: "loading" };
    case "listed":
      return { status: "ready", items: action.items, refreshing: false };
    // A list that failed to refresh keeps its rows: they are old, not wrong,
    // and a message in their place would take away what the person could read.
    case "unreadable":
      return state.status === "ready"
        ? { ...state, refreshing: false }
        : { status: "error" };
    case "marked":
      if (state.status !== "ready") {
        return state;
      }

      return {
        ...state,
        items: state.items.map((item) =>
          action.ids === "all" || action.ids.includes(item.id)
            ? { ...item, read: true }
            : item,
        ),
      };
  }
}

/** Whether the list shows a notification that is not read. */
export function hasUnreadRows(list: NotificationListState): boolean {
  return list.status === "ready" && list.items.some(({ read }) => !read);
}
