/** How many notifications one request may read. */
export const MAX_NOTIFICATIONS_LIMIT = 100;
const DEFAULT_NOTIFICATIONS_LIMIT = 20;
/** How far into the list a request may start: a person has no use for more, and a huge offset is a slow query. */
export const MAX_NOTIFICATIONS_OFFSET = 10_000;

function whole(value: unknown, fallback: number): number {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

/**
 * The window of the list that a request asks for, as it can be served: a `limit`
 * from 1 to `MAX_NOTIFICATIONS_LIMIT` (20 when it is missing or not a number) and an
 * `offset` from 0 to `MAX_NOTIFICATIONS_OFFSET`. What is asked is the client's word:
 * `?limit=1000000000` would read the whole table.
 */
export function listWindowOf(limit: unknown, offset: unknown): { limit: number; offset: number } {
  const asked = whole(limit, DEFAULT_NOTIFICATIONS_LIMIT);

  return {
    limit: Math.min(Math.max(asked === 0 ? DEFAULT_NOTIFICATIONS_LIMIT : asked, 1), MAX_NOTIFICATIONS_LIMIT),
    offset: Math.min(Math.max(whole(offset, 0), 0), MAX_NOTIFICATIONS_OFFSET),
  };
}
