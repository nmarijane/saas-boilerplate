"use client";

import type { NotificationItem } from "../list-state";
import { useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { useSwitchWorkspace } from "@/features/auth/organization/hooks/use-switch-workspace";
import { useShell } from "@/shared/components/shell/shell-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { followNotification } from "../follow-link";
import { openNotification } from "../panel";
import { NotificationRow } from "./notification-row";
import { useNotificationCenter } from "./notifications-provider";

interface NotificationListProps {
  /** The latest notifications of the person, newest first, as the page read them: dates are ISO strings. */
  notifications: NotificationItem[];
}

// The latest notifications as a card, each one a row (NotificationRow) that
// does what the same row of the bell's panel does: it marks the notification
// read through the center (the bell follows at once), then goes where it points.
// A notification with no link, or one that is not followed, only gets marked,
// and the page is read again so that its row and the header's count tell it. The
// rows come from the server and are not kept here: the page that reads them
// again is what shows them marked.
//
// A row that is being opened ignores a second press (`openNotification` keeps the
// notifications being opened, which this list holds), so that one notification
// takes one off the count, not two. The sections of the settings are cards with a
// level-two title, and the list is named by it.
export function NotificationList({ notifications }: NotificationListProps) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { markRead } = useNotificationCenter();
  // A notification of another workspace opens in its workspace (followNotification)
  const activeWorkspaceId = useShell().workspace?.id ?? null;
  const { switchTo } = useSwitchWorkspace();
  const titleId = useId();
  const opening = useRef(new Set<string>());

  const open = async (item: NotificationItem) => {
    await openNotification(item, {
      markRead,
      follow: (notification) =>
        followNotification(notification, activeWorkspaceId, {
          push: (href) => router.push(href),
          assign: (href) => window.location.assign(href),
          switchTo,
        }),
      onMarked: () => router.refresh(),
      report: reportHandledError,
      warn: () => toast.error(tCommon("error")),
      opening: opening.current,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" id={titleId}>
          {t("latest")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* The rows reach 12 px past the list on each side, for the tint of the pointer, inside the padding of the card. */}
        <ul
          role="list"
          aria-labelledby={titleId}
          className="-mx-3 flex flex-col gap-0.5"
        >
          {notifications.map((item) => (
            <li key={item.id}>
              <NotificationRow
                notification={item}
                onOpen={() => void open(item)}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
