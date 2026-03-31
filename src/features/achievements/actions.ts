"use server";

import { and, eq } from "drizzle-orm";
import { achievement, userAchievement, userStreak } from "@/models/achievement";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { computeStreak } from "./helpers";

interface ProgressResult {
  unlocked: boolean;
  achievementKey: string;
  points: number;
}

export async function progressAchievement(
  userId: string,
  achievementKey: string,
): Promise<ProgressResult | null> {
  const achievements = await db
    .select()
    .from(achievement)
    .where(eq(achievement.key, achievementKey))
    .limit(1);

  const ach = achievements[0];
  if (!ach) return null;

  const existing = await db
    .select()
    .from(userAchievement)
    .where(
      and(
        eq(userAchievement.userId, userId),
        eq(userAchievement.achievementId, ach.id),
      ),
    )
    .limit(1);

  const current = existing[0];

  if (current?.unlockedAt) {
    return null;
  }

  const newProgress = (current?.progress ?? 0) + 1;
  const unlocked = newProgress >= ach.threshold;

  if (current) {
    await db
      .update(userAchievement)
      .set({
        progress: newProgress,
        unlockedAt: unlocked ? new Date() : null,
      })
      .where(eq(userAchievement.id, current.id));
  } else {
    await db.insert(userAchievement).values({
      id: generateId(),
      userId,
      achievementId: ach.id,
      progress: newProgress,
      unlockedAt: unlocked ? new Date() : null,
    });
  }

  return { unlocked, achievementKey: ach.key, points: ach.points };
}

export async function checkAndUpdateStreak(userId: string): Promise<number> {
  const existing = await db
    .select()
    .from(userStreak)
    .where(eq(userStreak.userId, userId))
    .limit(1);

  const current = existing[0];
  const { lastLoginDate, currentStreak: newStreak } = computeStreak(
    current?.lastLoginDate ?? null,
    current?.currentStreak ?? 0,
  );

  if (current) {
    await db
      .update(userStreak)
      .set({ lastLoginDate, currentStreak: newStreak })
      .where(eq(userStreak.id, current.id));
  } else {
    await db.insert(userStreak).values({
      id: generateId(),
      userId,
      lastLoginDate,
      currentStreak: newStreak,
    });
  }

  return newStreak;
}
