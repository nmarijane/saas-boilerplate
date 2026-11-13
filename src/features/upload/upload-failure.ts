import { messageKeyOf, refusalOf } from "./refusals";

/**
 * An upload that did not go through: the status of the answer (0 when there was
 * none, the network was down) and its body, as JSON when it was one.
 */
export class UploadFailed extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Upload failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * What the person is told when an upload failed, in the words of the page
 * (`translate` is the translator of the message files). A file that
 * `POST /api/upload` refuses comes as a 400 with the code that says why and the
 * values of its message (`refusals.ts`), and is told as that message. Any other
 * answer, and no answer at all, is the generic failure of the message files.
 */
export function failureMessage(
  error: unknown,
  translate: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (error instanceof UploadFailed && error.status === 400) {
    const refusal = refusalOf(error.body);
    if (refusal) {
      return translate(messageKeyOf(refusal.code), refusal.values);
    }
  }

  return translate("upload.failed");
}
