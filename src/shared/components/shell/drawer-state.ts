import type { DrawerSide } from "./drawer";

// When the drawer closes by itself. It is plain on purpose, like focus-return.ts:
// the rule is a function of what it is given, and a test can call it without a
// browser.

/** What the drawer is opened over: the page, and the workspace the shell shows. */
export interface DrawerPage {
  pathname: string | null;
  workspaceId: string | null;
}

export interface DrawerState extends DrawerPage {
  open: boolean;
  /** Kept when it closes, so that the sheet leaves by the edge it came from. */
  side: DrawerSide;
}

/**
 * The drawer belongs to the page and to the workspace it was opened over: it
 * closes when either changes. A link of the drawer, the account menu or the
 * back button changes the page. Switching workspace changes the workspace,
 * and not always the page: it pushes the home, which is the page the person
 * is on when they switch from the home. The state it returns carries the page
 * it was synced with, closed or not, so that the same page closes it once.
 * With nothing changed it returns the state it was given.
 */
export function syncDrawer(state: DrawerState, page: DrawerPage): DrawerState {
  if (
    state.pathname === page.pathname &&
    state.workspaceId === page.workspaceId
  ) {
    return state;
  }

  return {
    ...state,
    open: false,
    pathname: page.pathname,
    workspaceId: page.workspaceId,
  };
}
