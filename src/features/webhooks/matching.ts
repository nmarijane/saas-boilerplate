/**
 * Webhook event matching placeholder.
 * Properly implemented in Task 9 (Webhook event matching utility).
 */

/**
 * Check if an event name matches any of the subscribed event patterns.
 * Supports exact match and wildcard patterns (e.g., "member.*").
 */
export function matchEvent(eventName: string, subscribedEvents: string[]): boolean {
  return subscribedEvents.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern === eventName) return true;
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return eventName.startsWith(`${prefix}.`);
    }
    return false;
  });
}
