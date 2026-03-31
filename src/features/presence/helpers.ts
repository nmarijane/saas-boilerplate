const IDLE_THRESHOLD_MS = 60_000;
const OFFLINE_THRESHOLD_MS = 120_000;

export type PresenceStatus = "online" | "idle" | "offline";

export interface PresenceEntry {
  userId: string;
  status: PresenceStatus;
  currentPage: string;
}

export function computeStatus(lastSeenAt: Date, now: Date = new Date()): PresenceStatus {
  const elapsed = now.getTime() - lastSeenAt.getTime();
  if (elapsed <= IDLE_THRESHOLD_MS) return "online";
  if (elapsed <= OFFLINE_THRESHOLD_MS) return "idle";
  return "offline";
}

export function diffPresence(
  prev: PresenceEntry[],
  next: PresenceEntry[],
): { changed: PresenceEntry[]; removed: string[] } {
  const prevMap = new Map(prev.map((p) => [p.userId, p]));
  const nextMap = new Map(next.map((n) => [n.userId, n]));

  const changed: PresenceEntry[] = [];
  for (const [userId, entry] of nextMap) {
    const prevEntry = prevMap.get(userId);
    if (
      !prevEntry
      || prevEntry.status !== entry.status
      || prevEntry.currentPage !== entry.currentPage
    ) {
      changed.push(entry);
    }
  }

  const removed: string[] = [];
  for (const userId of prevMap.keys()) {
    if (!nextMap.has(userId)) {
      removed.push(userId);
    }
  }

  return { changed, removed };
}
