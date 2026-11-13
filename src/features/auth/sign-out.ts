/** What signing out needs from the outside: the session, and the router of the app. */
interface SignOutDeps {
  /** Ends the session. It rejects when it could not be ended. */
  signOut: () => Promise<unknown>;
  push: (href: string) => void;
  refresh: () => void;
}

/**
 * Ends the session, then goes to the sign-in page and reads the app again, so
 * that nothing of the person is left in what the router kept. The order is the
 * point, as it is for `switchWorkspace`: the sign-in page comes only once the
 * session has ended. A session that could not be ended leaves the person where
 * they are: they are still signed in, and the sign-in page would send them
 * straight back. The rejection goes to the caller, which is the one that says so.
 * A caller that switches accounts gives the sign-in page with the page to come
 * back to (`/sign-in?callbackUrl=...`).
 */
export async function signOutAndLeave(deps: SignOutDeps, href = "/sign-in"): Promise<void> {
  await deps.signOut();
  deps.push(href);
  deps.refresh();
}
