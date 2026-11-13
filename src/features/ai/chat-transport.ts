import type { UIMessage } from "ai";
import { TextStreamChatTransport } from "ai";
import { CONVERSATION_HEADER } from "./config/chat";

/** What the chat sends with a message: the conversation it goes on with (none before the first), and the model the person picked. */
export interface ChatState {
  conversationId: string | null;
  model: string;
}

/** The text of a message of the chat, from its parts. */
export function textOf(message: Pick<UIMessage, "parts">): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * What the route refused with. The transport of the SDK rejects with the
 * sentence of the answer, in English and written for a developer, and the
 * status is lost with it: this keeps the status, which is what the chat tells
 * the refusal by. The sentence is left out on purpose.
 */
class ChatRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`The chat route answered ${status}`);
    this.name = "ChatRequestError";
    this.status = status;
  }
}

/**
 * What the chat tells of an error: the workspace has no credits left (402), the
 * workspace is gone or out of reach (the session ended, 401; no workspace, 403;
 * a conversation that is not this workspace's, 404: a reload shows where the
 * person stands), or a failure that trying again may mend (any other status, and
 * a call that does not reach the route at all).
 */
export type ChatFailure = "credits" | "gone" | "failed";

export function chatFailureOf(error: unknown): ChatFailure {
  if (error instanceof ChatRequestError) {
    if (error.status === 402) {
      return "credits";
    }
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return "gone";
    }
  }

  return "failed";
}

/**
 * Whether a reply that has finished is an answer that never came. A provider
 * that fails (a key refused, a quota spent) leaves the route with nothing to
 * stream: it answers 200 and an empty body, and the chat would draw an empty
 * message, with no word of why. A reply the person stopped is not one (they
 * asked for it), and neither is one that failed, which has its error.
 */
export function isEmptyReply({
  message,
  isAbort,
  isError,
}: {
  message: Pick<UIMessage, "parts">;
  isAbort: boolean;
  isError: boolean;
}): boolean {
  return !isAbort && !isError && textOf(message).trim() === "";
}

/**
 * How the chat talks to its route. It sends the person's new message alone,
 * with the conversation and the model: the route gives the model the history it
 * holds, and reads no other message of the client. The answer is the text the
 * route streams, turned into the parts of a message the chat draws. The route
 * names the conversation in its answer, as the first message starts one: the
 * state keeps it for the next message. The state is read at each message, so
 * that a model picked since is the one sent. A refusal rejects with its status
 * (`chatFailureOf` reads it), and none of what the route said.
 */
export function chatTransport(state: { current: ChatState }) {
  return new TextStreamChatTransport<UIMessage>({
    api: "/api/ai/chat",
    prepareSendMessagesRequest: ({ messages }) => {
      const last = messages.findLast((message) => message.role === "user");
      return {
        body: {
          messages: last ? [{ role: "user", content: textOf(last) }] : [],
          conversationId: state.current.conversationId ?? undefined,
          model: state.current.model,
        },
      };
    },
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      if (!response.ok) {
        // Its sentence is not read: the body is let go
        await response.body?.cancel().catch(() => {});
        throw new ChatRequestError(response.status);
      }
      state.current.conversationId = response.headers.get(CONVERSATION_HEADER) ?? state.current.conversationId;
      return response;
    },
  });
}
