"use client";

import type { AIModelConfig } from "@/features/ai/config/models";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { CreditBalance } from "./credit-balance";
import { ModelSelector } from "./model-selector";

interface ChatProps {
  conversationId: string;
  orgId: string;
  initialMessages?: Array<{ role: string; content: string }>;
  availableModels: AIModelConfig[];
  defaultModel: string;
  unlimited?: boolean;
}

function getTextFromParts(parts: ReadonlyArray<{ type: string; text?: string }>): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

export function Chat({
  conversationId,
  orgId,
  initialMessages = [],
  availableModels,
  defaultModel,
  unlimited,
}: ChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
  } = useChat({
    transport: {
      async sendMessages({ messages: msgs, abortSignal }) {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: msgs.map((m) => ({
              role: m.role,
              content: getTextFromParts(m.parts),
            })),
            conversationId,
            model: selectedModel,
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        return response.body as ReadableStream;
      },
      async reconnectToStream() {
        return null;
      },
    },
  });

  // Load initial messages once
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && initialMessages.length > 0) {
      initializedRef.current = true;
      setMessages(
        initialMessages.map((m, i) => ({
          id: String(i),
          role: m.role as "user" | "assistant" | "system",
          parts: [{ type: "text" as const, text: m.content }],
        })),
      );
    }
  }, [initialMessages, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

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
    void sendMessage({ text });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <ModelSelector
          models={availableModels}
          value={selectedModel}
          onValueChange={setSelectedModel}
        />
        <CreditBalance orgId={orgId} unlimited={unlimited} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">AI Chat</p>
              <p className="text-sm">Start a conversation with any AI model.</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={getTextFromParts(message.parts)}
            />
          ))
        )}
      </div>

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
