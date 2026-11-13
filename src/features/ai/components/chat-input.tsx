"use client";

import type { KeyboardEvent } from "react";
import { ArrowUpIcon, CircleAlertIcon, SquareIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { MAX_MESSAGE_LENGTH } from "@/features/ai/config/chat";
import { messageLimit } from "@/features/ai/message-limit";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/utils/cn";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

// The composer. It keeps all of what is typed or pasted: a `maxLength` would
// cut a paste at the limit and say nothing, and the message that left would be
// the first part of a document. Near the limit the route takes it shows how long
// the message is, and past it refuses to send, with the reason next to the field.
// The reason is a status, which a screen reader reads when it is free, and its
// sentence is the same from one character to the next (the count is not in it):
// it is heard when the limit comes near, and when it is passed, not at each key.
// The count is the figure, drawn beside it, and read with the field.
// Enter sends, but not the Enter that ends a composition of an input method (Japanese,
// Chinese, Korean: the person picks a candidate with it). Chrome and Firefox say so on the
// key; Safari ends the composition first and sends that Enter just after, with nothing
// on it to tell it apart, so the composition is held on a tick past its end.
export function ChatInput({ input, isLoading, onInputChange, onSubmit, onStop }: ChatInputProps) {
  const t = useTranslations("ai");
  const format = useFormatter();
  const composing = useRef(false);
  const composed = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusId = useId();
  const countId = useId();

  const limit = messageLimit(input);
  const over = limit.state === "over";
  const showsCount = limit.state !== "within";
  const max = format.number(MAX_MESSAGE_LENGTH);
  let sentence = "";
  if (over) {
    sentence = t("limit.over", { max });
  } else if (limit.state === "near") {
    sentence = t("limit.near", { max });
  }
  // What can be sent: something, no longer than the route takes, and not while an answer is on its way
  const canSend = input.trim() !== "" && !over && !isLoading;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || composing.current) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSubmit();
      }
    }
  }

  function handleCompositionStart() {
    clearTimeout(composed.current);
    composing.current = true;
  }

  function handleCompositionEnd() {
    composed.current = setTimeout(() => {
      composing.current = false;
    }, 0);
  }

  return (
    <div className="border-t bg-background p-4">
      <div className="relative mx-auto max-w-3xl">
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={t("sendMessage")}
          aria-label={t("messageLabel")}
          aria-invalid={over || undefined}
          aria-describedby={[statusId, showsCount ? countId : null].filter(Boolean).join(" ")}
          className="min-h-[60px] resize-none pr-12"
          rows={1}
        />
        <div className="absolute bottom-2 right-2">
          {isLoading ? (
            <Button size="icon" variant="ghost" onClick={onStop}>
              <SquareIcon className="size-4" />
              <span className="sr-only">{t("stopGeneration")}</span>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={onSubmit}
              disabled={!canSend}
            >
              <ArrowUpIcon className="size-4" />
              <span className="sr-only">{t("send")}</span>
            </Button>
          )}
        </div>
      </div>
      <div className={cn("mx-auto flex max-w-3xl items-start justify-between gap-3 text-meta", showsCount && "mt-2")}>
        {/* Always there, so that what it says is heard the first time: only its look changes */}
        <p
          id={statusId}
          role="status"
          className={over ? "flex min-w-0 items-start gap-1.5 text-danger-text" : "sr-only"}
        >
          {over ? <CircleAlertIcon aria-hidden="true" className="mt-px size-4 shrink-0" /> : null}
          {sentence}
        </p>
        {showsCount ? (
          <p id={countId} className={cn("ml-auto shrink-0 tabular-nums", over ? "text-danger-text" : "text-ink-muted")}>
            {t("limit.count", { count: format.number(limit.length), max })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
