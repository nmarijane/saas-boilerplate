"use client";

import type { ReactNode } from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  markAllRead as markAllReadOnServer,
  markAsRead,
} from "../actions";
import {
  pollWhileVisible,
  readUnreadCount,
  unreadReducer,
} from "../unread-count";

/** Half a minute between two reads of the count: a bell that is a little late costs less than a request a second. */
const DEFAULT_POLL_MS = 30_000;

interface NotificationCenterValue {
  /** How many notifications are unread as of the last read, which is 0 until the first one has come. */
  unreadCount: number;
  /** Reads the count again. It never rejects: when the server cannot say, the count stays what it was. */
  refresh: () => Promise<void>;
  /**
   * Marks one notification read on the server. It settles as soon as the server
   * has been told: the count has gone down by one by then, and is read again
   * behind, to say what the server holds. It rejects when the server refuses.
   */
  markRead: (id: string) => Promise<void>;
  /** Marks every notification read on the server: the count is zero by the time it settles, and is read again behind. It rejects when the server refuses. */
  markAllRead: () => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterValue | null>(
  null,
);

interface NotificationsProviderProps {
  children: ReactNode;
  /** Milliseconds between two reads of the count, while the tab is in sight. */
  pollMs?: number;
}

// The one place that asks the server how many notifications are unread: a
// single timer for the whole app, however many bells the shell draws (the
// sidebar and the header each draw one), and each bell reads the count from
// here. It mounts above the shell, and renders no element of its own.
export function NotificationsProvider({
  children,
  pollMs = DEFAULT_POLL_MS,
}: NotificationsProviderProps) {
  const [unreadCount, dispatch] = useReducer(unreadReducer, 0);
  // The answers of two reads can come back out of order (a slow one, then a fast
  // one asked after "mark all as read"): only the read asked last is kept.
  const lastRead = useRef(0);

  const refresh = useCallback(async () => {
    lastRead.current += 1;
    const thisRead = lastRead.current;

    const count = await readUnreadCount();
    if (count !== null && thisRead === lastRead.current) {
      dispatch({ kind: "counted", count });
    }
  }, []);

  useEffect(
    () => pollWhileVisible(() => void refresh(), pollMs),
    [pollMs, refresh],
  );

  const value = useMemo<NotificationCenterValue>(
    () => ({
      unreadCount,
      refresh,
      // The count is told at once, from what the server was just told, and
      // read again behind: a read that fails leaves the count where it was put,
      // and a read that comes back says what the server holds. Asking for it
      // takes the answer of any read that was asked before out of the way.
      markRead: async (id) => {
        await markAsRead(id);
        dispatch({ kind: "read" });
        void refresh();
      },
      markAllRead: async () => {
        await markAllReadOnServer();
        dispatch({ kind: "allRead" });
        void refresh();
      },
    }),
    [unreadCount, refresh],
  );

  return (
    <NotificationCenterContext value={value}>
      {children}
    </NotificationCenterContext>
  );
}

/** The count of unread notifications and what changes it. It throws outside the provider: there is nothing to read there. */
export function useNotificationCenter(): NotificationCenterValue {
  const value = use(NotificationCenterContext);
  if (value === null) {
    throw new Error(
      "useNotificationCenter must be used inside <NotificationsProvider>: the shell mounts it from the registry.",
    );
  }

  return value;
}
