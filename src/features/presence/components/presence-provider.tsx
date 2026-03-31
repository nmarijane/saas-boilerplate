"use client";

import { createContext, useContext } from "react";
import { usePresence } from "../hooks/use-presence";

interface PresenceMember {
  userId: string;
  userName: string;
  userImage: string | null;
  currentPage: string;
  status: "online" | "idle" | "offline";
  lastSeenAt: string;
}

interface PresenceContextValue {
  members: PresenceMember[];
  isConnected: boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  members: [],
  isConnected: false,
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const presence = usePresence();
  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresenceContext() {
  return useContext(PresenceContext);
}
