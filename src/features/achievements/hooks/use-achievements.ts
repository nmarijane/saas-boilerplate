"use client";

import { useCallback, useEffect, useState } from "react";

interface AchievementData {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  points: number;
  progress: number;
  unlockedAt: string | null;
}

interface AchievementStats {
  totalPoints: number;
  unlockedCount: number;
  totalCount: number;
  currentStreak: number;
}

interface UseAchievementsReturn {
  achievements: AchievementData[];
  stats: AchievementStats;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useAchievements(): UseAchievementsReturn {
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const [stats, setStats] = useState<AchievementStats>({
    totalPoints: 0,
    unlockedCount: 0,
    totalCount: 0,
    currentStreak: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/achievements");
      if (!res.ok) return;
      const data = await res.json();
      setAchievements(data.achievements);
      setStats(data.stats);
    } catch {
      // Silently ignore fetch failures
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { achievements, stats, isLoading, refresh };
}
