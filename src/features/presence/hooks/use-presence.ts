"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "@/shared/lib/i18n-navigation";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface PresenceMember {
  userId: string;
  userName: string;
  userImage: string | null;
  currentPage: string;
  status: "online" | "idle" | "offline";
  lastSeenAt: string;
}

interface UsePresenceReturn {
  members: PresenceMember[];
  isConnected: boolean;
}

export function usePresence(): UsePresenceReturn {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathnameRef.current }),
      });
    } catch {
      // Silently ignore heartbeat failures
    }
  }, []);

  useEffect(() => {
    // Start heartbeat
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Connect to SSE stream
    const eventSource = new EventSource("/api/presence/stream");

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init" || data.type === "update") {
          setMembers(data.members);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      clearInterval(heartbeatInterval);
      eventSource.close();
      setIsConnected(false);
    };
  }, [sendHeartbeat]);

  return { members, isConnected };
}
