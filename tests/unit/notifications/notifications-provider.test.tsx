import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationsProvider,
  useNotificationCenter,
} from "@/features/notifications/components/notifications-provider";

// The server actions are replaced: what is asked is whom they are called with,
// and in which order, and not the database behind them.
const actions = vi.hoisted(() => ({
  markAsRead: vi.fn(),
  markAllRead: vi.fn(),
}));
vi.mock("@/features/notifications/actions", () => actions);

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  actions.markAsRead.mockResolvedValue(undefined);
  actions.markAllRead.mockResolvedValue(undefined);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ count: 2 }) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Center = ReturnType<typeof useNotificationCenter>;

/** Whether a promise settles within this long: a wait that never ends is a failure, and not a test that hangs. */
async function settlesWithin(promise: Promise<unknown>, milliseconds: number): Promise<boolean> {
  return Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(resolve, milliseconds, false)),
  ]);
}

/**
 * The center, as a component under the provider reads it once. A static render
 * never mounts: its effects do not run, and the state a call sets afterwards is
 * dropped, which is what this reads: what the calls ask of the server.
 */
function centerOf(): Center {
  let center: Center | undefined;
  function Probe() {
    center = useNotificationCenter();
    return null;
  }
  renderToStaticMarkup(
    <NotificationsProvider>
      <Probe />
    </NotificationsProvider>,
  );

  if (!center) {
    throw new Error("the hook was not called");
  }
  return center;
}

describe("notifications provider", () => {
  it("starts with nothing unread, until the first read says otherwise", () => {
    expect(centerOf().unreadCount).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("draws its children as they are, adding no element of its own", () => {
    const html = renderToStaticMarkup(
      <NotificationsProvider>
        <p>page</p>
      </NotificationsProvider>,
    );

    expect(html).toBe("<p>page</p>");
  });

  it("reads the count only, from the API, when it is asked to refresh", async () => {
    await centerOf().refresh();

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/notifications?countOnly=true");
  });

  it("does not reject when the count cannot be read", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(centerOf().refresh()).resolves.toBeUndefined();
  });

  it("tells the server a notification is read, then reads the count again", async () => {
    const order: string[] = [];
    actions.markAsRead.mockImplementation(async (id: string) => {
      order.push(`mark:${id}`);
    });
    fetchMock.mockImplementation(async (url: string) => {
      order.push(`read:${url}`);
      return { ok: true, json: async () => ({ count: 1 }) };
    });

    await centerOf().markRead("notif_7");

    expect(order).toEqual(["mark:notif_7", "read:/api/notifications?countOnly=true"]);
  });

  it("settles as soon as the server has been told: the count is read again behind, not waited for", async () => {
    // The re-read never answers: whoever waited for it would wait for ever.
    fetchMock.mockReturnValue(new Promise(() => {}));

    expect(await settlesWithin(centerOf().markRead("notif_7"), 200)).toBe(true);
    expect(await settlesWithin(centerOf().markAllRead(), 200)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("settles even when the count cannot be read again: the server was told, and that is what was asked", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(centerOf().markRead("notif_7")).resolves.toBeUndefined();
    await expect(centerOf().markAllRead()).resolves.toBeUndefined();
  });

  it("does not read the count again when the server refuses to mark a notification, and says why", async () => {
    actions.markAsRead.mockRejectedValue(new Error("not yours"));

    await expect(centerOf().markRead("notif_7")).rejects.toThrow("not yours");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tells the server everything is read, then reads the count again", async () => {
    const order: string[] = [];
    actions.markAllRead.mockImplementation(async () => {
      order.push("mark-all");
    });
    fetchMock.mockImplementation(async (url: string) => {
      order.push(`read:${url}`);
      return { ok: true, json: async () => ({ count: 0 }) };
    });

    await centerOf().markAllRead();

    expect(order).toEqual(["mark-all", "read:/api/notifications?countOnly=true"]);
  });

  it("does not read the count again when the server refuses to mark everything", async () => {
    actions.markAllRead.mockRejectedValue(new Error("signed out"));

    await expect(centerOf().markAllRead()).rejects.toThrow("signed out");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives the same functions to every reader, so that two bells share one center", () => {
    let first: Center | undefined;
    let second: Center | undefined;
    function Probe({ keep }: { keep: (center: Center) => void }) {
      keep(useNotificationCenter());
      return null;
    }
    renderToStaticMarkup(
      <NotificationsProvider>
        <Probe keep={(center) => { first = center; }} />
        <Probe keep={(center) => { second = center; }} />
      </NotificationsProvider>,
    );

    expect(first).toBeDefined();
    expect(first).toBe(second);
  });

  it("must be read under the provider: outside it there is nothing to read", () => {
    function Probe() {
      useNotificationCenter();
      return null;
    }
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/NotificationsProvider/);

    error.mockRestore();
  });
});
