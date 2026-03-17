"use client";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { deleteNotification, markAsRead } from "../actions";

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  link: string | null;
  createdAt: Date;
}

interface NotificationListProps {
  notifications: Notification[];
}

const typeBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  success: "default",
  warning: "outline",
  error: "destructive",
};

export function NotificationList({ notifications }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No notifications yet.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {notifications.map((notif) => (
        <li
          key={notif.id}
          className={`flex items-start gap-4 px-4 py-4 ${!notif.read ? "bg-muted/30" : ""}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{notif.title}</p>
              <Badge variant={typeBadgeVariant[notif.type] ?? "secondary"}>
                {notif.type}
              </Badge>
              {!notif.read && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{notif.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(notif.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-1">
            {!notif.read && (
              <form action={() => markAsRead(notif.id)}>
                <Button variant="ghost" size="sm" type="submit">
                  Mark read
                </Button>
              </form>
            )}
            <form action={() => deleteNotification(notif.id)}>
              <Button variant="ghost" size="sm" type="submit">
                Delete
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
