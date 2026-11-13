import type { Dispatch, SetStateAction } from "react";

// One cn for the whole app: the one that knows the type scale.
export { cn } from "./cn";

const DIACRITICS_RE = /[\u0300-\u036F]/g;
const NON_ALPHANUMERIC_RE = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHEN_RE = /(^-|-$)/g;
const WHITESPACE_RE = /\s+/;
const LETTER_OR_DIGIT_RE = /[\p{L}\p{N}]/u;

export function generateId() {
  return crypto.randomUUID();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(NON_ALPHANUMERIC_RE, "-")
    .replace(LEADING_TRAILING_HYPHEN_RE, "");
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * The initials of a name: the first letter or digit of each of its first two
 * words that have one, in capitals. A word is what whitespace separates, so a
 * double space is no word; a word with no letter or digit (an emoji, "&")
 * counts for nothing, and a name with none gives "". The letter is a whole
 * character, never half of a surrogate pair. The capitals do not depend on the
 * locale: initials are drawn on the server and again in the browser, and a case
 * map of the locale (Turkish makes "İ" of "i") would draw two different strings.
 */
export function getInitials(name: string): string {
  return name
    .split(WHITESPACE_RE)
    .map((word) => LETTER_OR_DIGIT_RE.exec(word)?.[0])
    .filter((letter) => letter !== undefined)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Text as a search reads it: accents dropped, capitals lowered, so that "Été"
 * and "ete" are one word. The lowering does not depend on the locale: a Turkish
 * runtime would fold "I" to "ı", and what is typed would not find what is there.
 */
function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_RE, "").toLowerCase();
}

/** Whether a text holds what was typed in a search box, ignoring case and accents. Nothing typed matches everything. */
export function matchesSearch(text: string, search: string): boolean {
  return foldForSearch(text).includes(foldForSearch(search.trim()));
}

/**
 * A moment as it is told from `now`: never after it. Whatever stamped it (a
 * database in another time zone, a browser whose clock is a little fast) can
 * run ahead of the clock that tells the time, and something that has just
 * happened must read "now", not "in an hour".
 */
export function notAfter(date: Date, now: Date): Date {
  return date.getTime() > now.getTime() ? new Date(now) : date;
}

/**
 * The setter of one field of a form, that also forgets what the last send said:
 * typing is another try, so the "Saved" status and the error that were told go.
 * `set` is the setter of the state of the field, and `forget` clears the outcome
 * of the last send. Every form of the app that keeps one uses this one.
 */
export function editing<T>(
  set: Dispatch<SetStateAction<T>>,
  forget: () => void,
): (value: T) => void {
  return (value) => {
    set(value);
    forget();
  };
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString();
}
