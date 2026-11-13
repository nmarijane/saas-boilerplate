/**
 * Tells the error reporter of the app about an error that was handled (a toast,
 * a message in a field): handled is not hidden, and the reporter still has to
 * hear it. The global handlers of the page, which the reporter listens to, are
 * what `reportError` reaches. There is no such function where there is no window
 * (a run in Node), and then there is nobody to tell.
 */
export function reportHandledError(error: unknown): void {
  if (typeof reportError === "function") {
    reportError(error);
  }
}
