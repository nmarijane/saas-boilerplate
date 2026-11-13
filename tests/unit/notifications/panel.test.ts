import type { NotificationItem } from "@/features/notifications/list-state";
import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { focusPanel, openNotification } from "@/features/notifications/panel";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

/** What `redirect()` throws when the session is gone. */
const redirectError = (() => {
  try {
    redirect("/sign-in");
  } catch (error) {
    return error;
  }
})();

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    title: "Payment failed",
    body: "We could not charge the card.",
    read: false,
    type: "warning",
    link: "/settings/billing",
    createdAt: "2026-11-03T10:00:00.000Z",
    ...overrides,
  };
}

/** What opening a notification calls, recorded in the order it is called. */
function deps({
  markRead = async () => {},
  follow = (link: string | null) => link !== null,
  opening = new Set<string>(),
}: {
  markRead?: (id: string) => Promise<void>;
  follow?: (link: string | null) => boolean | Promise<boolean>;
  /** The notifications being opened: a test that opens twice keeps it, as the component that draws the rows does. */
  opening?: Set<string>;
} = {}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      opening,
      markRead: async (id: string) => {
        calls.push(`mark:${id}`);
        await markRead(id);
      },
      follow: (notification: NotificationItem) => {
        calls.push(`follow:${notification.link}`);
        return follow(notification.link);
      },
      onMarked: (id: string) => {
        calls.push(`marked:${id}`);
      },
      report: () => {
        calls.push("report");
      },
      warn: () => {
        calls.push("warn");
      },
    },
  };
}

describe("openNotification", () => {
  describe("an unread notification with a link", () => {
    it("is marked read, and the list is told, before the link is followed", async () => {
      const { deps: d, calls } = deps();

      const outcome = await openNotification(item(), d);

      expect(calls).toEqual(["mark:n1", "marked:n1", "follow:/settings/billing"]);
      expect(outcome).toEqual({ marked: true, followed: true });
    });

    it("does not go anywhere until the server has been told: the link waits for that one call", async () => {
      let told: () => void = () => {};
      const { deps: d, calls } = deps({
        markRead: () => new Promise<void>((resolve) => {
          told = resolve;
        }),
      });

      const opening = openNotification(item(), d);
      await Promise.resolve();
      expect(calls).toEqual(["mark:n1"]);

      told();
      await opening;
      expect(calls).toEqual(["mark:n1", "marked:n1", "follow:/settings/billing"]);
    });

    it("still goes to the page when the server refuses to mark it: the person asked to go there", async () => {
      const failure = new Error("not yours");
      const { deps: d, calls } = deps({
        markRead: async () => {
          throw failure;
        },
      });

      const outcome = await openNotification(item(), d);

      // Reported, not shown: the page opening is what the person sees.
      expect(calls).toEqual(["mark:n1", "report", "follow:/settings/billing"]);
      expect(outcome).toEqual({ marked: false, followed: true });
    });
  });

  describe("an unread notification with no link", () => {
    it("is only marked read", async () => {
      const { deps: d, calls } = deps();

      const outcome = await openNotification(item({ link: null }), d);

      expect(calls).toEqual(["mark:n1", "marked:n1", "follow:null"]);
      expect(outcome).toEqual({ marked: true, followed: false });
    });

    it("says so when the server refuses: nothing else would show that the press did nothing", async () => {
      const { deps: d, calls } = deps({
        markRead: async () => {
          throw new Error("offline");
        },
      });

      const outcome = await openNotification(item({ link: null }), d);

      expect(calls).toEqual(["mark:n1", "report", "follow:null", "warn"]);
      expect(outcome).toEqual({ marked: false, followed: false });
    });
  });

  describe("an unread notification whose link is not followed", () => {
    it("says so when the server refuses too: a link that goes nowhere is no link", async () => {
      const { deps: d, calls } = deps({
        markRead: async () => {
          throw new Error("offline");
        },
        follow: () => false,
      });

      const outcome = await openNotification(item({ link: "javascript:alert(1)" }), d);

      expect(calls).toEqual(["mark:n1", "report", "follow:javascript:alert(1)", "warn"]);
      expect(outcome).toEqual({ marked: false, followed: false });
    });

    it("is marked, and nothing else, when the server accepts", async () => {
      const { deps: d, calls } = deps({ follow: () => false });

      const outcome = await openNotification(item({ link: "mailto:a@b.c" }), d);

      expect(calls).toEqual(["mark:n1", "marked:n1", "follow:mailto:a@b.c"]);
      expect(outcome).toEqual({ marked: true, followed: false });
    });
  });

  describe("a notification that is read", () => {
    it("is not marked again: the server is not asked for what is done", async () => {
      const { deps: d, calls } = deps();

      const outcome = await openNotification(item({ read: true }), d);

      expect(calls).toEqual(["follow:/settings/billing"]);
      expect(outcome).toEqual({ marked: false, followed: true });
    });

    it("with no link, does nothing, and says nothing: nothing failed", async () => {
      const { deps: d, calls } = deps();

      const outcome = await openNotification(item({ read: true, link: null }), d);

      expect(calls).toEqual(["follow:null"]);
      expect(outcome).toEqual({ marked: false, followed: false });
    });
  });

  // Following a notification of another workspace opens that workspace first, which the server may refuse
  it("says so, and reports it, when its page cannot be reached: nothing else would show the press did nothing", async () => {
    const refusal = new Error("not a member");
    const { deps: d, calls } = deps({
      follow: async () => {
        throw refusal;
      },
    });

    const outcome = await openNotification(item(), d);

    expect(calls).toEqual(["mark:n1", "marked:n1", "follow:/settings/billing", "report", "warn"]);
    expect(outcome).toEqual({ marked: true, followed: false });
  });

  // A press on a row that is being opened is a second press: the panel (and the page) keep the notifications that are
  // being opened, and a notification that is pressed twice takes one off the count, not two
  describe("a notification that is pressed twice", () => {
    /** An opening that waits for the server, and the way to let it finish. */
    function waiting() {
      const told: (() => void)[] = [];
      const markRead = vi.fn(
        (_id: string) =>
          new Promise<void>((resolve) => {
            told.push(resolve);
          }),
      );
      return { markRead, finish: () => told.forEach((resolve) => resolve()) };
    }

    it("is opened once: the server is told once, which takes one off the count, and the link is followed once", async () => {
      const { markRead, finish } = waiting();
      const opening = new Set<string>();
      const { deps: d, calls } = deps({ markRead, opening });

      const first = openNotification(item(), d);
      const second = openNotification(item(), d);
      const third = openNotification(item(), d);
      finish();
      const outcomes = await Promise.all([first, second, third]);

      expect(markRead).toHaveBeenCalledOnce();
      expect(calls).toEqual(["mark:n1", "marked:n1", "follow:/settings/billing"]);
      expect(outcomes).toEqual([
        { marked: true, followed: true },
        { marked: false, followed: false },
        { marked: false, followed: false },
      ]);
    });

    it("lets a press on another notification through while the first waits: each takes one off the count", async () => {
      const { markRead, finish } = waiting();
      const opening = new Set<string>();
      const { deps: d } = deps({ markRead, opening });

      const first = openNotification(item({ id: "n1" }), d);
      const other = openNotification(item({ id: "n2" }), d);
      finish();
      await Promise.all([first, other]);

      expect(markRead.mock.calls.map(([id]) => id)).toEqual(["n1", "n2"]);
    });

    it("keeps the notification while it is opened, and not a moment longer", async () => {
      const { markRead, finish } = waiting();
      const opening = new Set<string>();
      const { deps: d } = deps({ markRead, opening });

      const first = openNotification(item(), d);
      expect(opening.has("n1")).toBe(true);
      finish();
      await first;

      expect(opening.size).toBe(0);
    });

    it.each([
      [
        "the server refuses",
        {
          markRead: async () => {
            throw new Error("not yours");
          },
        },
      ],
      [
        "its page cannot be reached",
        {
          follow: async () => {
            throw new Error("not a member");
          },
        },
      ],
    ])("can be pressed again once the opening is over, whatever it came to: %s", async (_, options) => {
      const opening = new Set<string>();
      const { deps: d, calls } = deps({ ...options, opening });

      await openNotification(item(), d);
      expect(opening.size).toBe(0);

      calls.length = 0;
      await openNotification(item(), d);
      expect(calls[0]).toBe("mark:n1");
    });

    it("is not kept for ever when the page it goes to is a redirect of Next, which the panel hands on", async () => {
      const opening = new Set<string>();
      const { deps: d } = deps({
        opening,
        follow: async () => {
          throw redirectError;
        },
      });

      await expect(openNotification(item(), d)).rejects.toBe(redirectError);

      expect(opening.size).toBe(0);
    });
  });

  it("never rejects, whatever the server does", async () => {
    const { deps: d } = deps({
      markRead: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await expect(openNotification(item(), d)).resolves.toEqual({ marked: false, followed: true });
  });
});

describe("focusPanel", () => {
  it("keeps the focus where it would have gone, and puts it on the panel", () => {
    const event = { preventDefault: vi.fn() };
    const panel = { focus: vi.fn() };

    focusPanel(event, panel);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(panel.focus).toHaveBeenCalledOnce();
  });

  it("leaves the focus to the library when there is no panel to put it on", () => {
    const event = { preventDefault: vi.fn() };

    focusPanel(event, null);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone): the panel must not tell "something went wrong" to a person who is on their way to sign in, nor report it.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  it("is handed on when the server is told that the notification is read: not reported, not marked, no link followed", async () => {
    const { deps: d, calls } = deps({
      markRead: async () => {
        throw framework;
      },
    });

    expect(await outcomeOf(openNotification(item(), d))).toBe(framework);
    expect(calls).toEqual(["mark:n1"]);
  });

  it("is handed on when the page of the notification is reached: not reported, and the person is not told it could not be", async () => {
    const { deps: d, calls } = deps({
      follow: async () => {
        throw framework;
      },
    });

    expect(await outcomeOf(openNotification(item({ read: true }), d))).toBe(framework);
    expect(calls).toEqual(["follow:/settings/billing"]);
  });
});
