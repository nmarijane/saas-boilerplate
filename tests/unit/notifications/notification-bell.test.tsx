import { describe, expect, it } from "vitest";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import {
  attribute,
  decodedClassesOf,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/** The start tag of the dot, or "" when there is none. */
function dotOf(html: string): string {
  return (
    startTags(html, "span").find((tag) => tag.includes('data-slot="bell-dot"')) ??
    ""
  );
}

/** The one button of the bell. */
function buttonOf(html: string): string {
  return startTags(html, "button")[0] ?? "";
}

describe("notification bell", () => {
  it("names the bell with its count, and draws a dot only when something is unread", () => {
    const none = renderWithIntl(<NotificationBell count={0} />);
    expect(attribute(startTags(none, "button")[0] ?? "", "aria-label")).toBe(
      "Notifications",
    );
    expect(none).not.toContain('data-slot="bell-dot"');

    const two = renderWithIntl(<NotificationBell count={2} />);
    expect(attribute(startTags(two, "button")[0] ?? "", "aria-label")).toBe(
      "Notifications: 2 unread",
    );
    expect(two).toContain('data-slot="bell-dot"');
  });

  it("speaks French, in the singular and in the plural", () => {
    const label = (count: number) =>
      attribute(
        buttonOf(renderWithIntl(<NotificationBell count={count} />, "fr")),
        "aria-label",
      );

    expect(label(0)).toBe("Notifications");
    expect(label(1)).toBe("Notifications : 1 non lue");
    expect(label(2)).toBe("Notifications : 2 non lues");
  });

  it("draws no number: the name carries the count, the dot only says there is something to see", () => {
    const html = renderWithIntl(<NotificationBell count={12} />);

    expect(textOf(html)).toBe("");
    expect(attribute(buttonOf(html), "aria-label")).toBe(
      "Notifications: 12 unread",
    );
  });

  it("hides the dot from assistive technology, which has the name", () => {
    expect(attribute(dotOf(renderWithIntl(<NotificationBell count={3} />)), "aria-hidden")).toBe("true");
  });

  it("draws the dot 8 px wide in the brand color, ringed with the background of the sidebar", () => {
    const classes = decodedClassesOf(dotOf(renderWithIntl(<NotificationBell count={3} />)));

    expect(classes).toEqual(
      expect.arrayContaining(["size-2", "rounded-full", "bg-brand", "ring-2", "ring-sidebar"]),
    );
  });

  it("keeps the dot visible in forced-colors mode, which drops every background but a system color", () => {
    const classes = decodedClassesOf(dotOf(renderWithIntl(<NotificationBell count={3} />)));

    expect(classes).toContain("forced-colors:bg-[color:Highlight]");
  });

  it("is an icon button of 44 px, a real button that submits nothing", () => {
    const tag = buttonOf(renderWithIntl(<NotificationBell count={0} />));
    const classes = decodedClassesOf(tag);

    expect(classes).toContain("size-11");
    expect(classes).not.toContain("size-10");
    expect(attribute(tag, "type")).toBe("button");
  });

  it("draws the bell icon, hidden from assistive technology", () => {
    const html = renderWithIntl(<NotificationBell count={0} />);

    expect(html).toContain("lucide-bell");
    expect(attribute(startTags(html, "svg")[0] ?? "", "aria-hidden")).toBe("true");
  });

  it("keeps what a popover gives its trigger, and the classes of the caller", () => {
    const tag = buttonOf(
      renderWithIntl(
        <NotificationBell
          count={1}
          aria-haspopup="dialog"
          aria-expanded={false}
          data-state="closed"
          className="shrink-0"
        />,
      ),
    );

    expect(attribute(tag, "aria-haspopup")).toBe("dialog");
    expect(attribute(tag, "aria-expanded")).toBe("false");
    expect(attribute(tag, "data-state")).toBe("closed");
    expect(decodedClassesOf(tag)).toEqual(expect.arrayContaining(["shrink-0", "size-11"]));
  });
});
