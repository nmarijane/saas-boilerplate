"use client";

import { MessageSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { navRowStyles } from "@/shared/components/shell/nav-row";
import { Button } from "@/shared/components/ui/button";
import { FeedbackModal } from "./feedback-modal";

interface FeedbackButtonProps {
  /**
   * `icon` is a button of its own, for a bar. `nav` is a row of the sidebar,
   * drawn like the rows of the navigation (the same styles, `navRowStyles`) with
   * its label.
   */
  variant?: "icon" | "nav";
}

// The button that opens the feedback dialog. Either way it says that it opens a
// dialog, and gets the focus back when the dialog closes.
export function FeedbackButton({ variant = "icon" }: FeedbackButtonProps) {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  // The dialog has no Radix `Trigger` to give the focus back to: this button
  // does (see `onCloseAutoFocus` of the dialog).
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };

  const opener = {
    type: "button",
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    onClick: () => setOpen(true),
  } as const;

  return (
    <>
      {variant === "nav" ? (
        <button ref={trigger} className={navRowStyles} {...opener}>
          <MessageSquareIcon aria-hidden="true" />
          <span className="truncate">{t("nav")}</span>
        </button>
      ) : (
        <Button
          ref={trigger}
          variant="ghost"
          size="icon"
          aria-label={t("nav")}
          {...opener}
        >
          <MessageSquareIcon aria-hidden="true" className="size-5" />
        </Button>
      )}
      <FeedbackModal
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={restoreFocus}
      />
    </>
  );
}
