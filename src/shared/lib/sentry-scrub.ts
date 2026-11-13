// The error reporter sends the address of the page with each event and each
// breadcrumb. The link of the reset e-mail holds a token in its address
// (`?token=`), and the server of Better Auth meets it in the path of its own
// address (`/api/auth/reset-password/<token>`) and, in the message of a database
// error that carries its parameters, as the identifier it looks the token up by
// (`reset-password:<token>`): it is a password for an hour. It is filtered out of
// everything that is sent, whatever field the SDK puts it in (the request, the
// navigation and fetch breadcrumbs, the headers, the transaction and its spans).

// An address can be carried inside another one (a `callbackUrl`, a logged `encodeURIComponent(url)`): its `/`, `:`, `?`,
// `=`, `&` and `#` are then written %2F, %3A, %3F, %3D, %26 and %23, in either case of the hex digits, so each form is
// read in both spellings (the `i` flag), and a value ends at the encoded `&` or `#` as it does at the plain one.

// A parameter called exactly `token`: at the start of a string (a `query_string`), or after `?`, `&` or `#`
const TOKEN_PARAMETER = /(^|[?&#]|%3f|%26|%23)(token(?:=|%3d))(?:(?!%26|%23)[^&#\s"'])*/gi;
// The segment after `/reset-password/`, up to the next `/`, `?`, `#` or the end of the address (a slash alone has none)
const TOKEN_SEGMENT = /((?:\/|%2f)reset-password(?:\/|%2f))(?:(?!%2f|%3f|%23)[^/?#\s"'])+/gi;
// The identifier Better Auth looks a reset token up by, up to the end of the word
const TOKEN_IDENTIFIER = /(reset-password(?::|%3a))(?:(?!%26|%23)[^\s"',&#])+/gi;
const FILTERED = "[Filtered]";

function scrub(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll(TOKEN_PARAMETER, `$1$2${FILTERED}`)
      .replaceAll(TOKEN_SEGMENT, `$1${FILTERED}`)
      .replaceAll(TOKEN_IDENTIFIER, `$1${FILTERED}`);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) {
      copy.push(scrub(item, seen));
    }

    return copy;
  }

  // Only plain data is copied: a class instance (a Date, an Error) is not an event field to read
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) {
    copy[key] = scrub(item, seen);
  }

  return copy;
}

/** A copy of what the reporter is about to send, with the reset token filtered out of its strings, wherever it sits: a `token` parameter, the segment after `/reset-password/`, or `reset-password:<token>`. What it was given is not changed. */
export function scrubTokens<T>(value: T): T {
  return scrub(value, new WeakMap()) as T;
}

/** What a request body can carry that is a secret: the token of the reset link, and the passwords of the forms. */
const SECRET_FIELDS = ["token", "password", "newPassword", "currentPassword"];

/** `data` without the secret fields: an object is copied, a JSON string or a form-encoded one is read and written again, a cut JSON string that names one is dropped, anything else is left. */
function withoutSecrets(data: unknown): unknown {
  if (typeof data === "string") {
    try {
      return JSON.stringify(withoutSecrets(JSON.parse(data)));
    } catch {
      // A body the SDK cut short no longer parses: one that names a secret field is not sent at all
      if (SECRET_FIELDS.some((field) => data.includes(`"${field}"`))) {
        return "[Filtered]";
      }
      if (!data.includes("=") || data.includes("{")) {
        return data;
      }
      const form = new URLSearchParams(data);
      for (const field of SECRET_FIELDS) {
        form.delete(field);
      }

      return form.toString();
    }
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  return Object.fromEntries(Object.entries(data).filter(([key]) => !SECRET_FIELDS.includes(key)));
}

/**
 * The event or transaction the server reporter is about to send, with the secret
 * fields taken out of its request data, whatever the SDK attached (the body of the
 * reset form holds `newPassword` and `token`), and the tokens of its addresses
 * filtered out of every string. The data is an object or a JSON string.
 */
export function scrubServerEvent<T>(event: T): T {
  const request = (event as { request?: { data?: unknown } } | null)?.request;
  if (request && typeof request === "object" && "data" in request) {
    return scrubTokens({ ...event, request: { ...request, data: withoutSecrets(request.data) } });
  }

  return scrubTokens(event);
}
