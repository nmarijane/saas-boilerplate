import { describe, expect, it, vi } from "vitest";
import { scheduleTokenRemoval } from "@/features/auth/reset-token";

/**
 * The link of the reset e-mail carries the token in its address (`?token=`),
 * and an address is kept: it stays in the history and on the screen, is read by
 * extensions, and goes with the events of the browser's error reporter. The page
 * reads the token once, keeps it in memory, and replaces the address with one
 * that does not hold it (`history.replaceState`: no reload, no new entry).
 * Node has no window: a stand-in has what the function reads of one.
 *
 * Next's router has to hear of the new address, or it keeps the old one, token
 * and all, and writes it back to the address bar at its next change (a refresh,
 * a server action, Fast Refresh). It hears of it through its own
 * `history.replaceState`, which it installs in an effect of its own. That effect
 * runs after the effects of the page (a child's effect runs before its parent's),
 * so the address is replaced a tick later, and with no state of the history entry:
 * the router takes a call that carries its own `__NA` marker for its own.
 */

interface Fake {
  window: Parameters<typeof scheduleTokenRemoval>[0];
  /** The query the router of Next holds: what `useSearchParams()` returns, and what it writes back to the address bar. */
  router: { search: string };
  /** The address bar, and the state of the entry. */
  address: { href: string; state: unknown };
  /** The effect of the router has run: `history.replaceState` is its own from now on. */
  mountRouter: () => void;
  /** The ticks go by: every timer that was set runs. */
  tick: () => void;
  replaceState: ReturnType<typeof vi.fn>;
}

/**
 * A window with the history of the browser and the router of Next on top of it.
 * Before `mountRouter()` `history.replaceState` is the browser's own: it sets the
 * address and the state it is given, and nobody else hears of it. After it, it is the one
 * Next installs (`next/dist/client/components/app-router.js`): a state that carries the
 * `__NA` marker is the router's own call and leaves the router alone; any other call
 * is an outside change of the address, which the router is told of, and its
 * bookkeeping is added to the entry.
 */
function fakeWindow(href: string): Fake {
  const router = { search: new URL(href).search };
  // What the router's own effect on the history wrote at the first commit
  const address = { href, state: { __NA: true, idx: 3 } as unknown };
  let mounted = false;
  const timers = new Map<number, () => void>();
  let next = 1;

  const replaceState = vi.fn((data: unknown, _unused: string, url: string) => {
    if (mounted) {
      const isTheRoutersOwn = typeof data === "object" && data !== null && "__NA" in data;
      if (!isTheRoutersOwn) {
        router.search = new URL(url, address.href).search;
      }
      address.state = { ...(typeof data === "object" ? data : {}), __NA: true, idx: 3 };
    } else {
      address.state = data;
    }
    address.href = new URL(url, address.href).href;
  });

  return {
    window: {
      location: {
        get href() {
          return address.href;
        },
      },
      history: { replaceState },
      setTimeout: (handler) => {
        const handle = next++;
        timers.set(handle, handler);

        return handle;
      },
      clearTimeout: (handle) => {
        timers.delete(handle);
      },
    },
    router,
    address,
    mountRouter: () => {
      mounted = true;
    },
    tick: () => {
      for (const [handle, handler] of [...timers]) {
        timers.delete(handle);
        handler();
      }
    },
    replaceState,
  };
}

/** What the page does: schedules the removal in its effect, then the router mounts, then the ticks go by. */
function pageOpens(href: string) {
  const fake = fakeWindow(href);
  const cancel = scheduleTokenRemoval(fake.window);
  fake.mountRouter();
  fake.tick();

  return { ...fake, cancel };
}

describe("taking the token out of the address of the page", () => {
  it("replaces the address with one that does not hold the token", () => {
    const { address, replaceState } = pageOpens("https://app.example.com/en/reset-password?token=abc123");

    expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, "", "/en/reset-password");
    expect(address.href).toBe("https://app.example.com/en/reset-password");
  });

  // The router's own effect runs after the page's: an address replaced at once is replaced by
  // the browser alone, and the router never hears of it
  it("waits for a tick, so that the router has installed its own history.replaceState", () => {
    const fake = fakeWindow("https://app.example.com/en/reset-password?token=abc123");

    scheduleTokenRemoval(fake.window);

    expect(fake.replaceState).not.toHaveBeenCalled();
    expect(fake.address.href).toContain("token=abc123");
  });

  // The address the router holds is what `useSearchParams()` returns, and what it writes back to the
  // address bar at its next change (`router.refresh()`, a server action, Fast Refresh): with the token
  // still in it, the token comes back. The stand-in holds that address and nothing more of the router:
  // its entry state, which keeps the old query until that change, is not the stand-in's to check.
  it("leaves the address the router holds with no token to write back to the address bar", () => {
    const { router } = pageOpens("https://app.example.com/en/reset-password?token=abc123&lang=fr");

    expect(router.search).toBe("?lang=fr");
    expect(router.search).not.toContain("token");
  });

  // The state of the entry holds the bookkeeping of Next's router. Passed back, it makes the call the
  // router's own, and the router never learns that the address has changed.
  it("passes no state of the history entry back: Next's router keeps its own", () => {
    const { replaceState } = pageOpens("https://app.example.com/en/reset-password?token=abc123");

    expect(replaceState.mock.calls[0]?.[0]).toBeNull();
  });

  it("keeps the bookkeeping of the router in the entry: it can still be traversed", () => {
    const { address } = pageOpens("https://app.example.com/en/reset-password?token=abc123");

    expect(address.state).toMatchObject({ __NA: true });
  });

  it("keeps the rest of the address: the other parameters and the fragment", () => {
    const { replaceState } = pageOpens("https://app.example.com/fr/reset-password?lang=fr&token=abc123&x=1#form");

    expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, "", "/fr/reset-password?lang=fr&x=1#form");
  });

  it("takes every token the address holds, not only the first", () => {
    const { replaceState } = pageOpens("https://app.example.com/en/reset-password?token=a&token=b");

    expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, "", "/en/reset-password");
  });

  it("does nothing when the address holds no token: it can run twice", () => {
    const first = pageOpens("https://app.example.com/en/reset-password");
    const second = pageOpens("https://app.example.com/en/reset-password?error=INVALID_TOKEN");

    expect(first.replaceState).not.toHaveBeenCalled();
    expect(second.replaceState).not.toHaveBeenCalled();
  });

  it("does not touch a parameter that only has token in its name", () => {
    const { replaceState } = pageOpens("https://app.example.com/en/reset-password?csrf_token=keep&token=drop");

    expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, "", "/en/reset-password?csrf_token=keep");
  });

  // React runs an effect, undoes it and runs it again in development: the first removal is cancelled, and
  // the second one is the only one
  it("can be cancelled: a page that is left before the tick takes nothing out", () => {
    const fake = fakeWindow("https://app.example.com/en/reset-password?token=abc123");

    const cancel = scheduleTokenRemoval(fake.window);
    cancel();
    fake.mountRouter();
    fake.tick();

    expect(fake.replaceState).not.toHaveBeenCalled();
  });

  it("is done once when the effect runs twice, as it does in development", () => {
    const fake = fakeWindow("https://app.example.com/en/reset-password?token=abc123");

    const cancelFirst = scheduleTokenRemoval(fake.window);
    cancelFirst();
    scheduleTokenRemoval(fake.window);
    fake.mountRouter();
    fake.tick();

    expect(fake.replaceState).toHaveBeenCalledOnce();
    expect(fake.router.search).toBe("");
  });
});
