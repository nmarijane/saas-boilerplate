import { describe, expect, it, vi } from "vitest";
import { returnFocus } from "@/shared/components/shell/focus-return";

// What Radix sends when a sheet has closed: a cancelable event, on which it waits
// for `preventDefault` to know that someone else has dealt with the focus.
const closeEvent = () =>
  new Event("focusScope.autoFocusOnUnmount", { cancelable: true });

const VIEWPORT = { width: 390, height: 844 };

/** The control that opened the drawer, at a place of the screen: a spy for the focus, and the box the browser would measure. */
function openerAt(box: { top: number; right: number; bottom: number; left: number }) {
  return { focus: vi.fn(), getBoundingClientRect: () => box };
}

/** A sticky tab of the bottom bar: the whole of it is on screen, where the bar is stuck. */
const ON_SCREEN = { top: 783, right: 390, bottom: 844, left: 312 };

describe("returnFocus", () => {
  it("gives the focus back to the control that opened the drawer", () => {
    const opener = openerAt(ON_SCREEN);

    returnFocus(closeEvent(), opener, false, VIEWPORT);

    expect(opener.focus).toHaveBeenCalledOnce();
  });

  // The page does not scroll while the sheet is open, so the control is where the person left it. A plain
  // `focus()` on a sticky control makes Chromium scroll the document to where the control sits in the flow,
  // which moved the page by hundreds of pixels each time the sheet closed.
  it("gives it without scrolling the page when the control is on screen: the page stays where it was", () => {
    const opener = openerAt(ON_SCREEN);

    returnFocus(closeEvent(), opener, false, VIEWPORT);

    expect(opener.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  it.each([
    ["below the screen", { top: 900, right: 390, bottom: 961, left: 312 }],
    ["above the screen", { top: -80, right: 390, bottom: -19, left: 312 }],
    ["right of the screen", { top: 783, right: 800, bottom: 844, left: 400 }],
    ["left of the screen", { top: 783, right: -10, bottom: 844, left: -90 }],
    ["cut by the edge of the screen", { top: 820, right: 390, bottom: 881, left: 312 }],
  ])("lets the browser bring the control into view when it is %s: the focus must not land where nobody sees it", (_, box) => {
    const opener = openerAt(box);

    returnFocus(closeEvent(), opener, false, VIEWPORT);

    expect(opener.focus).toHaveBeenCalledExactlyOnceWith();
  });

  it("takes the measure of the screen it is given: the same box is on screen of a tall phone and off the screen of a short one", () => {
    const box = { top: 783, right: 390, bottom: 844, left: 312 };
    const tall = openerAt(box);
    const short = openerAt(box);

    returnFocus(closeEvent(), tall, false, { width: 390, height: 900 });
    returnFocus(closeEvent(), short, false, { width: 390, height: 800 });

    expect(tall.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(short.focus).toHaveBeenCalledExactlyOnceWith();
  });

  it("cancels what Radix would do, which is to focus a trigger this drawer does not have", () => {
    const event = closeEvent();

    returnFocus(event, openerAt(ON_SCREEN), false, VIEWPORT);

    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the focus alone when the page changed since the drawer opened: the new page owns it", () => {
    const opener = openerAt(ON_SCREEN);
    const event = closeEvent();

    returnFocus(event, opener, true, VIEWPORT);

    expect(opener.focus).not.toHaveBeenCalled();
    // Still cancelled: Radix would put the focus nowhere, and the page decides.
    expect(event.defaultPrevented).toBe(true);
  });

  it("copes with a drawer that nothing known opened", () => {
    const event = closeEvent();

    expect(() => returnFocus(event, null, false, VIEWPORT)).not.toThrow();
    expect(event.defaultPrevented).toBe(true);
  });
});
