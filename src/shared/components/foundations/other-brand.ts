// What a project edits in theme.css, written as the inline style of a subtree.
// A mid-tone brand needs three more tokens than a deep one: a dark ink on it
// (white on this red is 3.9:1, and a label asks 4.5:1), and a hover and a press
// that lighten the button, as the dark theme does, so that the ink keeps its
// contrast. `--brand-2` is left as given: its orange meets the bar track at
// 2.6:1 in light, short of the 3:1 theme-contrast.test.ts asks, so a real brand
// would darken it.
//
// The one list of the "Other brand" story and of the README's screenshot, which
// sets it on <html>.
export const OTHER_BRAND: Record<string, string> = {
  "--brand": "#E5484D",
  "--brand-2": "#F76B15",
  "--brand-on": "#101217",
  "--btn-primary-hover": "color-mix(in oklab, var(--brand) 90%, #fff)",
  "--btn-primary-active": "color-mix(in oklab, var(--brand) 82%, #fff)",
  "--corner-card": "4px",
  "--typeface-display": "Georgia, serif",
};
