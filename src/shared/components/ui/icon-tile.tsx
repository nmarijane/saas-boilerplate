import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

// An icon sits in a tinted tile, never bare. Each tone pairs a tint with the
// ink that reads on it, in light and in dark. The tones t1 to t4 are the
// palette of the tiles that tell several things apart (a row of cards): a tone
// of the shell, a number from 1 to 4, is written `t${n}`.
// There is no danger background token: danger mixes its color into the
// surface, as `--brand-tint` does with the brand.
const tones = {
  brand: "bg-brand-tint text-brand-tint-ink",
  neutral: "bg-secondary text-ink-soft",
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  danger:
    "bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-danger-text",
  t1: "bg-tone-1 text-tone-1-ink",
  t2: "bg-tone-2 text-tone-2-ink",
  t3: "bg-tone-3 text-tone-3-ink",
  t4: "bg-tone-4 text-tone-4-ink",
} as const;

// 32, 40 and 56 px: the corner and the icon grow with the tile. `icon` is the
// size of an icon the tile draws itself; `drawn` sizes one it was handed, which
// it cannot give a class: it reaches the svg from the tile.
const sizes = {
  sm: { tile: "size-8 rounded-sm", icon: "size-4.5", drawn: "[&>svg]:size-4.5" },
  md: { tile: "size-10 rounded-md", icon: "size-5", drawn: "[&>svg]:size-5" },
  lg: { tile: "size-14 rounded-lg", icon: "size-6.5", drawn: "[&>svg]:size-6.5" },
} as const;

interface IconTileBaseProps {
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
  className?: string;
}

// An icon, or one that is already drawn, never both and never neither: with
// both, one would be dropped without a word, and with neither the tile is empty.
type IconTileProps = IconTileBaseProps &
  (
    | {
        /** A Lucide icon, drawn at the size of the tile. */
        icon: LucideIcon;
        children?: never;
      }
    | {
        icon?: never;
        /**
         * An icon that is already drawn: the shell hands its icons over drawn (a
         * quota's, a first step's), as a component cannot cross from the server
         * to the client. The tile sizes the `svg` and hides the whole of itself
         * from assistive technology, as it is decoration.
         */
        children: ReactNode;
      }
  );

// The icon is decoration: the words next to the tile say what it stands for.
function IconTile({
  icon: Icon,
  children,
  tone = "brand",
  size = "md",
  className,
}: IconTileProps) {
  return (
    <span
      data-slot="icon-tile"
      // An icon the tile draws hides itself; one it was handed is the caller's,
      // so the tile hides it, whatever it is.
      aria-hidden={Icon ? undefined : "true"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizes[size].tile,
        !Icon && sizes[size].drawn,
        tones[tone],
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" className={sizes[size].icon} />
      ) : (
        children
      )}
    </span>
  );
}

export { IconTile };
export type { IconTileProps };
