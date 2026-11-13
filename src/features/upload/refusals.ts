/**
 * Why `POST /api/upload` refuses a file. The route answers a 400 in the shape of
 * its other errors, `{ error, code, status, values }`: `error` is an English
 * sentence, for the clients of the API; `code` says which refusal it is; `values`
 * holds what the message of the locales needs to tell it in the language of the
 * page (`max`, in megabytes, for a file that is too large, and `type` for a type
 * that is not taken). The codes and the messages they are told by are written
 * here, once, for the route that says them and the page that reads them.
 */
const MESSAGE_OF = {
  FILE_TOO_LARGE: "upload.tooLarge",
  FILE_TYPE_NOT_ALLOWED: "upload.typeNotAllowed",
  // The plan's storage is full (`values`: `limit` in megabytes, `plan`): the route answers 402, not 400
  PLAN_LIMIT: "upload.planLimit",
} as const;

export type UploadRefusalCode = keyof typeof MESSAGE_OF;
type UploadMessageKey = (typeof MESSAGE_OF)[UploadRefusalCode];
export type UploadValues = Record<string, string | number>;

/** A file that is refused: why, and what the message that tells it takes. */
export interface UploadRefusal {
  code: UploadRefusalCode;
  values: UploadValues;
}

/** The message of the locales that tells a refusal. */
export function messageKeyOf(code: UploadRefusalCode): UploadMessageKey {
  return MESSAGE_OF[code];
}

function isValues(value: unknown): value is UploadValues {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === "string" || typeof entry === "number")
  );
}

/**
 * The refusal that the body of an answer holds, or null: an answer that is
 * anything else (another error of the route, a body that is no JSON) is no
 * refusal, and is not told as one.
 */
export function refusalOf(body: unknown): UploadRefusal | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { code, values } = body as { code?: unknown; values?: unknown };
  if (typeof code !== "string" || !Object.hasOwn(MESSAGE_OF, code)) {
    return null;
  }

  return { code: code as UploadRefusalCode, values: isValues(values) ? values : {} };
}
