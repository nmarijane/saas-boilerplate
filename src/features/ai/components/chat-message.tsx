"use client";

import { BotIcon, UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/shared/utils/cn";

interface ChatMessageProps {
  role: string;
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div className={cn("flex gap-3 px-4 py-3", isAssistant && "bg-muted/50")}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
        {isAssistant ? (
          <BotIcon className="size-4" />
        ) : (
          <UserIcon className="size-4" />
        )}
      </div>
      <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none flex-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}