"use client";

import { TrophyIcon } from "lucide-react";
import { toast } from "sonner";

interface AchievementToastData {
  name: string;
  points: number;
}

export function showAchievementToast({ name, points }: AchievementToastData) {
  toast(name, {
    description: `+${points} points`,
    icon: <TrophyIcon className="text-primary size-5" />,
    duration: 5000,
  });
}
