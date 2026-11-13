import type { ComponentProps } from "react";
import type { NotificationListState } from "@/features/notifications/list-state";
import { describe, expect, it, vi } from "vitest";
import {
  NotificationCenter,
  NotificationPanel,
} from "@/features/notifications/components/notification-center";
import { NotificationsProvider } from "@/features/notifications/components/notifications-provider";
import { notificationsShell } from "@/features/notifications/shell";
import { ShellProvider } from "@/shared/components/shell/shell-context";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { shellView } from "../../helpers/shell";

// The navigation of next-intl is replaced: the Link is a plain
// anchor, and the router is one that goes nowhere.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
    useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
    usePathname: () => "/dashboard",
  };
});

// The provider imports the server actions: replaced, as nothing here calls them.
vi.mock("@/features/notifications/actions", () => ({
  markAsRead: vi.fn(),
  markAllRead: vi.fn(),
}));

const ITEMS = [
  {
    id: "n1",
    title: "Payment failed",
    body: "We could not charge the card.",
    read: false,
    type: "warning",
    link: "/settings/billing",
    createdAt: "2026-11-03T10:00:00.000Z",
  },
  {
    id: "n2",
    title: "Welcome aboard",
    body: "Your workspace is ready.",
    read: true,
    type: "info",
    link: null,
    createdAt: "2026-11-02T09:00:00.000Z",
  },
];

function panel(
  props: Partial<ComponentProps<typeof NotificationPanel>> = {},
  locale: "en" | "fr" = "en",
): string {
  return renderWithIntl(
    <NotificationPanel
      titleId="notifications-title"
      list={{ status: "ready", items: ITEMS, refreshing: false }}
      hasUnread
      onMarkAllRead={() => {}}
      onRetry={() => {}}
      onOpen={() => {}}
      onNavigate={() => {}}
      {...props}
    />,
    locale,
  );
}

/** The start tag of the button that says exactly this. */
function buttonSaying(html: string, text: string): string {
  const button = elements(html, "button").find((candidate) => textOf(candidate) === text);
  return startTags(button ?? "", "button")[0] ?? "";
}

describe("notification center", () => {
  describe("the bell that opens it", () => {
    const html = renderWithIntl(
      <ShellProvider view={shellView()}>
        <NotificationsProvider>
          <NotificationCenter />
        </NotificationsProvider>
      </ShellProvider>,
    );
    const trigger = startTags(html, "button")[0] ?? "";

    it("is the bell, named by the count it reads from the provider", () => {
      // Nothing has been read yet: nothing is unread.
      expect(attribute(trigger, "aria-label")).toBe("Notifications");
      expect(html).not.toContain('data-slot="bell-dot"');
    });

    it("says that it opens a dialog, which is closed", () => {
      expect(attribute(trigger, "aria-haspopup")).toBe("dialog");
      expect(attribute(trigger, "aria-expanded")).toBe("false");
      expect(attribute(trigger, "data-state")).toBe("closed");
    });

    it("draws the panel only once it is open", () => {
      expect(html).not.toContain('role="dialog"');
      expect(startTags(html, "button")).toHaveLength(1);
    });

    it("must be drawn under the provider, which holds the one timer of the app", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => renderWithIntl(<NotificationCenter />)).toThrow(/NotificationsProvider/);

      error.mockRestore();
    });
  });

  describe("what the feature gives the shell", () => {
    it("wraps the shell in the provider and draws the center as the bell", () => {
      expect(notificationsShell.Provider).toBe(NotificationsProvider);
      expect(notificationsShell.Notifications).toBe(NotificationCenter);
    });

    it("still adds its settings tab", () => {
      expect(notificationsShell.settings).toEqual([
        expect.objectContaining({ id: "notifications", href: "/settings/notifications" }),
      ]);
    });
  });
});

describe("notification panel", () => {
  describe("the header", () => {
    it("names the panel with a second-level heading, which names the dialog", () => {
      const html = panel();
      const [heading = ""] = elements(html, "h2");

      expect(textOf(heading)).toBe("Notifications");
      expect(attribute(startTags(heading, "h2")[0] ?? "", "id")).toBe("notifications-title");
    });

    it("is as tall with the button as without it, so that the title does not jump", () => {
      for (const hasUnread of [true, false]) {
        const header = startTags(panel({ hasUnread }), "div")[0] ?? "";

        expect(decodedClassesOf(header)).toEqual(
          expect.arrayContaining(["min-h-13", "items-center", "justify-between", "border-b"]),
        );
      }
    });

    it("offers to mark everything as read, in a ghost button of the small size", () => {
      const tag = buttonSaying(panel(), "Mark all as read");
      const classes = decodedClassesOf(tag);

      expect(tag).not.toBe("");
      expect(attribute(tag, "type")).toBe("button");
      // Ghost has no fill at rest; small is 36 px, with the hit area of 44 px of every button.
      expect(classes).toEqual(expect.arrayContaining(["h-9", "tap-target", "hover:bg-accent"]));
    });

    it("does not offer it when nothing is left to read", () => {
      expect(textOf(panel({ hasUnread: false }))).not.toContain("Mark all as read");
    });

    it("speaks French", () => {
      expect(textOf(panel({}, "fr"))).toContain("Tout marquer comme lu");
    });
  });

  describe("while it loads", () => {
    const html = panel({ list: { status: "loading" } });

    it("draws three rows of skeleton", () => {
      expect(html.split('data-slot="notification-skeleton"')).toHaveLength(4);
    });

    it("says that it loads, to assistive technology only", () => {
      expect(html).toContain('role="status"');
      expect(html).toContain('<span class="sr-only">Loading…</span>');
    });

    it("draws no row and no error", () => {
      expect(html).not.toContain('role="alert"');
      expect(startTags(html, "li")).toHaveLength(0);
    });
  });

  describe("when it could not load", () => {
    const html = panel({ list: { status: "error" } });

    it("says so, as an alert", () => {
      expect(html).toContain('role="alert"');
      expect(textOf(html)).toContain("We couldn't load your notifications.");
    });

    it("offers to retry", () => {
      expect(buttonSaying(html, "Retry")).not.toBe("");
    });

    it("draws no skeleton and no row", () => {
      expect(html).not.toContain("notification-skeleton");
      expect(startTags(html, "li")).toHaveLength(0);
    });

    it("speaks French", () => {
      const french = panel({ list: { status: "error" } }, "fr");

      expect(textOf(french)).toContain("Impossible de charger vos notifications.");
      expect(buttonSaying(french, "Réessayer")).not.toBe("");
    });
  });

  describe("when there is nothing", () => {
    const html = panel({ list: { status: "ready", items: [], refreshing: false }, hasUnread: false });

    it("draws a tile, what it is and what will come", () => {
      expect(html).toContain('data-slot="icon-tile"');
      expect(textOf(html)).toContain("No notifications");
      expect(textOf(html)).toContain("New activity will show up here.");
    });

    it("draws no row, and no way to mark anything", () => {
      expect(startTags(html, "li")).toHaveLength(0);
      expect(textOf(html)).not.toContain("Mark all as read");
    });

    it("speaks French", () => {
      const french = panel({ list: { status: "ready", items: [], refreshing: false }, hasUnread: false }, "fr");

      expect(textOf(french)).toContain("Aucune notification");
      expect(textOf(french)).toContain("Les nouvelles activités s'afficheront ici.");
    });
  });

  describe("when it lists notifications", () => {
    const html = panel();

    it("draws one row, in a list item, for each of them, in the order given", () => {
      expect(startTags(html, "li")).toHaveLength(2);
      expect(html.indexOf("Payment failed")).toBeLessThan(html.indexOf("Welcome aboard"));
    });

    it("is a list for assistive technology, even where the browser drops the bullets", () => {
      expect(attribute(startTags(html, "ul")[0] ?? "", "role")).toBe("list");
    });

    it("marks the unread one only", () => {
      expect(html.split('data-slot="status-dot"')).toHaveLength(2);
    });

    it("tells assistive technology that the list is being read again, and only then", () => {
      const list = (refreshing: boolean) =>
        startTags(panel({ list: { status: "ready", items: ITEMS, refreshing } }), "ul")[0] ?? "";

      expect(attribute(list(true), "aria-busy")).toBe("true");
      expect(attribute(list(false), "aria-busy")).toBeUndefined();
    });

    it("scrolls the list inside the panel, and not the header and the footer with it", () => {
      const scroller = startTags(html, "div").find((tag) =>
        decodedClassesOf(tag).includes("overflow-y-auto"),
      );

      expect(decodedClassesOf(scroller ?? "")).toEqual(
        expect.arrayContaining(["min-h-0", "flex-1", "max-h-112"]),
      );
    });
  });

  describe("the footer", () => {
    it("links to all the notifications, in every state", () => {
      for (const list of [
        { status: "loading" },
        { status: "error" },
        { status: "ready", items: [], refreshing: false },
        { status: "ready", items: ITEMS, refreshing: false },
        { status: "ready", items: ITEMS, refreshing: true },
      ] satisfies NotificationListState[]) {
        const html = panel({ list });
        const link = elements(html, "a").find((candidate) => textOf(candidate) === "View all notifications");

        expect(attribute(startTags(link ?? "", "a")[0] ?? "", "href"), list.status).toBe(
          "/settings/notifications",
        );
      }
    });

    it("speaks French", () => {
      expect(textOf(panel({}, "fr"))).toContain("Voir toutes les notifications");
    });

    it("is a row as tall as a finger", () => {
      const link = elements(panel(), "a")[0] ?? "";

      expect(decodedClassesOf(startTags(link, "a")[0] ?? "")).toContain("min-h-11");
    });
  });
});
