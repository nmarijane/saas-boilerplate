import type { FeatureShell } from "@/shared/shell/contract";
import { BellIcon } from "lucide-react";
import { NotificationCenter } from "./components/notification-center";
import { NotificationsProvider } from "./components/notifications-provider";

// What notifications give the shell: the provider that reads the unread count
// (one timer for the app), the bell that shows it, and a tab of the settings.
export const notificationsShell: FeatureShell = {
  id: "notifications",
  Provider: NotificationsProvider,
  Notifications: NotificationCenter,
  settings: [
    {
      id: "notifications",
      href: "/settings/notifications",
      labelKey: "settings.nav.notifications",
      icon: BellIcon,
      order: 50,
    },
  ],
};
