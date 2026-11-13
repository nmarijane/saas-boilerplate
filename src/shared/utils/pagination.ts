// What a list that is read a page at a time takes from its address and from its
// size. Plain, so that a page and a test can both use it.

/**
 * The page an address asks for: a whole number from 1 on, and the first page for
 * anything else (no page, text, zero, a negative number, a number too large to be
 * one). A page that cannot be read must never reach the database as `NaN`.
 */
export function pageFrom(param: string | undefined): number {
  const page = Number.parseInt(param ?? "", 10);

  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** How many pages `total` rows make, in pages of `pageSize`: none for a list with no row. */
export function totalPagesOf(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

/**
 * The page to show: the one asked for, or the last when it is past the end, so
 * that an address that outlived some of the rows draws the end of the list and
 * not an empty page that says "Page 99 of 2". A list with no row has one page,
 * the first, which is empty.
 */
export function clampPage(requested: number, totalPages: number): number {
  return Math.min(requested, Math.max(totalPages, 1));
}
