"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { markAllRead, markAsRead } from "../actions";
import { NotificationBell } from "./notification-bell";

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  link: string | null;
  createdAt: string;
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/notifications?limit=10")
        .then((res) => res.json())
        .then((data) => setNotifications(data.notifications ?? []))
        .catch(() => {});
    }
  }, [open]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClick = async (notif: Notification) => {
    if (!notif.read) {
      await markAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      );
    }
    if (notif.link) {
      window.location.href = notif.link;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div>
          <NotificationBell />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  !notif.read ? "bg-muted/30" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {!notif.read && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                  <p className="text-sm font-medium">{notif.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{notif.body}</p>
              </button>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <a href="/settings/notifications">View all</a>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
