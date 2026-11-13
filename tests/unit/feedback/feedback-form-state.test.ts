import type { FeedbackFormAction, FeedbackFormState } from "@/features/feedback/feedback-form-state";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canSend,
  INITIAL_FEEDBACK_FORM,
  MESSAGE_MAX_LENGTH,
  feedbackFormReducer as reduce,
  sendFeedback,
} from "@/features/feedback/feedback-form-state";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

const WRITTEN: FeedbackFormState = {
  type: "feature",
  message: "Please add a dark mode.",
  sending: false,
  failed: false,
};

describe("the state of the feedback form", () => {
  it("starts as a bug report with nothing written, at rest", () => {
    expect(INITIAL_FEEDBACK_FORM).toEqual({ type: "bug", message: "", sending: false, failed: false });
  });

  it("takes the kind and the message as they are chosen and written", () => {
    expect(reduce(INITIAL_FEEDBACK_FORM, { kind: "type", type: "other" }).type).toBe("other");
    expect(reduce(INITIAL_FEEDBACK_FORM, { kind: "message", message: "Hello" }).message).toBe("Hello");
  });

  it("starts a send: the form waits, and the refusal of the last one is no longer news", () => {
    const refused: FeedbackFormState = { ...WRITTEN, failed: true };

    expect(reduce(refused, { kind: "send" })).toEqual({ ...WRITTEN, sending: true, failed: false });
  });

  it("forgets everything once the feedback is sent", () => {
    expect(reduce({ ...WRITTEN, sending: true }, { kind: "sent" })).toEqual(INITIAL_FEEDBACK_FORM);
  });

  it("keeps what was written when the send is refused, and says so", () => {
    expect(reduce({ ...WRITTEN, sending: true }, { kind: "refused" })).toEqual({
      ...WRITTEN,
      sending: false,
      failed: true,
    });
  });

  it("takes the refusal away as soon as the message is written again: it is another try", () => {
    const refused: FeedbackFormState = { ...WRITTEN, failed: true };

    expect(reduce(refused, { kind: "message", message: `${WRITTEN.message} Thanks.` }).failed).toBe(false);
  });

  it("keeps the refusal when only the kind changes", () => {
    expect(reduce({ ...WRITTEN, failed: true }, { kind: "type", type: "bug" }).failed).toBe(true);
  });
});

describe("canSend", () => {
  it("is false until something is written, whitespace aside", () => {
    expect(canSend(INITIAL_FEEDBACK_FORM)).toBe(false);
    expect(canSend({ ...INITIAL_FEEDBACK_FORM, message: "  \n\t " })).toBe(false);
    expect(canSend(WRITTEN)).toBe(true);
  });

  it("is false while a send runs: a second press sends nothing", () => {
    expect(canSend({ ...WRITTEN, sending: true })).toBe(false);
  });

  it("is true again once a send is refused: the button is back, with the message in the field", () => {
    expect(canSend(reduce({ ...WRITTEN, sending: true }, { kind: "refused" }))).toBe(true);
  });
});

describe("sendFeedback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A form that applies the actions it is sent, and remembers them. */
  function form(start: FeedbackFormState = WRITTEN) {
    let state = start;
    const actions: FeedbackFormAction["kind"][] = [];
    return {
      dispatch: (action: FeedbackFormAction) => {
        actions.push(action.kind);
        state = reduce(state, action);
      },
      actions,
      state: () => state,
    };
  }

  describe("when the server takes the feedback", () => {
    it("says it was sent, and the form starts afresh", async () => {
      const f = form();
      const submit = vi.fn().mockResolvedValue({ id: "fb_1" });

      expect(await sendFeedback(submit, f.dispatch)).toBe(true);

      expect(submit).toHaveBeenCalledOnce();
      expect(f.actions).toEqual(["send", "sent"]);
      expect(f.state()).toEqual(INITIAL_FEEDBACK_FORM);
    });
  });

  describe("when the server refuses it: the session is gone, the rate limit, a message too long, no network", () => {
    it("keeps the dialog as it was: the message is kept, the button is back, and the error is shown", async () => {
      const f = form();

      expect(await sendFeedback(() => Promise.reject(new Error("Too many requests")), f.dispatch)).toBe(false);

      expect(f.actions).toEqual(["send", "refused"]);
      expect(f.state()).toEqual({ ...WRITTEN, sending: false, failed: true });
      expect(canSend(f.state())).toBe(true);
    });

    it("tells the error reporter: handled, not hidden", async () => {
      const report = vi.fn();
      vi.stubGlobal("reportError", report);
      const failure = new Error("Failed to fetch");

      await sendFeedback(() => Promise.reject(failure), form().dispatch);

      expect(report).toHaveBeenCalledExactlyOnceWith(failure);
    });

    it("never rejects, so that the form is never left waiting", async () => {
      await expect(
        sendFeedback(() => Promise.reject(new TypeError("Failed to fetch")), form().dispatch),
      ).resolves.toBe(false);
    });

    it("can be tried again, and then it is sent", async () => {
      const f = form();
      await sendFeedback(() => Promise.reject(new Error("offline")), f.dispatch);

      expect(await sendFeedback(async () => ({ id: "fb_2" }), f.dispatch)).toBe(true);

      expect(f.actions).toEqual(["send", "refused", "send", "sent"]);
      expect(f.state()).toEqual(INITIAL_FEEDBACK_FORM);
    });
  });

  it("makes the form wait while the server answers", async () => {
    const f = form();
    let answer: () => void = () => {};

    const sending = sendFeedback(
      () => new Promise<void>((resolve) => {
        answer = resolve;
      }),
      f.dispatch,
    );

    expect(f.state().sending).toBe(true);
    expect(canSend(f.state())).toBe(false);

    answer();
    await sending;
    expect(f.state().sending).toBe(false);
  });
});

describe("the length of a message", () => {
  it("is the one the server accepts, so that a message that fits the field is not refused for its length", () => {
    const actions = readFileSync(resolve(import.meta.dirname, "../../../src/features/feedback/actions.ts"), "utf-8");
    const limit = /message:\s*z\.string\(\)\.min\(1\)\.max\((\d+)\)/.exec(actions)?.[1];

    expect(limit).toBeDefined();
    expect(MESSAGE_MAX_LENGTH).toBe(Number(limit));
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone: a feedback is sent by someone who is signed in). A dialog that took one for a refusal would flash "your feedback
// was not sent" while the page changes under it, and the error reporter would hear of it.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  it("is handed on by the feedback dialog: the form is not told that the send was refused", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    const dispatch = vi.fn();

    const outcome = await outcomeOf(
      sendFeedback(async () => {
        throw framework;
      }, dispatch),
    );

    expect(outcome).toBe(framework);
    // It was sending, and was never told it was refused: the page is on its way elsewhere
    expect(dispatch.mock.calls.map(([action]) => (action as FeedbackFormAction).kind)).toEqual(["send"]);
    expect(reported).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
