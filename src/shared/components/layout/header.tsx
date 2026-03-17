"use client";

import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { ThemeToggle } from "@/shared/components/layout/theme-toggle";

interface HeaderProps {
  notificationBell?: React.ReactNode;
  feedbackButton?: React.ReactNode;
}

export function Header({ notificationBell, feedbackButton }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Breadcrumb className="flex-1" />
      <div className="flex items-center gap-2">
        {feedbackButton}
        {notificationBell}
        <ThemeToggle />
      </div>
    </header>
  );
}
