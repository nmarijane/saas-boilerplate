import type { ComponentProps } from "react";
import type { NotificationItem } from "@/features/notifications/list-state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationRow } from "@/features/notifications/components/notification-row";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

const NOW = new Date("2026-11-03T12:00:00.000Z");

const NOTIFICATION = {
  id: "notif_1",
  title: "Payment failed",
  body: "We could not charge the card ending in 4242.",
  read: false,
  type: "warning",
  link: "/settings/billing",
  createdAt: "2026-11-03T10:00:00.000Z",
};

// The row says how long ago it came, and the clock is the machine's: only the
// Date is held still, so that "2 hours ago" is the same on every run.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function render(
  notification: Partial<NotificationItem> = {},
  locale: "en" | "fr" = "en",
  props: Partial<ComponentProps<typeof NotificationRow>> = {},
): string {
  return renderWithIntl(
    <NotificationRow
      notification={{ ...NOTIFICATION, ...notification }}
      onOpen={() => {}}
      {...props}
    />,
    locale,
  );
}

describe("notification row", () => {
  it("marks an unread row", () => {
    const unread = render({ read: false });
    expect(textOf(unread)).toContain("Unread");
    expect(unread).toContain('data-slot="status-dot"');

    const read = render({ read: true });
    expect(textOf(read)).not.toContain("Unread");
    expect(read).not.toContain('data-slot="status-dot"');
  });

  it("says unread in words only assistive technology reads: the dot is the sighted way of saying it", () => {
    const html = render({ read: false });

    expect(decodedClassesOf(tagSaying(html, "span", "Unread"))).toContain("sr-only");
    expect(html).toContain("bg-brand");
  });

  it("speaks French", () => {
    expect(textOf(render({ read: false }, "fr"))).toContain("Non lue");
  });

  // A notification that an event made is stored as its type and its values, not as
  // sentences: the row says it in the language of the person who reads it, as the
  // activity of the home does. The stored text is only for a type with no message.
  describe("the words of a notification", () => {
    const failed = { type: "payment.failed", title: null, body: null, values: { workspace: "Acme" } };

    it("are those of its type, in English for an English reader", () => {
      const text = textOf(render(failed));

      expect(text).toContain("Payment failed");
      expect(text).toContain("Acme");
    });

    it("are those of its type, in French for a French reader", () => {
      const text = textOf(render(failed, "fr"));

      expect(text).toContain("Échec du paiement");
      expect(text).toContain("Acme");
      expect(text).not.toContain("Payment failed");
    });

    it("name what the event names, in the reader's language", () => {
      const updated = { type: "project.updated", title: null, body: null, values: { actor: "Léa Martin", name: "Atlas" } };

      expect(textOf(render(updated))).toContain("Léa Martin made changes to Atlas.");
      expect(textOf(render(updated, "fr"))).toContain("Léa Martin a modifié Atlas.");
    });

    it("are the stored ones for a type that has no message, as a job or a webhook may write", () => {
      const text = textOf(render({ type: "warning", title: "Disk almost full", body: "Clean up the exports." }, "fr"));

      expect(text).toContain("Disk almost full");
      expect(text).toContain("Clean up the exports.");
    });
  });

  it("gives the title the medium weight and the body the muted text, on two lines at most", () => {
    const html = render();

    expect(decodedClassesOf(tagSaying(html, "span", NOTIFICATION.title))).toContain("font-medium");

    const body = tagSaying(html, "span", NOTIFICATION.body);
    expect(decodedClassesOf(body)).toEqual(
      expect.arrayContaining(["text-meta", "text-ink-muted", "line-clamp-2"]),
    );
  });

  it("leaves the display of the body to the clamp: a `block` next to it would win, and the body would run on", () => {
    const body = decodedClassesOf(tagSaying(render(), "span", NOTIFICATION.body));

    expect(body).toContain("line-clamp-2");
    for (const display of ["block", "flex", "inline", "inline-block", "grid", "contents"]) {
      expect(body, display).not.toContain(display);
    }
  });

  it("wraps a long unbroken word of the title or of the body instead of overflowing the row", () => {
    const title = "x".repeat(80);
    const body = "y".repeat(80);
    const html = render({ title, body });

    expect(decodedClassesOf(tagSaying(html, "span", title))).toContain("wrap-break-word");
    expect(decodedClassesOf(tagSaying(html, "span", body))).toContain("wrap-break-word");
  });

  it("tells when it came, in a time element that carries the moment", () => {
    const [time = ""] = elements(render(), "time");

    expect(attribute(startTags(time, "time")[0] ?? "", "dateTime")).toBe(
      NOTIFICATION.createdAt,
    );
    expect(textOf(time)).toBe("2 hours ago");
  });

  it("tells it in French", () => {
    expect(textOf(elements(render({}, "fr"), "time")[0] ?? "")).toBe("il y a 2 heures");
  });

  it("tells a notification that came a moment ago, and never one from the future when the clock of the person is behind the server's", () => {
    const minutes = (count: number) =>
      textOf(
        elements(
          render({ createdAt: new Date(NOW.getTime() + count * 60_000).toISOString() }),
          "time",
        )[0] ?? "",
      );

    expect(minutes(5)).toBe("now");
    expect(textOf(elements(render({ createdAt: "2026-11-03T11:59:30.000Z" }), "time")[0] ?? "")).toBe("30 seconds ago");
  });

  it("is a button that opens the notification, as tall as a finger and as wide as the list", () => {
    const tag = startTags(render(), "button")[0] ?? "";
    const classes = decodedClassesOf(tag);

    expect(attribute(tag, "type")).toBe("button");
    expect(classes).toEqual(expect.arrayContaining(["min-h-11", "w-full", "text-left"]));
  });

  it("keeps an inset focus ring: the list scrolls, and would cut a ring drawn outside the row", () => {
    const classes = decodedClassesOf(startTags(render(), "button")[0] ?? "");

    expect(classes).toEqual(
      expect.arrayContaining([
        "focus-visible:outline-2",
        "focus-visible:-outline-offset-2",
        "focus-visible:shadow-none",
      ]),
    );
  });

  it("holds the room of the dot in a row that is read, so that the titles line up", () => {
    const widthOfLead = (html: string) =>
      decodedClassesOf(startTags(html, "span")[0] ?? "");

    expect(widthOfLead(render({ read: true }))).toEqual(widthOfLead(render({ read: false })));
    expect(widthOfLead(render({ read: true }))).toContain("w-2");
  });
});
