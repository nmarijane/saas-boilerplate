import { cn } from "@/shared/utils/cn";
import { getInitials } from "@/shared/utils/helpers";

/** One of the four tints of the theme, `--tone-1` to `--tone-4`. */
type Tone = 1 | 2 | 3 | 4;

// FNV-1a over the code units of the seed, then the finalizer of MurmurHash3.
// Both are written with the 32-bit operations the language defines, so the
// number is the same in every browser and on the server. The finalizer carries
// the high bits down to the low ones, which are the only ones `% 4` reads.
// The constants are the ones of those two functions, so they stay in hex (and
// in the capitals the linter wants, which Prettier would lower).
// prettier-ignore
function hashOf(seed: string): number {
  let hash = 0x811C9DC5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85EBCA6B);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xC2B2AE35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

/**
 * The tone a seed always gets, from 1 to 4. The hash is stable: it never
 * changes from one release to the next, as people know an entity by its tile.
 */
function toneOf(seed: string): Tone {
  return ((hashOf(seed) % 4) + 1) as Tone;
}

const tones = {
  1: "bg-tone-1 text-tone-1-ink",
  2: "bg-tone-2 text-tone-2-ink",
  3: "bg-tone-3 text-tone-3-ink",
  4: "bg-tone-4 text-tone-4-ink",
} as const satisfies Record<Tone, string>;

// 32, 40 and 56 px, as the IconTile: the corner and the letters grow with the
// tile. The line is as tall as the letters, so that they sit in the middle.
const sizes = {
  sm: "size-8 rounded-sm text-meta leading-none",
  md: "size-10 rounded-md text-section leading-none",
  lg: "size-14 rounded-lg text-panel leading-none",
} as const;

interface InitialTileProps {
  /** The name of the entity: its first two words give the initials. */
  name: string;
  /**
   * What the tone comes from, the name unless it is given. Pass an id: a
   * rename then does not repaint the tile, and two entities of one name do
   * not share a color by accident.
   */
  seed?: string;
  size?: keyof typeof sizes;
  className?: string;
}

// The tile of an entity (a workspace, a project, a person without a photo):
// two initials on a tint. It is a picture, hidden from assistive technology:
// the name next to it is what says who it is. The tint is one of the four of
// the theme, so the tiles of a list tell their entities apart without a legend.
function InitialTile({ name, seed, size = "md", className }: InitialTileProps) {
  return (
    <span
      data-slot="initial-tile"
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center font-display font-semibold select-none",
        sizes[size],
        tones[toneOf(seed ?? name)],
        className,
      )}
    >
      {getInitials(name) || "?"}
    </span>
  );
}

export { InitialTile, toneOf };
export type { InitialTileProps, Tone };
