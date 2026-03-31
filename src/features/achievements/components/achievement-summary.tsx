"use client";

import { TrophyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAchievements } from "../hooks/use-achievements";

export function AchievementSummary() {
  const { stats, isLoading } = useAchievements();
  const t = useTranslations("achievements");

  if (isLoading) return null;

  return (
    <a
      href="/settings/achievements"
      className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors"
    >
      <TrophyIcon className="size-3.5" />
      <span>
        {stats.unlockedCount}/{stats.totalCount} {t("badges")} — {stats.totalPoints} pts
      </span>
    </a>
  );
}
