import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/utils/cn";

// An icon sits in a tinted tile, never bare. Each tone pairs a tint with the
// ink that reads on it, in light and in dark. The numbered tones are the
// palette of the tiles that tell several things apart (a row of cards).
// There is no danger background token: danger mixes its color into the
// surface, as `--brand-tint` does with the brand.
const tones = {
  brand: "bg-brand-tint text-brand-tint-ink",
  neutral: "bg-secondary text-ink-soft",
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  danger:
    "bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-danger-text",
  1: "bg-tone-1 text-tone-1-ink",
  2: "bg-tone-2 text-tone-2-ink",
  3: "bg-tone-3 text-tone-3-ink",
  4: "bg-tone-4 text-tone-4-ink",
} as const;

// 32, 40 and 56 px: the corner and the icon grow with the tile.
const sizes = {
  sm: { tile: "size-8 rounded-sm", icon: "size-4.5" },
  md: { tile: "size-10 rounded-md", icon: "size-5" },
  lg: { tile: "size-14 rounded-lg", icon: "size-6.5" },
} as const;

interface IconTileProps {
  icon: LucideIcon;
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
  className?: string;
}

// The icon is decoration: the words next to the tile say what it stands for.
function IconTile({
  icon: Icon,
  tone = "brand",
  size = "md",
  className,
}: IconTileProps) {
  return (
    <span
      data-slot="icon-tile"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizes[size].tile,
        tones[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className={sizes[size].icon} />
    </span>
  );
}

export { IconTile };
export type { IconTileProps };
