"use client";

import { cn } from "@/shared/utils/cn";

interface PresenceIndicatorProps {
  status: "online" | "idle" | "offline";
  size?: "sm" | "md";
}

const statusColors = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  offline: "bg-gray-400",
};

const sizes = {
  sm: "size-2",
  md: "size-3",
};

export function PresenceIndicator({ status, size = "sm" }: PresenceIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0",
        statusColors[status],
        sizes[size],
        status === "online" && "animate-pulse",
      )}
      aria-label={status}
    />
  );
}
