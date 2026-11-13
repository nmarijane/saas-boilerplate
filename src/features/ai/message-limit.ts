import { MAX_MESSAGE_LENGTH, MESSAGE_COUNT_FROM } from "./config/chat";

/** How a message stands against the longest one the route takes. */
interface MessageLimit {
  /** Far from it, close to it (the composer shows the count), or past it (the composer refuses to send). */
  state: "within" | "near" | "over";
  /** How long the message is, as the route counts it. */
  length: number;
}

/**
 * Where a message stands against `MAX_MESSAGE_LENGTH`. It counts what would be
 * sent, as the route counts it: the text without the spaces around it (the chat
 * sends it trimmed), in characters, as `z.string().max()` does in Zod 4 (code
 * points: an emoji is one, though it takes two UTF-16 units). A message that is
 * exactly the limit is taken.
 */
export function messageLimit(text: string): MessageLimit {
  const length = [...text.trim()].length;
  if (length > MAX_MESSAGE_LENGTH) {
    return { state: "over", length };
  }

  return { state: length >= MESSAGE_COUNT_FROM ? "near" : "within", length };
}
