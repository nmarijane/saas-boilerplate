// What the layers that float above the page (menus, lists, tooltips) share, so
// they read as one family and a theme changes them in one place.

/** The surface of a layer that floats above the page. */
export const popoverSurface =
  "bg-popover text-popover-foreground rounded-lg border shadow-pop";

/**
 * A selectable row of a menu or a list: 40 px high. Radix puts the focus on the
 * highlighted row, from the pointer or from the keyboard. That row gets a tint
 * and a 2 px ring drawn inside it, as the tint alone is 1.2:1 against the
 * surface. The ring is an outline: the list cannot clip it, and forced-colors
 * mode keeps it. It does not wait for `:focus-visible`, which engines disagree
 * on when a script moves the focus, as Radix does on hover.
 *
 * The system ring, a shadow outside the element that the base styles give to
 * the row that is the tab stop of a menu, is turned off: the list would clip
 * it, and it would double the ring inside.
 */
export const popoverItem = [
  "relative flex min-h-10 cursor-default items-center gap-2 rounded-md px-3 py-2 text-body outline-hidden select-none",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "focus:bg-accent focus:text-accent-foreground",
  "focus:outline-solid focus:outline-2 focus:-outline-offset-2 focus:outline-ring focus:shadow-none",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
].join(" ");

/**
 * The `destructive` variant of a row: danger text, which stays when the row is
 * highlighted, over a danger tint, and a danger ring.
 */
export const destructiveItem = [
  "data-[variant=destructive]:text-danger-text data-[variant=destructive]:focus:text-danger-text",
  "data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20",
  "data-[variant=destructive]:[--focus-ring:var(--danger)]",
].join(" ");
