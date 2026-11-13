import type { Metadata } from "next";
import { BellIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { MarkAllReadButton } from "@/features/notifications/components/mark-all-read-button";
import { NotificationList } from "@/features/notifications/components/notification-list";
import {
  getNotifications,
  getUnreadCount,
} from "@/features/notifications/queries";
import { EmptyState } from "@/shared/components/data/empty-state";
import { PageHeader } from "@/shared/components/data/page-header";
import { SettingsNav } from "@/shared/components/shell/settings-nav";

interface Props {
  params: Promise<{ locale: string }>;
}

/** How many notifications the page lists: the latest ones, which is what a person comes here to read. */
const LIST_LIMIT = 50;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notifications" });

  return appPageMetadata(t("title"));
}

// The notifications of the person, not of the workspace: they are read for the
// user of the session. The header says how many are unread, and the bell, which
// shows a dot and never a number, does not say it twice. Its one main action
// marks everything read, and is there only while something is. The list holds the
// latest fifty, with their dates as ISO strings and nothing else of the row
// (the id of the person stays on the server): the workspace of each, which a
// notification of another workspace is opened in, and the values its words name;
// with none, an empty state says so.
export default async function NotificationsSettingsPage({ params }: Props) {
  const { locale } = await params;
  const { user } = await requireWorkspace();
  const [t, rows, unread] = await Promise.all([
    getTranslations({ locale, namespace: "notifications" }),
    getNotifications(user.id, { limit: LIST_LIMIT }),
    getUnreadCount(user.id),
  ]);
  const notifications = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    read: row.read,
    type: row.type,
    values: row.values,
    link: row.link,
    organizationId: row.organizationId,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BellIcon}
        title={t("title")}
        context={t("unreadCount", { count: unread })}
        primaryAction={unread > 0 ? <MarkAllReadButton /> : undefined}
        tabs={<SettingsNav />}
      />
      {notifications.length > 0 ? (
        <NotificationList notifications={notifications} />
      ) : (
        <EmptyState
          icon={BellIcon}
          headingLevel={2}
          title={t("noNotifications")}
          description={t("emptyDescription")}
        />
      )}
    </div>
  );
}
