// What the switch of an endpoint shows, as a plain function of what happens to
// it: the person moves it, the server answers, the page is read again. The row
// holds it with a reducer and draws `shown`, so that the rules are a function a
// test calls (the interface cannot show them in Node: its static render never
// draws a second time).

export interface EndpointSwitchState {
  /** What the switch shows. */
  shown: boolean;
  /** What the server is known to hold: the last word of the page, or the change that it did. The switch goes back to it when the server refuses a change. */
  held: boolean;
  /** The last word the page said of the endpoint (the `active` of the row), to tell when it says something new: a change that is done does not move it, as the page is not read again for it. */
  page: boolean;
  /** The server is being asked: what the page says does not take the switch from the person's hand. */
  asking: boolean;
}

export type EndpointSwitchAction =
  /** The page was read again, and says `active` of the endpoint. */
  | { type: "read"; active: boolean }
  /** The person moved the switch to `active`: it shows it at once, and the server is asked. */
  | { type: "ask"; active: boolean }
  /** The server did it: what the switch shows is what the server holds. */
  | { type: "done" }
  /** The server did not do it: the switch goes back to what the server is known to hold. */
  | { type: "refuse" };

/** The state of a switch that starts where the page read the endpoint. */
export function startSwitch(active: boolean): EndpointSwitchState {
  return { shown: active, held: active, page: active, asking: false };
}

/**
 * The rules of the switch. A page that says something new of the endpoint is
 * taken by the switch (a change made elsewhere shows when the page is read
 * again), unless the person's own change is on its way: it is not taken from
 * their hand, and what the page said is remembered as what the server holds. A
 * page that says what it said before changes nothing, so that drawing the row
 * again moves nothing, and neither does a change that was done: the page is not
 * read again for it, and still says what it said. Once the server has done a
 * change, it is what the server holds; once it has refused one, the switch goes
 * back to what the server is known to hold, which is where it was.
 */
export function endpointSwitch(
  state: EndpointSwitchState,
  action: EndpointSwitchAction,
): EndpointSwitchState {
  switch (action.type) {
    case "read":
      if (action.active === state.page) {
        return state;
      }
      return {
        shown: state.asking ? state.shown : action.active,
        held: action.active,
        page: action.active,
        asking: state.asking,
      };
    case "ask":
      return { ...state, shown: action.active, asking: true };
    case "done":
      return { ...state, held: state.shown, asking: false };
    case "refuse":
      return { ...state, shown: state.held, asking: false };
  }
}
