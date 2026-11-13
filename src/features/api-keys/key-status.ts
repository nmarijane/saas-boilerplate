/** What an API key can still do: open the API, or not any more, because it ran out or because it was revoked. */
export type ApiKeyStatus = "active" | "expired" | "revoked";

/**
 * The status of a key at `now`, by the one rule that "can still be used" has
 * (`isUsable` in queries.ts, behind the count of the active keys): a key that
 * was revoked is revoked, whatever its expiry; one whose expiry has come is
 * expired (on the very moment: a key is usable only before it); any other is
 * active. The page works it out on the server, with its own clock, and gives
 * the word to the list: a list drawn on the client would work it out again from
 * another clock, and the two would not agree when the page hydrates.
 */
export function apiKeyStatus(
  key: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date,
): ApiKeyStatus {
  if (key.revokedAt) {
    return "revoked";
  }

  return key.expiresAt && key.expiresAt.getTime() <= now.getTime()
    ? "expired"
    : "active";
}
