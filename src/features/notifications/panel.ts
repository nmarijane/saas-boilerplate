import type { NotificationItem } from "./list-state";
import { unstable_rethrow } from "next/navigation";

// What the panel does when something is opened in it, as plain functions with
// the outside handed in, so that the policy is tested with a server that
// refuses and a router that goes nowhere.

interface OpenNotificationDeps {
  /** Tells the server the notification is read, and settles the count. It rejects when the server refuses. */
  markRead: (id: string) => Promise<void>;
  /** Goes where the notification points, and says whether it went anywhere (`followNotification`). It rejects when its workspace cannot be opened. */
  follow: (item: NotificationItem) => boolean | Promise<boolean>;
  /** The server was told: the list shows the notification as read. */
  onMarked: (id: string) => void;
  /** Hears an error that was handled: handled is not hidden. */
  report: (error: unknown) => void;
  /** Tells the person that their press did nothing: with no page opening, nothing else would. */
  warn: () => void;
  /**
   * The notifications that are being opened, kept by the component that draws
   * the rows: a second press on a notification whose opening is not over is
   * ignored, so that one notification takes one off the count, not two, and goes
   * to its page once.
   */
  opening: Set<string>;
}

/**
 * Opens a notification: marks it read if it is not, then goes where it points.
 * The page waits for the one call that tells the server, and for nothing else:
 * the count is settled behind.
 *
 * A server that refuses does not stop the link: the person asked to go there,
 * and the error is reported. But when the press leads nowhere (no link, or one
 * that is not followed) and the notification could not be marked, the person
 * would see nothing happen, and is told; so are they when its page could not be
 * reached (its workspace could not be opened), and that is reported. It never
 * rejects, but for the errors of Next (a redirect, a not found), which are not
 * its to tell and are handed on.
 *
 * A press on a notification that is being opened is ignored (`opening`): what
 * it did, the first press did.
 */
export async function openNotification(
  item: NotificationItem,
  { markRead, follow, onMarked, report, warn, opening }: OpenNotificationDeps,
): Promise<{ marked: boolean; followed: boolean }> {
  if (opening.has(item.id)) {
    return { marked: false, followed: false };
  }

  opening.add(item.id);
  try {
    let refused = false;

    if (!item.read) {
      try {
        await markRead(item.id);
      } catch (error) {
        unstable_rethrow(error);
        refused = true;
        report(error);
      }
    }

    const marked = !item.read && !refused;
    if (marked) {
      onMarked(item.id);
    }

    let followed = false;
    try {
      followed = await follow(item);
    } catch (error) {
      unstable_rethrow(error);
      report(error);
      warn();
      return { marked, followed: false };
    }

    if (refused && !followed) {
      warn();
    }

    return { marked, followed };
  } finally {
    opening.delete(item.id);
  }
}

/**
 * Puts the focus on the panel when it opens, in place of the first button
 * Radix would pick (it takes the first control that is not a link, which is
 * "Mark all as read": a person who opens the panel to read would land on an
 * action that changes everything). The panel is a place the focus can rest,
 * and the first Tab goes to the first control from there. With no panel to
 * focus the focus is left to Radix.
 */
export function focusPanel(
  event: Pick<Event, "preventDefault">,
  panel: Pick<HTMLElement, "focus"> | null,
): void {
  if (panel === null) {
    return;
  }

  event.preventDefault();
  panel.focus();
}
