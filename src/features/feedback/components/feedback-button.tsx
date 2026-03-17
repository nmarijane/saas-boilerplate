"use client";

import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { FeedbackModal } from "./feedback-modal";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <MessageSquare className="h-5 w-5" />
        <span className="sr-only">Feedback</span>
      </Button>
      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
