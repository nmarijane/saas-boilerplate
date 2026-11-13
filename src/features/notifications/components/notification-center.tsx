"use client";

import type {
  NotificationItem,
  NotificationListState,
} from "../list-state";
import { BellIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { useSwitchWorkspace } from "@/features/auth/organization/hooks/use-switch-workspace";
import { useShell } from "@/shared/components/shell/shell-context";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { toast } from "@/shared/components/ui/sonner";
import { Link, useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { followNotification } from "../follow-link";
import { createListReader, readLatestNotifications } from "../list-reader";
import {
  hasUnreadRows,
  INITIAL_NOTIFICATION_LIST,
  notificationListReducer,
} from "../list-state";
import { focusPanel, openNotification } from "../panel";
import { NotificationBell } from "./notification-bell";
import { NotificationRow } from "./notification-row";
import { useNotificationCenter } from "./notifications-provider";

// Three rows where the notifications will be, as tall as they are: the panel
// does not jump when the list comes. The eye gets the shapes, and assistive
// technology gets the words (the `status` that holds them).
function SkeletonRow() {
  return (
    <div
      data-slot="notification-skeleton"
      aria-hidden="true"
      className="flex items-start gap-3 px-3 py-2.5"
    >
      <span className="w-2 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

interface PanelBodyProps {
  list: NotificationListState;
  onRetry: () => void;
  onOpen: (item: NotificationItem) => void;
}

function PanelBody({ list, onRetry, onOpen }: PanelBodyProps) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");

  if (list.status === "loading") {
    return (
      <div role="status" className="p-1">
        <span className="sr-only">{tCommon("loading")}</span>
        {[0, 1, 2].map((row) => (
          <SkeletonRow key={row} />
        ))}
      </div>
    );
  }

  if (list.status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 px-6 py-8 text-center"
      >
        <p className="text-body text-ink">{t("loadError")}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (list.items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-8 text-center">
        <IconTile icon={BellIcon} />
        <p className="mt-3 text-body font-medium text-ink">
          {t("noNotifications")}
        </p>
        <p className="mt-1 text-meta text-ink-muted">
          {t("emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <ul
      role="list"
      aria-busy={list.refreshing || undefined}
      className="flex flex-col gap-0.5 p-1"
    >
      {list.items.map((item) => (
        <li key={item.id}>
          <NotificationRow
            notification={item}
            onOpen={() => onOpen(item)}
          />
        </li>
      ))}
    </ul>
  );
}

interface NotificationPanelProps {
  /** The id of the heading, which names the dialog the panel is in. */
  titleId: string;
  list: NotificationListState;
  /** Whether anything is left to read: when not, "Mark all as read" is not drawn. */
  hasUnread: boolean;
  onMarkAllRead: () => void;
  onRetry: () => void;
  onOpen: (item: NotificationItem) => void;
  /** Called when the link to every notification is followed: the panel closes. */
  onNavigate: () => void;
}

// What is inside the popover, from the top: the title with "Mark all as read"
// (a ghost button, and only when something waits), the list in one of its
// three states, and the link to every notification. The list scrolls on its own,
// up to 448 px; the title and the link stay in sight. It is a function of what
// it is given, and holds no state, so that it can be drawn in each of its
// states.
export function NotificationPanel({
  titleId,
  list,
  hasUnread,
  onMarkAllRead,
  onRetry,
  onOpen,
  onNavigate,
}: NotificationPanelProps) {
  const t = useTranslations("notifications");

  return (
    <>
      {/* As tall with the button as without it: the title does not jump when the last unread notification is read. */}
      <div className="flex min-h-13 items-center justify-between gap-2 border-b px-4 py-2">
        <h2 id={titleId} className="text-section text-ink">
          {t("title")}
        </h2>
        {hasUnread ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
          >
            {t("markAllRead")}
          </Button>
        ) : null}
      </div>
      <div className="max-h-112 min-h-0 flex-1 overflow-y-auto">
        <PanelBody list={list} onRetry={onRetry} onOpen={onOpen} />
      </div>
      <div className="border-t p-1">
        <Button asChild variant="ghost" className="min-h-11 w-full">
          <Link href="/settings/notifications" onClick={onNavigate}>
            {t("viewAll")}
          </Link>
        </Button>
      </div>
    </>
  );
}

// The bell of the shell and the panel it opens: the latest notifications, read
// from the API each time the panel opens, and nothing before. The count on the
// bell is the provider's (one timer for the app: the shell draws this twice, in
// the sidebar and in the header, and only one of them is on screen).
//
// Opening a notification marks it read, then goes where it points: a page of
// the app through the router, a web address by leaving the app. A notification
// with no link is only marked, and the panel stays open for the next one. What
// the list does (one read at a time, the rows kept when a refresh fails, a read
// that began before a notification was marked read replaced by a new one) is
// `createListReader`'s, and what opening does is `openNotification`'s: both are
// plain functions, tested without a page.
export function NotificationCenter() {
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { unreadCount, markRead, markAllRead } = useNotificationCenter();
  // A notification of another workspace opens in its workspace (followNotification)
  const activeWorkspaceId = useShell().workspace?.id ?? null;
  const { switchTo } = useSwitchWorkspace();
  const titleId = useId();
  const content = useRef<HTMLDivElement>(null);
  // The notifications being opened: a second press on a row waits for the first, so that one takes one off the count
  const opening = useRef(new Set<string>());
  const [open, setOpen] = useState(false);
  const [list, dispatch] = useReducer(
    notificationListReducer,
    INITIAL_NOTIFICATION_LIST,
  );
  // The error of a read that failed is handled with the message of the panel
  // (or with the rows it kept), not hidden: the error reporter of the app still
  // hears it.
  const [reader] = useState(() =>
    createListReader({
      read: readLatestNotifications,
      dispatch,
      report: reportHandledError,
    }),
  );

  useEffect(() => reader.cancel, [reader]);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      void reader.load();
    } else {
      reader.cancel();
    }
  };

  // The button that was pressed is replaced by what it asked for (the list, the
  // message): the focus stays in the panel, and does not fall on the page.
  const retry = () => {
    content.current?.focus();
    void reader.load();
  };

  const markAll = async () => {
    try {
      await markAllRead();
    } catch (error) {
      unstable_rethrow(error);
      toast.error(tCommon("error"));
      reportHandledError(error);
      return;
    }

    reader.settled("all");
    content.current?.focus();
  };

  const openRow = async (item: NotificationItem) => {
    const { followed } = await openNotification(item, {
      opening: opening.current,
      markRead,
      follow: (notification) =>
        followNotification(notification, activeWorkspaceId, {
          push: (href) => router.push(href),
          assign: (href) => window.location.assign(href),
          switchTo,
        }),
      onMarked: (id) => reader.settled([id]),
      report: reportHandledError,
      warn: () => toast.error(tCommon("error")),
    });

    if (followed) {
      setOpen(false);
    }
  };

  // Something waits when the count says so, or when the list just read shows an
  // unread row: the count is read every half minute, and a notification that
  // came since is in the list before it is in the count.
  const hasUnread = unreadCount > 0 || hasUnreadRows(list);

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <NotificationBell count={unreadCount} />
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        align="start"
        collisionPadding={16}
        aria-labelledby={titleId}
        onOpenAutoFocus={(event) => focusPanel(event, content.current)}
        className="flex max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-2rem)] flex-col p-0"
      >
        <NotificationPanel
          titleId={titleId}
          list={list}
          hasUnread={hasUnread}
          onMarkAllRead={() => void markAll()}
          onRetry={retry}
          onOpen={(item) => void openRow(item)}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
