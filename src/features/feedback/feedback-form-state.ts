import { unstable_rethrow } from "next/navigation";
import { useReducer } from "react";
import { reportHandledError } from "@/shared/utils/report-error";

// What the feedback dialog holds while it is open, and what happens to it when
// the feedback is sent. The state and the rules are plain values and functions,
// so that a send that fails is tested with a server that refuses; `useFeedbackForm`
// is the thin part that gives them to a component.

/** The most a message can be: the server refuses a longer one (`submitFeedbackSchema` in actions.ts). */
export const MESSAGE_MAX_LENGTH = 5000;

export interface FeedbackFormState {
  type: string;
  message: string;
  /** A send is running: the button waits, and a second press does nothing. */
  sending: boolean;
  /** The last send was refused: what was written is kept, and the dialog says so. */
  failed: boolean;
}

export const INITIAL_FEEDBACK_FORM: FeedbackFormState = {
  type: "bug",
  message: "",
  sending: false,
  failed: false,
};

export type FeedbackFormAction =
  | { kind: "type"; type: string }
  | { kind: "message"; message: string }
  | { kind: "send" }
  | { kind: "sent" }
  | { kind: "refused" };

export function feedbackFormReducer(
  state: FeedbackFormState,
  action: FeedbackFormAction,
): FeedbackFormState {
  switch (action.kind) {
    case "type":
      return { ...state, type: action.type };
    // Writing again is trying again: the refusal of the last send is no longer news.
    case "message":
      return { ...state, message: action.message, failed: false };
    case "send":
      return { ...state, sending: true, failed: false };
    case "sent":
      return INITIAL_FEEDBACK_FORM;
    case "refused":
      return { ...state, sending: false, failed: true };
  }
}

/** Whether pressing "Send" does something: there is something written, and a send is not already running. */
export function canSend(state: FeedbackFormState): boolean {
  return state.message.trim() !== "" && !state.sending;
}

/**
 * Sends the feedback with `submit` and tells the form how it went, and says
 * whether it was sent. A server that refuses (the session is gone, the rate
 * limit, a message that is too long, no network) is an outcome and not an
 * exception that escapes: the form keeps what was written, gives the button
 * back and says so, so that nothing is lost and nothing is left waiting. It is
 * handled, not hidden: the error reporter of the app still hears it.
 */
export async function sendFeedback(
  submit: () => Promise<unknown>,
  dispatch: (action: FeedbackFormAction) => void,
): Promise<boolean> {
  dispatch({ kind: "send" });

  try {
    await submit();
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    dispatch({ kind: "refused" });
    return false;
  }

  dispatch({ kind: "sent" });
  return true;
}

interface UseFeedbackFormOptions {
  /** Sends the feedback the form holds. It rejects when the server refuses. */
  submit: (form: FeedbackFormState) => Promise<unknown>;
  /** Called once the feedback is sent. */
  onSent: () => void;
}

export function useFeedbackForm({ submit, onSent }: UseFeedbackFormOptions) {
  const [form, dispatch] = useReducer(feedbackFormReducer, INITIAL_FEEDBACK_FORM);

  return {
    form,
    setType: (type: string) => dispatch({ kind: "type", type }),
    setMessage: (message: string) => dispatch({ kind: "message", message }),
    send: async () => {
      if (!canSend(form)) {
        return;
      }

      if (await sendFeedback(() => submit(form), dispatch)) {
        onSent();
      }
    },
  };
}
