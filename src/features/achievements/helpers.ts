import type { EventName } from "@/features/events/types";

const EVENT_TO_ACHIEVEMENTS: Partial<Record<EventName, string[]>> = {
  "member.invited": ["team-builder"],
  "feedback.created": ["feedback-giver"],
  "api_key.created": ["api-creator"],
  "presence.changed": ["streak-3", "streak-7", "streak-30"],
};

export function getAchievementKeysForEvent(eventName: string): string[] {
  return EVENT_TO_ACHIEVEMENTS[eventName as EventName] ?? [];
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] as string;
}

function daysBetween(dateStr: string, today: Date): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const t = new Date(`${formatDate(today)}T00:00:00Z`);
  return Math.round((t.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeStreak(
  lastLoginDate: string | null,
  currentStreak: number,
  now: Date = new Date(),
): { lastLoginDate: string; currentStreak: number } {
  const todayStr = formatDate(now);

  if (!lastLoginDate) {
    return { lastLoginDate: todayStr, currentStreak: 1 };
  }

  const gap = daysBetween(lastLoginDate, now);

  if (gap === 0) {
    return { lastLoginDate: todayStr, currentStreak };
  }

  if (gap === 1) {
    return { lastLoginDate: todayStr, currentStreak: currentStreak + 1 };
  }

  return { lastLoginDate: todayStr, currentStreak: 1 };
}
