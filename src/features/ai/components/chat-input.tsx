"use client";

import type {KeyboardEvent} from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import {  useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ChatInput({ input, isLoading, onInputChange, onSubmit, onStop }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  }

  return (
    <div className="border-t bg-background p-4">
      <div className="relative mx-auto max-w-3xl">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          className="min-h-[60px] resize-none pr-12"
          rows={1}
        />
        <div className="absolute bottom-2 right-2">
          {isLoading ? (
            <Button size="icon" variant="ghost" onClick={onStop}>
              <SquareIcon className="size-4" />
              <span className="sr-only">Stop generation</span>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={onSubmit}
              disabled={!input.trim()}
            >
              <ArrowUpIcon className="size-4" />
              <span className="sr-only">Send message</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}