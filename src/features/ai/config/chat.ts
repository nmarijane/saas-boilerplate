/**
 * The header of the chat route's answer that names the conversation: the first
 * message starts one, and the chat sends the next messages to it.
 */
export const CONVERSATION_HEADER = "X-Conversation-Id";

// What one request of the chat can cost is bounded: the message it sends, the
// history the model is given, and the answer (`maxOutputTokens` of the model,
// config/models.ts). Raise them for a product whose people need more.

/** The longest message a person can send, in characters: about 2,000 tokens. The route refuses a longer one. */
export const MAX_MESSAGE_LENGTH = 8_000;

/** From this length the composer shows how long the message is, against the limit: nine tenths of it. */
export const MESSAGE_COUNT_FROM = Math.floor(MAX_MESSAGE_LENGTH * 0.9);

/** How many of the latest messages of a conversation the model is given with the new one: ten exchanges. */
export const MAX_HISTORY_MESSAGES = 20;
