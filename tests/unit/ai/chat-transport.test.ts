import type { UIMessage, UIMessageChunk } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatFailureOf, chatTransport, isEmptyReply } from "@/features/ai/chat-transport";

// How the chat talks to its route, with the network replaced: what it sends, and
// what it makes of the answer, which the route streams as text.

function message(id: string, role: UIMessage["role"], text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

/** An answer of the route: its text, streamed, and the conversation it names. */
function answer(text: string, conversationId: string | null = "conv_1", status = 200) {
  return new Response(new Blob([text]).stream(), {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...(conversationId ? { "X-Conversation-Id": conversationId } : {}) },
  });
}

async function chunksOf(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    chunks.push(read.value);
  }
  return chunks;
}

function send(state: { current: { conversationId: string | null; model: string } }, messages: UIMessage[]) {
  return chatTransport(state).sendMessages({
    trigger: "submit-message",
    chatId: "chat",
    messageId: undefined,
    messages,
    abortSignal: undefined,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the transport of the chat", () => {
  it("sends the person's new message alone, with the conversation and the model: the route holds the rest", async () => {
    const fetch = vi.fn(async () => answer("Hi"));
    vi.stubGlobal("fetch", fetch);
    const state = { current: { conversationId: "conv_1", model: "gpt-4o" } };

    await chunksOf(await send(state, [message("1", "user", "Draft it"), message("2", "assistant", "Done."), message("3", "user", "Shorter")]));

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai/chat");
    expect(JSON.parse(String(init.body))).toEqual({
      messages: [{ role: "user", content: "Shorter" }],
      conversationId: "conv_1",
      model: "gpt-4o",
    });
  });

  // It used to hand the bytes of the answer to the chat, which reads message parts:
  // the reply streamed, and nothing was drawn
  it("turns the text the route streams into the parts of a message the chat draws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer("Here is a draft.")));

    const chunks = await chunksOf(await send({ current: { conversationId: null, model: "gpt-4o-mini" } }, [message("1", "user", "Hello")]));

    expect(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("")).toBe("Here is a draft.");
  });

  it("goes on with the conversation the route started with the first message", async () => {
    const fetch = vi.fn(async () => answer("Hi", "conv_new"));
    vi.stubGlobal("fetch", fetch);
    const state = { current: { conversationId: null as string | null, model: "gpt-4o-mini" } };

    await chunksOf(await send(state, [message("1", "user", "Hello")]));
    expect(JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).conversationId).toBeUndefined();
    expect(state.current.conversationId).toBe("conv_new");

    await chunksOf(await send(state, [message("1", "user", "Hello"), message("2", "assistant", "Hi"), message("3", "user", "And then?")]));
    expect(JSON.parse(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body)).conversationId).toBe("conv_new");
  });

  it("rejects a refusal of the route, and keeps the conversation it had", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer("Insufficient credits", null, 402)));
    const state = { current: { conversationId: "conv_1", model: "gpt-4o-mini" } };

    await expect(send(state, [message("1", "user", "Hello")])).rejects.toThrow();
    expect(state.current.conversationId).toBe("conv_1");
  });

  // The sentence of the route is English and written for a developer: the chat tells the
  // person its own, chosen by the status
  it("never carries the sentence of the route in the error it rejects with", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer("Conversation not found", null, 404)));

    const error = await send({ current: { conversationId: "conv_1", model: "gpt-4o-mini" } }, [message("1", "user", "Hello")]).catch((rejected: unknown) => rejected);

    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message)).not.toContain("Conversation not found");
  });
});

/** The error the transport rejects with when the route answers with this status. */
async function refusedWith(status: number): Promise<unknown> {
  vi.stubGlobal("fetch", vi.fn(async () => answer("The sentence of the route", null, status)));

  return send({ current: { conversationId: "conv_1", model: "gpt-4o-mini" } }, [message("1", "user", "Hello")]).catch((rejected: unknown) => rejected);
}

// What the chat tells of an error: by the status of the route's answer, since the sentence of
// the route is English. No credits, a workspace that is gone or out of reach, or a failure to
// try again.
describe("what the chat makes of a refusal or a failure", () => {
  it("tells the 402 of a workspace with no credits left", async () => {
    expect(chatFailureOf(await refusedWith(402))).toBe("credits");
  });

  it.each([401, 403, 404])("tells a %i as a workspace that is gone or out of reach, or a session that has ended: reload", async (status) => {
    expect(chatFailureOf(await refusedWith(status))).toBe("gone");
  });

  it.each([400, 408, 413, 422, 429, 500, 502, 503, 504])("tells a %i as a failure to try again", async (status) => {
    expect(chatFailureOf(await refusedWith(status))).toBe("failed");
  });

  it("tells a call that fails outright (the network) as a failure to try again", () => {
    expect(chatFailureOf(new TypeError("Failed to fetch"))).toBe("failed");
  });

  it("tells anything else as a failure to try again", () => {
    for (const other of [new Error("boom"), "boom", undefined, null, 402, { status: 402 }]) {
      expect(chatFailureOf(other), String(other)).toBe("failed");
    }
  });
});

// A provider that fails answers 200 with nothing in it (the route reads its error and logs it):
// the person would see an empty answer and no word of why
describe("a reply that came empty", () => {
  const reply = (...parts: UIMessage["parts"]) => ({ id: "r", role: "assistant" as const, parts });
  const finish = (parts: UIMessage["parts"], over: { isAbort?: boolean; isError?: boolean } = {}) =>
    isEmptyReply({ message: reply(...parts), isAbort: false, isError: false, ...over });

  it("is told when the answer has no text", () => {
    expect(finish([])).toBe(true);
    expect(finish([{ type: "text", text: "" }])).toBe(true);
    expect(finish([{ type: "text", text: "  \n " }])).toBe(true);
    expect(finish([{ type: "step-start" }, { type: "text", text: "" }])).toBe(true);
  });

  it("is not told when the answer says something", () => {
    expect(finish([{ type: "text", text: "Here is a draft." }])).toBe(false);
    expect(finish([{ type: "text", text: "Hi" }, { type: "text", text: "" }])).toBe(false);
  });

  it("is not told when the person pressed Stop before the first word: they asked for it", () => {
    expect(finish([], { isAbort: true })).toBe(false);
  });

  it("is not told when the call failed: an error has its own account", () => {
    expect(finish([], { isError: true })).toBe(false);
  });
});
