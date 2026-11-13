import { unstable_rethrow } from "next/navigation";

// What the buttons of the billing page do with the answer of the server, as a
// plain function: the server and the page are given, so that a test calls it
// with a server that refuses (the interface cannot, in Node: it has no DOM to
// click in).

interface OpenBillingPageDeps {
  /** Asks the server for the address of the page (the portal, the checkout). It rejects when the server refuses. */
  open: () => Promise<{ url: string | null }>;
  /** Leaves the app for that address. */
  go: (url: string) => void;
  /** Tells the person that nothing opened (a toast). */
  fail: () => void;
  /** Hears an error that was handled: handled is not hidden. */
  report: (error: unknown) => void;
}

/**
 * Opens a page of the payment provider: asks the server for its address, then
 * goes there, and says whether it did. A refusal of the server, or an answer
 * with no address, leaves the person where they are, and is told: with no page
 * opening, nothing else would. A refusal is reported too.
 */
export async function openBillingPage({
  open,
  go,
  fail,
  report,
}: OpenBillingPageDeps): Promise<boolean> {
  let url: string | null;
  try {
    ({ url } = await open());
  } catch (error) {
    unstable_rethrow(error);
    report(error);
    fail();
    return false;
  }

  if (!url) {
    fail();
    return false;
  }

  go(url);
  return true;
}
