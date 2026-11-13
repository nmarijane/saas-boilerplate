"use client";

import { useEffect, useRef } from "react";
import { ErrorState } from "@/shared/components/data/error-state";

interface RouteErrorProps {
  /** What the boundary caught. The state says nothing of it: a new one is a new alert. */
  error: unknown;
  /** The `retry` of the boundary: it fetches the segment again and draws it again. */
  retry: () => void;
}

// What a route's `error.tsx` draws in place of its page: the error state, whose
// title is the one h1 left on the page, and its retry. What had the focus (the
// link that led here, the button of a retry) went with the page, which leaves
// the focus on the body: it goes to the title, where assistive technology reads
// the alert and a keyboard starts from. A focus that is on something else stays
// there: the shell around the error is still drawn, and its links are still the
// reader's. What the error said is not drawn: in development it reaches the
// page, and it may hold a query or an address. The `error.tsx` that draws this
// state is the one that reports it.
export function RouteError({ error, retry }: RouteErrorProps) {
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (document.activeElement === document.body) {
      title.current?.focus();
    }
  }, [error]);

  return <ErrorState headingLevel={1} onRetry={retry} titleRef={title} />;
}
