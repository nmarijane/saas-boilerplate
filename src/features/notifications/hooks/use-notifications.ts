"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastCount = useRef(0);

  const fetchUnreadCount = useCallback(async () => {
    if (document.hidden) return;

    try {
      const res = await fetch("/api/notifications?countOnly=true");
      if (res.ok) {
        const data = await res.json();
        if (data.count !== lastCount.current) {
          lastCount.current = data.count;
          setUnreadCount(data.count);
        }
      }
    } catch {
      // Silently fail - will retry on next poll
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchUnreadCount();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUnreadCount]);

  return { unreadCount, refresh: fetchUnreadCount };
}
