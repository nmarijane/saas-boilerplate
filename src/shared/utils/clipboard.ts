/**
 * Puts a text on the clipboard of the person, and says whether it got there.
 * A page that is not in a secure context has no clipboard, and a browser may
 * refuse: both answer "no", which is no error of the app to report, as the
 * person can still select the text and copy it themselves. The clipboard is
 * given, so that a test hands it one that refuses.
 */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator?.clipboard,
): Promise<boolean> {
  if (!clipboard) {
    return false;
  }

  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
