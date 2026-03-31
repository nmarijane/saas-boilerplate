import type { AppEvent } from "../types";
import { getLogger } from "@logtape/logtape";
import { checkAndUpdateStreak, progressAchievement } from "@/features/achievements/actions";
import { getAchievementKeysForEvent } from "@/features/achievements/helpers";

const logger = getLogger(["events", "achievement"]);

export async function handleAchievement(event: AppEvent): Promise<void> {
  const actorId = event.payload.actorId;
  if (!actorId) return;

  const achievementKeys = getAchievementKeysForEvent(event.name);
  if (achievementKeys.length === 0) return;

  try {
    // Handle streak achievements via presence.changed
    if (event.name === "presence.changed") {
      const status = (event.payload.metadata as Record<string, unknown> | undefined)?.status;
      if (status !== "online") return;

      const currentStreak = await checkAndUpdateStreak(actorId);

      for (const key of achievementKeys) {
        await progressAchievementForStreak(actorId, key, currentStreak);
      }
      return;
    }

    // Handle regular achievements (increment by 1)
    for (const key of achievementKeys) {
      const result = await progressAchievement(actorId, key);
      if (result?.unlocked) {
        logger.info`Achievement unlocked: ${key} for user ${actorId}`;
      }
    }
  } catch (error) {
    logger.error`Achievement handler failed for ${event.name}: ${error}`;
  }
}

async function progressAchievementForStreak(
  userId: string,
  achievementKey: string,
  currentStreak: number,
): Promise<void> {
  const result = await progressAchievement(userId, achievementKey);
  if (result?.unlocked) {
    logger.info`Streak achievement unlocked: ${achievementKey} for user ${userId} (streak: ${currentStreak})`;
  }
}
