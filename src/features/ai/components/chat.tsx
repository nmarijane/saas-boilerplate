"use client";

import type { ChatFailure, ChatState } from "@/features/ai/chat-transport";
import type { AIModelConfig } from "@/features/ai/config/models";
import { useChat } from "@ai-sdk/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatFailureOf, chatTransport, isEmptyReply, textOf } from "@/features/ai/chat-transport";
import { ChatError } from "./chat-error";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { CreditBalance } from "./credit-balance";
import { ModelSelector } from "./model-selector";

interface ChatProps {
  /** The conversation the page opened, or null: the first message starts one. */
  conversationId: string | null;
  orgId: string;
  initialMessages?: Array<{ role: string; content: string }>;
  availableModels: AIModelConfig[];
  defaultModel: string;
  unlimited?: boolean;
  /** Where the workspace gets a bigger plan, when the shell offers it to the person (an admin); a workspace with no credits left tells anyone else to ask one. */
  upgradeHref?: string | null;
}

export function Chat({
  conversationId,
  orgId,
  initialMessages = [],
  availableModels,
  defaultModel,
  unlimited,
  upgradeHref = null,
}: ChatProps) {
  const t = useTranslations("ai");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  // What each message is sent with (chat-transport.ts): the conversation, which
  // the route starts with the first message and names in its answer, and the
  // model, read when the message is sent.
  const state = useRef<ChatState>({ conversationId, model: defaultModel });
  const [transport] = useState(() => chatTransport(state));
  // The messages of the conversation the page opened, given to the chat once, when
  // it is made: the page read again (the shell refreshes when the tab comes back)
  // never replaces what the chat holds, such as the answer it is streaming
  const [firstMessages] = useState(() =>
    initialMessages.map((m, i) => ({
      id: String(i),
      role: m.role as "user" | "assistant" | "system",
      parts: [{ type: "text" as const, text: m.content }],
    })),
  );

  // A reply that finished with nothing in it: the route answered, and the provider gave nothing
  const [unanswered, setUnanswered] = useState(false);

  const {
    messages,
    sendMessage,
    regenerate,
    status,
    stop,
    error,
  } = useChat({
    transport,
    messages: firstMessages,
    onFinish: (finish) => setUnanswered(isEmptyReply(finish)),
  });

  const isLoading = status === "streaming" || status === "submitted";
  // What went wrong with the last message, if anything: a refusal or a failure of the route, or a reply that came empty
  let failure: ChatFailure | null = null;
  if (error) {
    failure = chatFailureOf(error);
  } else if (unanswered) {
    failure = "failed";
  }

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function onSubmit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setUnanswered(false);
    void sendMessage({ text });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <ModelSelector
          models={availableModels}
          value={selectedModel}
          onValueChange={(model) => {
            setSelectedModel(model);
            state.current.model = model;
          }}
        />
        <CreditBalance orgId={orgId} unlimited={unlimited} />
      </div>

      {/* Messages: a long conversation scrolls in this box, which a keyboard reaches and a screen reader names */}
      <div ref={scrollRef} role="region" aria-label={t("conversation")} tabIndex={0} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="text-center text-ink-muted">
              <p className="text-section">{t("title")}</p>
              <p className="mt-1 text-body">{t("startConversation")}</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={textOf(message)}
            />
          ))
        )}
      </div>

      {/* What went wrong with the last message: outside the conversation, so that it stays in view */}
      {failure ? (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <ChatError
            failure={failure}
            upgradeHref={upgradeHref}
            // A reload, not a refresh of the router: a refresh keeps this chat, with the conversation
            // it holds (the one that is out of reach), and a reload starts over from what the server holds
            onReload={() => window.location.reload()}
            onRetry={() => {
              setUnanswered(false);
              void regenerate();
            }}
          />
        </div>
      ) : null}

      {/* Input */}
      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={setInput}
        onSubmit={onSubmit}
        onStop={stop}
      />
    </div>
  );
}
