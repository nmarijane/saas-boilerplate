"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { PageAlert } from "@/shared/components/ui/page-alert";

interface AuthConfirmationProps {
  /** What worked, in a sentence. */
  message: string;
  /** What to do next: a link, or a button. */
  children?: ReactNode;
}

// The answer that takes the place of a form once it has worked: a success
// alert, and what to do next. The button of the form had the focus and is gone
// with it, which would leave the focus on the page body: it goes here instead,
// so that assistive technology reads the answer and a keyboard starts from it.
// The box is never a tab stop and draws no ring (it is not a control).
export function AuthConfirmation({ message, children }: AuthConfirmationProps) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    <div ref={box} tabIndex={-1} className="grid gap-4 focus:outline-hidden">
      <PageAlert tone="success">{message}</PageAlert>
      {children}
    </div>
  );
}
