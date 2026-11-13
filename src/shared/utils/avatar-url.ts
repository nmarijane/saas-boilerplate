/** The longest address an avatar may have. */
const AVATAR_URL_MAX = 2048;

/**
 * Whether a text can be the address of a person's picture: an `https:` address, with no
 * credentials in it. Anything else is refused: `http:` is read and altered on the way,
 * `javascript:` and `data:` are not pictures, and the address is fetched by the browser of
 * everyone who sees the person (members, activity, audit log).
 */
export function isAvatarUrl(value: string): boolean {
  if (value.length > AVATAR_URL_MAX) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}
