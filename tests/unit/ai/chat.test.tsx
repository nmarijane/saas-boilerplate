import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatTransport } from "@/features/ai/chat-transport";
import { Chat } from "@/features/ai/components/chat";
import { attribute, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// What the chat hands the chat hook of the AI SDK, replaced: the hook keeps its
// messages for as long as the chat is mounted, and the page that is read again
// (the shell refreshes when the tab comes back) gives new props to the same chat.
// What the hook answers (its error, its messages) is the test's to say.
const hook = vi.hoisted(() => ({
  options: [] as Record<string, unknown>[],
  setMessages: vi.fn(),
  error: undefined as unknown,
  messages: [] as unknown[],
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: (options: Record<string, unknown>) => {
    hook.options.push(options);
    return {
      messages: hook.messages,
      setMessages: hook.setMessages,
      sendMessage: vi.fn(),
      regenerate: vi.fn(),
      status: hook.error ? "error" : "ready",
      error: hook.error,
      stop: vi.fn(),
    };
  },
}));
// The balance of credits asks the server: not here
vi.mock("@/features/ai/components/credit-balance", () => ({ CreditBalance: () => null }));
// The navigation of next-intl is replaced (no Next router runs in a test)
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
  };
});

beforeEach(() => {
  hook.options.length = 0;
  hook.setMessages.mockClear();
  hook.error = undefined;
  hook.messages = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function draw(
  initialMessages: { role: string; content: string }[],
  { locale = "en", upgradeHref }: { locale?: "en" | "fr"; upgradeHref?: string | null } = {},
) {
  return renderWithIntl(
    <Chat
      conversationId={initialMessages.length > 0 ? "conv_1" : null}
      orgId="org_1"
      initialMessages={initialMessages}
      availableModels={[]}
      defaultModel="gpt-4o-mini"
      upgradeHref={upgradeHref}
    />,
    locale,
  );
}

/** The error the chat hook holds when the route answers with this status: what the transport rejects with. */
async function refusedWith(status: number): Promise<unknown> {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("The sentence of the route", { status })));

  return chatTransport({ current: { conversationId: "conv_1", model: "gpt-4o-mini" } })
    .sendMessages({
      trigger: "submit-message",
      chatId: "chat",
      messageId: undefined,
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }],
      abortSignal: undefined,
    })
    .catch((rejected: unknown) => rejected);
}

const alertsOf = (html: string) => startTags(html, "div").filter((tag) => attribute(tag, "data-slot") === "page-alert");

describe("the chat of the assistant", () => {
  // Messages the chat hook is given once, when it is made: new props of the page
  // never replace what the hook holds, such as an answer that is streaming
  it("gives the hook the messages of the conversation as its first ones, and sets none afterwards", () => {
    draw([
      { role: "user", content: "Draft the launch email" },
      { role: "assistant", content: "Subject: Orbit is here" },
    ]);

    expect(hook.options.at(-1)?.messages).toEqual([
      { id: "0", role: "user", parts: [{ type: "text", text: "Draft the launch email" }] },
      { id: "1", role: "assistant", parts: [{ type: "text", text: "Subject: Orbit is here" }] },
    ]);
    expect(hook.setMessages).not.toHaveBeenCalled();
  });

  it("does not stop a paste at the limit: the composer keeps it, and says when it is too long", () => {
    const [textarea = ""] = startTags(draw([]), "textarea");

    expect(textarea.toLowerCase()).not.toContain("maxlength");
  });

  // A long conversation scrolls in its box: a keyboard that cannot reach the box cannot read it
  it("draws the conversation in a box that a keyboard reaches and a screen reader names", () => {
    const [box = ""] = startTags(draw([]), "div").filter((tag) => attribute(tag, "role") === "region");

    expect(attribute(box, "aria-label")).toBe("Conversation");
    expect(attribute(box, "tabindex")).toBe("0");
    expect(attribute(startTags(draw([], { locale: "fr" }), "div").find((tag) => attribute(tag, "role") === "region") ?? "", "aria-label")).toBe("Conversation");
  });

  describe("when there is nothing to say yet", () => {
    it("invites to start, in the words of the page", () => {
      expect(textOf(draw([]))).toContain("AI Chat");
      expect(textOf(draw([]))).toContain("Start a conversation with any AI model.");
      expect(textOf(draw([], { locale: "fr" }))).toContain("Chat IA");
      expect(textOf(draw([], { locale: "fr" }))).toContain("Démarrez une conversation avec le modèle d'IA de votre choix.");
    });

    it("says nothing in English on a page in French", () => {
      const fr = textOf(draw([], { locale: "fr" }));

      expect(fr).not.toContain("Start a conversation");
      expect(fr).not.toContain("Send");
    });
  });

  describe("what it tells when the route refuses or fails", () => {
    it("tells nothing while all goes well", () => {
      expect(alertsOf(draw([]))).toHaveLength(0);
    });

    it("tells an admin that the workspace has no credits left, with the way to a bigger plan", async () => {
      hook.error = await refusedWith(402);

      const html = draw([], { upgradeHref: "/settings/billing" });

      expect(textOf(html)).toContain("No credits left");
      expect(textOf(html)).toContain("Top up credits, or change the plan, to keep using the assistant.");
      expect(startTags(html, "a").map((tag) => attribute(tag, "href"))).toEqual(["/settings/billing?topup=1", "/settings/billing"]);
    });

    it("tells a member to ask an admin, with no way of their own", async () => {
      hook.error = await refusedWith(402);

      const html = draw([], { upgradeHref: null });

      expect(textOf(html)).toContain("No credits left");
      expect(textOf(html)).toContain("Ask an admin to upgrade the plan.");
      expect(startTags(html, "a")).toHaveLength(0);
    });

    it("tells a member the same when the page gives no way up at all", async () => {
      hook.error = await refusedWith(402);

      expect(textOf(draw([]))).toContain("Ask an admin to upgrade the plan.");
    });

    it.each([401, 403, 404])("tells a %i that the workspace is gone or out of reach, and offers to reload", async (status) => {
      hook.error = await refusedWith(status);

      const html = draw([], { upgradeHref: "/settings/billing" });

      expect(textOf(html)).toContain("You can't continue here");
      expect(textOf(html)).toContain("Reload the page to continue.");
      expect(elements(html, "button").map(textOf)).toContain("Reload the page");
      expect(startTags(html, "a")).toHaveLength(0);
    });

    it.each([400, 429, 500, 502, 503])("tells a %i that the message got no answer, and offers to try again", async (status) => {
      hook.error = await refusedWith(status);

      const html = draw([]);

      expect(textOf(html)).toContain("Something went wrong");
      expect(textOf(html)).toContain("Your message didn't get an answer. Try again in a moment, or rephrase it.");
      expect(elements(html, "button").map(textOf)).toContain("Try again");
    });

    it("tells a network error the same way: try again", () => {
      hook.error = new TypeError("Failed to fetch");

      const html = draw([]);

      expect(textOf(html)).toContain("Your message didn't get an answer. Try again in a moment, or rephrase it.");
      expect(elements(html, "button").map(textOf)).toContain("Try again");
    });

    it("never shows the sentence of the route, whatever the refusal", async () => {
      for (const status of [402, 403, 404, 500]) {
        hook.error = await refusedWith(status);

        expect(textOf(draw([], { upgradeHref: "/settings/billing" })), String(status)).not.toContain("The sentence of the route");
      }
    });

    it("tells it in French", async () => {
      hook.error = await refusedWith(402);
      const credits = textOf(draw([], { locale: "fr", upgradeHref: "/settings/billing" }));
      hook.error = await refusedWith(404);
      const gone = textOf(draw([], { locale: "fr" }));
      hook.error = await refusedWith(500);
      const failed = textOf(draw([], { locale: "fr" }));

      expect(credits).toContain("Plus de crédits");
      expect(gone).toContain("Rechargez la page pour continuer.");
      expect(failed).toContain("Votre message n'a pas reçu de réponse.");
    });

    // The answer of the chat that came empty is told by the hook's `onFinish`: it is told in the
    // plays of the stories, which can let a reply finish
    it("hears when a reply finishes, to tell one that came empty", () => {
      draw([]);

      expect(hook.options.at(-1)?.onFinish).toEqual(expect.any(Function));
    });

    it("draws one alert at most, outside the conversation, so that it stays in view", async () => {
      hook.error = await refusedWith(500);
      hook.messages = [{ id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] }];

      expect(alertsOf(draw([]))).toHaveLength(1);
    });
  });
});
