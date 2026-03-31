"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAchievements } from "../hooks/use-achievements";
import { AchievementBadge } from "./achievement-badge";

const CATEGORIES = ["onboarding", "social", "usage", "streak"] as const;

export function AchievementGrid() {
  const { achievements, stats, isLoading } = useAchievements();
  const t = useTranslations("achievements");

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats summary */}
      <div className="flex gap-6">
        <div>
          <p className="text-2xl font-bold">{stats.totalPoints}</p>
          <p className="text-muted-foreground text-sm">{t("totalPoints")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">
            {stats.unlockedCount}/{stats.totalCount}
          </p>
          <p className="text-muted-foreground text-sm">{t("unlocked")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.currentStreak}</p>
          <p className="text-muted-foreground text-sm">{t("currentStreak")}</p>
        </div>
      </div>

      {/* Achievements by category */}
      {CATEGORIES.map((category) => {
        const categoryAchievements = achievements.filter(
          (a) => a.category === category,
        );
        if (categoryAchievements.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider">
              {t(`categories.${category}`)}
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {categoryAchievements.map((a) => (
                <AchievementBadge
                  key={a.id}
                  name={a.name}
                  description={a.description}
                  icon={a.icon}
                  points={a.points}
                  threshold={a.threshold}
                  progress={a.progress}
                  unlockedAt={a.unlockedAt}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
