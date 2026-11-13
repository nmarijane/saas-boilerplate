"use client";

import type { FlowMessageKey, FlowResult } from "../auth-flows";
import { useCallback, useRef, useState } from "react";

interface UseAuthSubmitOptions {
  /** A failure to tell from the first draw: what a provider brought the person back to the page with. Typing or sending forgets it, as it forgets any other. */
  initialFailure?: FlowMessageKey | null;
  /**
   * Keeps `pending` after a success. The browser is leaving (to the app, or to
   * a provider), and a control that was let go could be pressed again: the
   * button keeps loading until the page has gone.
   */
  holdAfterSuccess?: boolean;
}

// What the forms of the sign-in pages share when they send: one send at a time,
// whether it is running (`pending`, which the button shows by loading and the
// fields by being read-only) and what the server refused with (`failure`, a key
// of the message files that the form tells in an alert). A ref, not the state,
// refuses a second send: two events can come before the state has been drawn.
// A send starts by forgetting what the last one said, and typing is another try:
// `clearFailure` is what a field calls when it changes. The settings forms have
// their own copies of this and do not use it yet.
export function useAuthSubmit({ holdAfterSuccess = false, initialFailure = null }: UseAuthSubmitOptions = {}) {
  const sending = useRef(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<FlowMessageKey | null>(initialFailure);

  /** Lets go: the next send is allowed, and the button stops loading. */
  const release = useCallback(() => {
    sending.current = false;
    setPending(false);
  }, []);

  const clearFailure = useCallback(() => setFailure(null), []);

  /**
   * Runs a flow, unless one is running. When it has gone through, `onSuccess`
   * runs (and the send is let go first, unless it is held); when it has not,
   * the send is let go at once and the message of its failure is told.
   */
  const run = async (flow: () => Promise<FlowResult>, onSuccess: () => void) => {
    if (sending.current) {
      return;
    }

    sending.current = true;
    setPending(true);
    setFailure(null);
    const result = await flow();
    if (!result.ok) {
      release();
      setFailure(result.messageKey);
      return;
    }

    if (!holdAfterSuccess) {
      release();
    }
    onSuccess();
  };

  return { pending, failure, run, release, clearFailure };
}
