// Where the focus goes when the drawer closes. Radix gives it back to the
// `Trigger` of the dialog, and this drawer has none: it is controlled, and what
// opens it is a button of the header or of the tab bar, a long way from the
// sheet in the markup. Left to Radix, Escape, the scrim and the close button all
// drop the focus on the page body (WCAG 2.4.3, focus order), so the shell keeps
// the control that opened the drawer and gives the focus back to it here.
//
// It is plain on purpose: the part that decides is a function of what it is
// given, and a test can call it without a browser.

/** What the shell needs of the control that opened the drawer. */
interface Opener {
  focus: (options?: FocusOptions) => void;
  getBoundingClientRect: () => Pick<DOMRect, "top" | "right" | "bottom" | "left">;
}

/** The size of the screen the control is on, as `window.innerWidth` and `innerHeight` give it. */
interface Screen {
  width: number;
  height: number;
}

/** Whether the whole of a box is on the screen: a control that is cut by an edge has its focus ring cut too. */
function isOnScreen(box: ReturnType<Opener["getBoundingClientRect"]>, screen: Screen): boolean {
  return box.top >= 0 && box.left >= 0 && box.bottom <= screen.height && box.right <= screen.width;
}

/**
 * The handler of `onCloseAutoFocus` of the drawer's sheet. It always cancels
 * what Radix would do (focus its trigger, which does not exist, and leave the
 * focus on the body), and then gives the focus to `opener`, unless the page
 * changed since the drawer opened: after a link, the back button or the account
 * menu, the new page has its own idea of where the focus goes, and the opener is
 * not the place to undo it.
 *
 * The page does not scroll while the sheet is open, so an opener that is on the
 * screen is where the person left it, and the focus goes to it without scrolling:
 * a plain `focus()` on a sticky control (the tab bar's More) makes the browser
 * scroll the document to where the control sits in the flow, by hundreds of
 * pixels. An opener that is not wholly on the screen is brought into view, as the
 * focus must not land where nobody sees it (WCAG 2.4.11).
 */
export function returnFocus(
  event: Event,
  opener: Opener | null,
  routeChanged: boolean,
  screen: Screen,
): void {
  event.preventDefault();

  if (routeChanged || opener === null) {
    return;
  }

  if (isOnScreen(opener.getBoundingClientRect(), screen)) {
    opener.focus({ preventScroll: true });
  } else {
    opener.focus();
  }
}
