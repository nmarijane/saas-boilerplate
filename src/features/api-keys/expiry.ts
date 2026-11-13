/**
 * When a key can end, written once. The server (`createApiKeyAction`) and the
 * dialog that makes the key both read it from here, so that the day the dialog
 * offers and the day the server takes are the same one and cannot drift apart.
 * Nothing else is in this module, and it imports nothing: the action and the
 * dialog can both import it.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * The first day a key can end on, as a date field holds it (`2026-11-05`):
 * tomorrow, by the clock of UTC. The server takes a day for the very start of it
 * (`2026-12-31` is midnight at the start of that day, in UTC), so a key that ends
 * today has ended already, and would be born expired, and counted nowhere. A day
 * is added to the moment, not to the date, which UTC makes the same thing: it has
 * no change of the hour.
 */
export function earliestEnd(now: Date): string {
  return new Date(now.getTime() + DAY).toISOString().slice(0, 10);
}

/** The moment a day, as a date field holds it (`2026-12-31`), starts: midnight at the start of it, in UTC. */
export function startOfDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
