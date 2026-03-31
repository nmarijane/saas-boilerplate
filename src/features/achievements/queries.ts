"use server";

import { eq } from "drizzle-orm";
import { achievement, userAchievement, userStreak } from "@/models/achievement";
import { db } from "@/shared/lib/DB";

export async function getAchievements() {
  return db.select().from(achievement);
}

export async function getUserProgress(userId: string) {
  return db
    .select({
      achievementId: userAchievement.achievementId,
      progress: userAchievement.progress,
      unlockedAt: userAchievement.unlockedAt,
    })
    .from(userAchievement)
    .where(eq(userAchievement.userId, userId));
}

export async function getUserStreak(userId: string) {
  const rows = await db
    .select()
    .from(userStreak)
    .where(eq(userStreak.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAchievementsWithProgress(userId: string) {
  const [achievements, progress] = await Promise.all([
    getAchievements(),
    getUserProgress(userId),
  ]);

  const progressMap = new Map(progress.map((p) => [p.achievementId, p]));

  return achievements.map((a) => {
    const p = progressMap.get(a.id);
    return {
      ...a,
      progress: p?.progress ?? 0,
      unlockedAt: p?.unlockedAt ?? null,
    };
  });
}
