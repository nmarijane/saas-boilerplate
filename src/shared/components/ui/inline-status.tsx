import { CheckIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Spinner } from "@/shared/components/ui/spinner";
import { cn } from "@/shared/utils/cn";

const states = {
  running: "text-ink-muted",
  success: "text-success-text",
  error: "text-danger-text",
} as const;

type InlineState = keyof typeof states;

/** A spinner, a tick or a cross: the state is told by a shape, and the color only echoes it. */
function StateIcon({ state }: { state: InlineState }) {
  // The status around it speaks: a spinner of its own would announce it twice.
  if (state === "running") {
    return <Spinner label="" />;
  }

  const Icon = state === "success" ? CheckIcon : XIcon;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

interface InlineStatusProps {
  state: InlineState;
  /** What is going on, said in words: "Saving…", "Saved", "Could not save". */
  children: React.ReactNode;
}

// The state of one action, next to what it acts on. A status is announced when
// its text changes, so the words must change with the state.
function InlineStatus({ state, children }: InlineStatusProps) {
  return (
    <span
      data-slot="inline-status"
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-meta font-medium",
        states[state],
      )}
    >
      <StateIcon state={state} />
      {children}
    </span>
  );
}

export { InlineStatus };
export type { InlineStatusProps };
