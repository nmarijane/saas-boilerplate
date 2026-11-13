import type { NotificationItem } from "@/features/notifications/list-state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkAllReadButton } from "@/features/notifications/components/mark-all-read-button";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { ShellProvider } from "@/shared/components/shell/shell-context";
import { toast } from "@/shared/components/ui/sonner";
import { attribute, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { shellView } from "../../helpers/shell";

// The two parts of the Notifications page that hold a handler. A static render
// cannot press a button, so what they hand to the button and to the rows is read
// here and called: the center (which tells the server and the bell), the router
// and the toasts are replaced, and so are the button and the row, which draw
// what they are given and keep their props.
const center = vi.hoisted(() => ({
  markAllRead: vi.fn(),
  markRead: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const drawn = vi.hoisted(() => ({
  buttons: [] as Record<string, unknown>[],
  rows: [] as { notification: NotificationItem; onOpen: (id: string, link: string | null) => void }[],
}));

vi.mock("@/features/notifications/components/notifications-provider", () => ({
  useNotificationCenter: () => center,
}));
vi.mock("@/shared/lib/i18n-navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/settings/notifications",
}));
vi.mock("@/shared/components/ui/sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/components/ui/button", () => ({
  Button: (props: Record<string, unknown>) => {
    drawn.buttons.push(props);
    return <button type="button">{props.children as string}</button>;
  },
}));
vi.mock("@/features/notifications/components/notification-row", () => ({
  NotificationRow: (props: (typeof drawn.rows)[number]) => {
    drawn.rows.push(props);
    return <button type="button">{props.notification.title}</button>;
  },
}));

const reported = vi.fn();
const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  drawn.buttons.length = 0;
  drawn.rows.length = 0;
  center.markAllRead.mockResolvedValue(undefined);
  center.markRead.mockResolvedValue(undefined);
  vi.stubGlobal("reportError", reported);
  vi.stubGlobal("window", { location: { assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the button that marks everything read", () => {
  /** The button the page draws, and the props it was given. */
  function render(locale: "en" | "fr" = "en") {
    const html = renderWithIntl(<MarkAllReadButton />, locale);
    const [props] = drawn.buttons;
    expect(props, "one button").toBeDefined();

    return {
      html,
      press: () => (props?.onClick as () => void)(),
      /** The button is in the page, inside the main region, which can take the focus. */
      attach: () => {
        const focus = vi.fn();
        (props?.ref as { current: unknown }).current = { closest: (selector: string) => (selector === "main" ? { focus } : null) };
        return focus;
      },
      props,
    };
  }

  it("is the one button, that says what it does, in the language of the page", () => {
    expect(textOf(render().html)).toBe("Mark all as read");
    drawn.buttons.length = 0;
    expect(textOf(render("fr").html)).toBe("Tout marquer comme lu");
  });

  it("is a plain button that loads while it works: it is not disabled, so it keeps the focus", () => {
    const { props } = render();

    expect(props).toMatchObject({ type: "button", loading: false });
    expect(props.disabled).toBeUndefined();
  });

  it("marks everything read through the center, which clears the bell, then says so and reads the page again", async () => {
    const { press, attach } = render();
    const focus = attach();

    press();
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());

    expect(center.markAllRead).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("All notifications marked as read.");
    expect(toast.error).not.toHaveBeenCalled();
    // The focus is put on the main region before the page is read again: the button goes with the unread
    expect(focus).toHaveBeenCalledOnce();
    expect(focus.mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0] ?? 0);
  });

  it("tells the person, and the error reporter, when the server refuses, and reads nothing again", async () => {
    center.markAllRead.mockRejectedValue(new Error("signed out"));
    const { press, attach } = render();
    const focus = attach();

    press();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());

    expect(toast.error).toHaveBeenCalledWith("An error occurred");
    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "signed out" }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  // The second press waits for the first: the guard is read at once (a ref), not from the render that the
  // press was made in (a state), so that two presses in the same turn do not both pass it.
  it("takes a second press while the first is working for none: the server is asked once", async () => {
    let finish: () => void = () => {};
    center.markAllRead.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { press } = render();

    press();
    press();
    press();
    expect(center.markAllRead).toHaveBeenCalledOnce();

    finish();
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    // Once it is over, it can be pressed again
    press();
    expect(center.markAllRead).toHaveBeenCalledTimes(2);
  });

  it("still reads the page again when the button is not inside a main region", async () => {
    const { press } = render();

    press();
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
  });
});

describe("the list of the notifications", () => {
  const ITEMS: NotificationItem[] = [
    { id: "n1", title: "Payment failed", body: "We could not charge the card.", read: false, type: "warning", link: "/settings/billing", createdAt: "2026-11-03T10:00:00.000Z" },
    { id: "n2", title: "Camille joined", body: "Camille accepted your invitation.", read: false, type: "info", link: null, createdAt: "2026-11-02T10:00:00.000Z" },
    { id: "n3", title: "Your export is ready", body: "Available for 24 hours.", read: true, type: "success", link: "https://example.com/export", createdAt: "2026-11-01T10:00:00.000Z" },
    { id: "n4", title: "Welcome", body: "Your workspace is ready.", read: false, type: "info", link: "javascript:alert(1)", createdAt: "2026-10-30T10:00:00.000Z" },
  ];

  function render(items: NotificationItem[] = ITEMS, locale: "en" | "fr" = "en") {
    const html = renderWithIntl(
      <ShellProvider view={shellView()}>
        <NotificationList notifications={items} />
      </ShellProvider>,
      locale,
    );
    /** Presses the row of this notification. */
    const open = (id: string) => {
      const row = drawn.rows.find(({ notification }) => notification.id === id);
      expect(row, `a row for ${id}`).toBeDefined();
      row?.onOpen(id, row.notification.link);
    };

    return { html, open };
  }

  it("is a card whose title, a level-two heading, names the list", () => {
    const { html } = render();
    const [title = ""] = elements(html, "h2");
    const [list = ""] = startTags(html, "ul");

    expect(textOf(title)).toBe("Latest notifications");
    expect(attribute(startTags(title, "h2")[0] ?? "", "data-slot")).toBe("card-title");
    expect(attribute(list, "role")).toBe("list");
    expect(attribute(list, "aria-labelledby")).toBe(attribute(startTags(title, "h2")[0] ?? "", "id"));
    expect(startTags(html, "h1")).toEqual([]);
  });

  it("draws one row for each notification, in the order it was given, each in a list item", () => {
    const { html } = render();

    expect(elements(html, "li")).toHaveLength(4);
    expect(drawn.rows.map(({ notification }) => notification.id)).toEqual(["n1", "n2", "n3", "n4"]);
    expect(elements(html, "li").map(textOf)).toEqual(["Payment failed", "Camille joined", "Your export is ready", "Welcome"]);
  });

  it("marks an unread notification read through the center, then goes to the page it points at", async () => {
    const { open } = render();

    open("n1");
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledOnce());

    expect(center.markRead).toHaveBeenCalledExactlyOnceWith("n1");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/settings/billing");
    expect(center.markRead.mock.invocationCallOrder[0]).toBeLessThan(router.push.mock.invocationCallOrder[0] ?? 0);
  });

  it("marks a notification with no link and reads the page again, so that its row and the count tell it", async () => {
    const { open } = render();

    open("n2");
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());

    expect(center.markRead).toHaveBeenCalledExactlyOnceWith("n2");
    expect(router.push).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("only follows the link of one that is read already, and leaves the web address to the browser", async () => {
    const { open } = render();

    open("n3");
    await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce());

    expect(center.markRead).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledExactlyOnceWith("https://example.com/export");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("never follows a link that is no page of the app and no web address: it is data that a job wrote", async () => {
    const { open } = render();

    open("n4");
    await vi.waitFor(() => expect(center.markRead).toHaveBeenCalledOnce());

    expect(router.push).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("tells the error reporter when the server refuses, still goes where the link points, and says so when it leads nowhere", async () => {
    center.markRead.mockRejectedValue(new Error("not yours"));
    const { open } = render();

    open("n1");
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledOnce());
    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "not yours" }));
    expect(toast.error).not.toHaveBeenCalled();

    open("n2");
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(toast.error).toHaveBeenCalledWith("An error occurred");
  });

  it("takes a second press on a row that is being opened for none: one notification takes one off the count, not two", async () => {
    let finish: () => void = () => {};
    center.markRead.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { open } = render();

    open("n2");
    open("n2");
    open("n2");
    expect(center.markRead).toHaveBeenCalledOnce();
    finish();
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());

    // Once it is done, the row can be opened again
    open("n2");
    expect(center.markRead).toHaveBeenCalledTimes(2);
  });

  it("speaks French", () => {
    expect(textOf(elements(render(ITEMS, "fr").html, "h2")[0] ?? "")).toBe("Dernières notifications");
  });
});
