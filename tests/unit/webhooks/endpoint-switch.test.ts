import type { EndpointSwitchAction, EndpointSwitchState } from "@/features/webhooks/endpoint-switch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toggleEndpointFlow } from "@/features/webhooks/endpoint-flows";
import { endpointSwitch, startSwitch } from "@/features/webhooks/endpoint-switch";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

/** Something that happens to the row: the switch is moved, the server answers, or the row is drawn with what the page says. */
type Step = EndpointSwitchAction | { drawn: boolean };

/**
 * What the switch is after these things happen to it, from where the page read the endpoint. A row that is
 * drawn takes what the page says when it is new, which is what the row does as it is drawn (`webhook-list.tsx`):
 * the page says a word that is not the last it said, and the switch is told to read it.
 */
function after(active: boolean, ...steps: Step[]): EndpointSwitchState {
  return steps.reduce<EndpointSwitchState>((state, step) => {
    if ("drawn" in step) {
      return step.drawn === state.page ? state : endpointSwitch(state, { type: "read", active: step.drawn });
    }

    return endpointSwitch(state, step);
  }, startSwitch(active));
}

const ASK_OFF: Step = { type: "ask", active: false };
const ASK_ON: Step = { type: "ask", active: true };
const DONE: Step = { type: "done" };
const REFUSE: Step = { type: "refuse" };

// The row draws `shown` and nothing else. The interface cannot show these rules in Node (its static render
// never draws a second time), so they are a function: the stories watch the row follow them in a browser.
describe("what the switch of an endpoint shows", () => {
  it("starts where the page read the endpoint, and asks nothing", () => {
    expect(startSwitch(true)).toEqual({ shown: true, held: true, page: true, asking: false });
    expect(startSwitch(false)).toEqual({ shown: false, held: false, page: false, asking: false });
  });

  it("moves at once when the person moves it, before the server has answered", () => {
    expect(after(true, ASK_OFF)).toEqual({ shown: false, held: true, page: true, asking: true });
    expect(after(false, ASK_ON)).toEqual({ shown: true, held: false, page: false, asking: true });
  });

  it("stays where the person put it once the server has done it, and that is now what the server holds", () => {
    expect(after(true, ASK_OFF, DONE)).toEqual({ shown: false, held: false, page: true, asking: false });
  });

  // A change that is done does not read the page again: the row is drawn again, with the same word of the
  // page as before, and the switch stays where the person put it. (A switch that took the page's word then
  // would fall back at once, as it did when the word the page said was thought to follow the change.)
  it("stays where the person put it when the row is drawn again after a change that was done, the page not having been read again", () => {
    const state = after(true, ASK_OFF, DONE, { drawn: true });

    expect(state).toEqual({ shown: false, held: false, page: true, asking: false });
    expect(after(true, ASK_OFF, DONE, { drawn: true }, { drawn: true })).toEqual(state);
  });

  it("goes back to where it was when the server did not do it", () => {
    expect(after(true, ASK_OFF, REFUSE)).toEqual({ shown: true, held: true, page: true, asking: false });
    expect(after(false, ASK_ON, REFUSE)).toEqual({ shown: false, held: false, page: false, asking: false });
  });

  it("goes back to where the last change that was done left it, when it is the next one that is refused", () => {
    const state = after(true, ASK_OFF, DONE, ASK_ON, REFUSE);

    // The server holds the first change: the switch is off, as it was left, and not as the page first read it
    expect(state).toEqual({ shown: false, held: false, page: true, asking: false });
  });

  // The page is read again when something else is done (a row goes, an endpoint is added, another tab changes one)
  it("follows the page when it says something new of the endpoint, and nothing is asked", () => {
    expect(after(true, { drawn: false })).toEqual({ shown: false, held: false, page: false, asking: false });
    expect(after(false, { drawn: true })).toEqual({ shown: true, held: true, page: true, asking: false });
  });

  it("follows the page again after it has followed it, each time it says something new", () => {
    const state = after(true, { drawn: false }, { drawn: true }, { drawn: false });

    expect(state).toEqual({ shown: false, held: false, page: false, asking: false });
  });

  it("does not move when the page says what it said: drawing the row again changes nothing, and is the same state", () => {
    const start = startSwitch(true);

    expect(endpointSwitch(start, { type: "read", active: true })).toBe(start);
  });

  it("does not move when the page, read again after the person's own change, says what the server now holds", () => {
    const state = after(true, ASK_OFF, DONE, { drawn: false });

    expect(state).toEqual({ shown: false, held: false, page: false, asking: false });
  });

  it("follows the page after the person's own change when another tab has changed the endpoint since", () => {
    // The person turned it off, and the page, read again, said so. Then another tab turned it on, and the
    // page, read again, says that: it is a new word, and the switch takes it
    const state = after(true, ASK_OFF, DONE, { drawn: false }, { drawn: true });

    expect(state).toEqual({ shown: true, held: true, page: true, asking: false });
  });

  it("does not take the switch from the person's hand while their change is on its way", () => {
    const state = after(true, ASK_OFF, { drawn: false });

    // The page spoke while the server was asked: the switch is where the person put it, and the word is kept
    expect(state).toEqual({ shown: false, held: false, page: false, asking: true });
  });

  it("goes back to what the page said while the change was on its way, if the server then refuses it", () => {
    const state = after(true, ASK_OFF, { drawn: false }, REFUSE);

    // The server held the change after all, as the page said: going back to where the person started would contradict it
    expect(state).toEqual({ shown: false, held: false, page: false, asking: false });
  });

  it("is another try once it is answered: the next change is asked as the first was", () => {
    const state = after(true, ASK_OFF, REFUSE, ASK_OFF, DONE);

    expect(state).toEqual({ shown: false, held: false, page: true, asking: false });
  });
});

describe("turning the delivery to an endpoint on and off", () => {
  const toggle = vi.fn();
  const reported = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    toggle.mockResolvedValue(undefined);
    vi.stubGlobal("reportError", reported);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flow = (active: boolean) => toggleEndpointFlow({ toggle }, { endpointId: "e1", orgId: "org_1", active });

  it("asks the server for the endpoint by its own id, in the workspace, and says it was done", async () => {
    await expect(flow(false)).resolves.toBe(true);

    expect(toggle).toHaveBeenCalledExactlyOnceWith("e1", "org_1", false);
    await flow(true);
    expect(toggle).toHaveBeenLastCalledWith("e1", "org_1", true);
  });

  it("says it was not done, and tells the error reporter, when the call does not come back", async () => {
    toggle.mockRejectedValue(new Error("offline"));

    await expect(flow(false)).resolves.toBe(false);

    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "offline" }));
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone, the role is too low): the row must not put the switch back and say it was refused.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  it("is handed on by the call that turns an endpoint on or off, and not reported", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);

    const outcome = await outcomeOf(
      toggleEndpointFlow({ toggle: vi.fn().mockRejectedValue(framework) }, { endpointId: "e1", orgId: "org_1", active: false }),
    );

    expect(outcome).toBe(framework);
    expect(reported).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
