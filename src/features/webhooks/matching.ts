/**
 * Match an event name against a list of subscribed patterns.
 * Patterns: exact ("member.invited"), wildcard segment ("subscription.*"),
 * or wildcard all ("**").
 */
export function matchEvent(eventName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchPattern(eventName, pattern));
}

function matchPattern(eventName: string, pattern: string): boolean {
  if (pattern === "**") return true;
  if (pattern === eventName) return true;

  const eventParts = eventName.split(".");
  const patternParts = pattern.split(".");

  if (eventParts.length !== patternParts.length) return false;

  return patternParts.every(
    (part, i) => part === "*" || part === eventParts[i],
  );
}
