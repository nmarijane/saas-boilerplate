"use client";

import type { NotificationItem } from "../list-state";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { StatusDot } from "@/shared/components/ui/status-dot";
import { notAfter } from "@/shared/utils/helpers";

// The shape of a notification is the list's (list-state.ts); the settings page
// draws rows of the same shape, and takes the type from here.
export type { NotificationItem };

interface NotificationRowProps {
  notification: NotificationItem;
  /** Called with what is needed to follow the notification: its id (to mark it read) and its link. */
  onOpen: (id: string, link: string | null) => void;
}

// A row of the list: the whole row is the button, 44 px high at least, as wide
// as the list. The pointer tints it as it does a row of a menu (`bg-accent`).
// The focus ring is drawn inside the row, as an outline: the list scrolls, and
// would cut a ring that is drawn around the row, the way the rows of the menus
// do (popover-styles.ts); the system ring that every button has is turned off,
// as it would double it.
const rowStyles = [
  "flex min-h-11 w-full items-start gap-3 rounded-md px-3 py-2.5 text-left",
  "transition-colors duration-150 ease-expo hover:bg-accent active:bg-accent",
  "focus-visible:shadow-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
].join(" ");

// A notification: a dot when it is unread, then its title, the start of its
// body on two lines at most, and how long ago it came. The dot echoes a state
// that is told in words, hidden from the eye and read by assistive technology
// ("Unread"); a row that is read keeps the room of the dot, so that the titles
// of a list line up. A long word is broken where it overflows, as a title or a
// body is not ours to choose. The words of a type that has messages
// (`notifications.events.<type>`) are drawn here, in the reader's language, with
// the values the notification holds; any other type says the words it was
// stored with.
export function NotificationRow({ notification, onOpen }: NotificationRowProps) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const now = useNow();
  const { id, read, link, createdAt } = notification;
  const key = `events.${notification.type}`;
  const values = notification.values ?? {};
  const said = t.has(`${key}.title`);
  const title = said ? t(`${key}.title`, values) : (notification.title ?? "");
  const body = said ? t(`${key}.body`, values) : (notification.body ?? "");

  // The clock of the person can be behind the server's: a notification that
  // came a moment ago must not read "in 2 minutes".
  const sentAt = notAfter(new Date(createdAt), now);

  return (
    <button
      type="button"
      onClick={() => onOpen(id, link)}
      className={rowStyles}
    >
      <span className="flex h-5 w-2 shrink-0 items-center">
        {read ? null : (
          <StatusDot tone="brand" label={t("unread")} hideLabel />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium wrap-break-word text-ink">
          {title}
        </span>
        {/* No `block` here: the clamp sets its own display, and a `block` after it would undo it. */}
        <span className="mt-0.5 line-clamp-2 text-meta wrap-break-word text-ink-muted">
          {body}
        </span>
        {/* The time is told from the clock of the page: the server's, when this row is drawn there, is not the one the person reads it with. */}
        <time
          dateTime={createdAt}
          suppressHydrationWarning
          className="mt-1 block text-caption text-ink-muted"
        >
          {format.relativeTime(sentAt, now)}
        </time>
      </span>
    </button>
  );
}
