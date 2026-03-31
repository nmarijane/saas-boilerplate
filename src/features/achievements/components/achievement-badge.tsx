"use client";

import type { LucideIcon } from "lucide-react";
import * as icons from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface AchievementBadgeProps {
  name: string;
  description: string;
  icon: string;
  points: number;
  threshold: number;
  progress: number;
  unlockedAt: string | null;
}

function getIcon(name: string): LucideIcon {
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const IconComponent = (icons as unknown as Record<string, LucideIcon>)[`${pascalName}Icon`];
  return IconComponent ?? icons.AwardIcon;
}

export function AchievementBadge({
  name,
  description,
  icon,
  points,
  threshold,
  progress,
  unlockedAt,
}: AchievementBadgeProps) {
  const Icon = getIcon(icon);
  const isUnlocked = unlockedAt !== null;
  const progressPercent = Math.min((progress / threshold) * 100, 100);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
        isUnlocked
          ? "border-primary/30 bg-primary/5"
          : "border-muted bg-muted/30 opacity-60",
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          isUnlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {!isUnlocked && (
        <div className="w-full">
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-[10px]">
            {progress}/{threshold}
          </p>
        </div>
      )}
      {isUnlocked && (
        <p className="text-primary text-xs font-medium">+{points} pts</p>
      )}
    </div>
  );
}
