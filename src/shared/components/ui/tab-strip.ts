// The strip of tabs, in one place: Tabs (a tab list, switched in the page) and
// TabLinks (a navigation, one link per route) are two ways to switch, and they
// look and behave alike. This file holds what they share: the look of the
// strip and of a tab, and the scrolling that brings the active tab into view.
// A strip that does not fit scrolls sideways, and a scrolling box clips what
// sticks out of it, so everything is drawn inside it.

/**
 * The box that holds the tabs, which scrolls sideways when they do not fit
 * (the scrollbar is hidden: swipe, wheel and the arrow keys reach every tab).
 * Its hairline is an inset shadow, drawn inside the box, and the active tab
 * draws its line over it. Forced-colors mode drops shadows: a border keeps the
 * baseline there.
 */
export const tabStripStyles =
  "flex w-full items-end gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--hairline)] forced-colors:border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * One tab, at rest: 44 px high so that it is its own target, never shrunk below
 * its label, muted until it is hovered. The line under it is in the brand
 * color at the bottom of the tab, hidden until the tab is the active one: each
 * kind of tab brings it out with its own mark (`data-state` or `aria-current`).
 * Forced-colors mode replaces every background but a system color: the line
 * takes one, as the text no longer changes there.
 * The focus ring is drawn inside the tab, like the one of a menu row: the
 * scrolling strip would clip the system ring, a shadow outside the tab, which
 * the base styles give to every button and link (turned off here).
 */
export const tabStyles = [
  "relative inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-body font-medium whitespace-nowrap text-ink-muted",
  "transition-[color] duration-150 ease-expo hover:text-ink",
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand after:opacity-0 forced-colors:after:bg-[color:Highlight]",
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
].join(" ");

/** What marks the active one of a strip: the attribute it sets, and the selector that finds it. */
interface ActiveMark {
  attribute: string;
  selector: string;
}

/** The tab of a Tabs list that is selected: Radix says so in `data-state`. */
export const activeTab = {
  attribute: "data-state",
  selector: '[data-state="active"]',
} as const satisfies ActiveMark;

/** The link of TabLinks that stands for the page. */
export const activeLink = {
  attribute: "aria-current",
  selector: '[aria-current="page"]',
} as const satisfies ActiveMark;

/**
 * Scrolls a strip sideways, and nothing else, so that one of its items shows in
 * full. `scrollIntoView` would also move the page when the strip sits below the
 * fold; this moves the strip alone. It does the least it can: an item that
 * shows is left where it is, and one wider than the strip is lined up by its
 * start, which is never hidden. It reads the left and the right of the screen,
 * so it works the same on a right-to-left page.
 */
export function revealInStrip(
  strip: HTMLElement,
  item: HTMLElement,
  behavior: ScrollBehavior = "auto",
): void {
  const stripBox = strip.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  // Negative: the item is cut off at the left. Positive: at the right.
  const before = itemBox.left - stripBox.left;
  const after = itemBox.right - stripBox.right;

  let delta = 0;
  if (before < 0) {
    delta = before;
  } else if (after > 0) {
    delta = Math.min(after, before);
  }

  if (delta !== 0) {
    strip.scrollBy({ left: delta, behavior });
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Brings the active item of a strip into view now, and again each time the
 * active one changes. It watches the mark itself (`data-state` moves from tab
 * to tab, `aria-current` from link to link), so it does not matter how the
 * change came: a click, the arrow keys, a value the page sets, a new route.
 * The first reveal sets the strip where it belongs, with no animation; the
 * next ones glide, unless the user asks for less motion. Returns what stops
 * the watching, for the cleanup of an effect.
 */
export function watchActiveTab(
  strip: HTMLElement,
  active: ActiveMark,
): () => void {
  let first = true;

  const reveal = () => {
    const item = strip.querySelector<HTMLElement>(active.selector);
    if (item) {
      revealInStrip(
        strip,
        item,
        first || prefersReducedMotion() ? "auto" : "smooth",
      );
    }
    first = false;
  };

  const observer = new MutationObserver(reveal);
  observer.observe(strip, {
    attributes: true,
    attributeFilter: [active.attribute],
    subtree: true,
  });
  reveal();

  return () => observer.disconnect();
}
