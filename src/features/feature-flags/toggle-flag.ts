import { unstable_rethrow } from "next/navigation";
import { reportHandledError } from "@/shared/utils/report-error";

/** Turns a flag on or off on the server: it rejects when the server did not do it. */
export type ToggleFlag = (flagId: string, enabled: boolean) => Promise<unknown>;

/**
 * Turns a flag on or off, and answers whether the server did it. A refusal and a
 * call that fails outright are both "no": the row puts the switch back where it
 * was, and says so. The call that fails is handled, not hidden: the error
 * reporter of the app still hears it. The errors Next throws to send the person
 * elsewhere (the session is gone) are handed on.
 */
export async function toggleFlagFlow(toggle: ToggleFlag, input: { flagId: string; enabled: boolean }): Promise<boolean> {
  try {
    await toggle(input.flagId, input.enabled);
    return true;
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    return false;
  }
}
