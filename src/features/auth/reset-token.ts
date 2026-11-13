// The link of the reset e-mail carries the token in its address (`?token=`), and
// an address is kept: it stays in the history and on the screen, is read by
// browser extensions, and goes with the events of the error reporter. The reset
// page reads the token once, on the server, and hands it to the form, which keeps
// it in memory: this takes it out of the address. What it guarantees is the address,
// `useSearchParams()` and every request made after it: the router's entry state keeps
// the old query until its next change, and the payload of the page holds the token anyway.

/** What `scheduleTokenRemoval` reads and writes of a window: its address, its history and its timers. */
interface AddressWindow {
  location: { href: string };
  history: {
    replaceState: (state: unknown, unused: string, url: string) => void;
  };
  setTimeout: (handler: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
}

/**
 * Replaces the address of the page with one that does not hold a `token`
 * (`history.replaceState`: no reload and no new entry in the history), keeping
 * the rest of it. No state is passed (`null`, the form Next documents): Next's
 * router wraps `replaceState`, completes the state with its own bookkeeping and
 * learns the new address, which `useSearchParams()` and the next refresh read.
 * The state of the entry passed back would carry the router's marker, and the
 * router would take the call for its own and keep the old address, with its
 * `?token=`, to write it back at its next change. An address with no token is
 * left alone, so it can run twice (React runs an effect twice in development).
 */
function removeTokenFromAddress({ location, history }: Pick<AddressWindow, "location" | "history">): void {
  const address = new URL(location.href);
  if (!address.searchParams.has("token")) {
    return;
  }

  address.searchParams.delete("token");
  history.replaceState(null, "", `${address.pathname}${address.search}${address.hash}`);
}

/**
 * Takes the token out of the address once Next's router has taken the history
 * over, and says how to cancel it (what an effect returns). The router installs
 * its own `history.replaceState` in an effect, and that effect runs after the
 * effects of the page it holds (a child's effect runs before its parent's):
 * called from the effect of the form, the call would be the browser's own, the
 * router would never hear of the new address, and it would keep the token to write
 * it back at its next change (a refresh, a server action, Fast Refresh). A timer
 * runs after every effect of the commit.
 */
export function scheduleTokenRemoval(target: AddressWindow): () => void {
  const handle = target.setTimeout(() => removeTokenFromAddress(target), 0);

  return () => target.clearTimeout(handle);
}
