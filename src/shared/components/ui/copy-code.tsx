"use client";

import { CheckIcon, CircleAlertIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/shared/components/ui/button";
import { copyText } from "@/shared/utils/clipboard";
import { cn } from "@/shared/utils/cn";

/** How long the button says "Copied", in milliseconds. */
const COPIED_FOR = 2000;

type Outcome = "idle" | "copied" | "failed";

interface CopyCodeProps {
  /** The text that is shown, and the text that is copied. */
  value: string;
  /** The button takes the focus when the box appears: for a dialog that is only about this text. */
  autoFocus?: boolean;
  className?: string;
}

// A text in mono, in a box, with the button that copies it: the key or the
// secret that is shown once. The text breaks anywhere, so that a long one is
// seen whole, and a click on it selects all of it (`select-all`): the way left
// when the browser has no clipboard to give. The button says "Copied" for a
// moment, and a region that is in the page before its text says it to those who
// hear (a status that comes with its words is not always announced). A copy that
// fails is told by an alert, which stays until the next try.
function CopyCode({ value, autoFocus, className }: CopyCodeProps) {
  const t = useTranslations("common");
  const [outcome, setOutcome] = React.useState<Outcome>("idle");

  React.useEffect(() => {
    if (outcome !== "copied") {
      return;
    }

    const timer = setTimeout(setOutcome, COPIED_FOR, "idle");
    return () => clearTimeout(timer);
  }, [outcome]);

  const copy = async () => {
    setOutcome((await copyText(value)) ? "copied" : "failed");
  };

  const copied = outcome === "copied";

  return (
    <div data-slot="copy-code" className={cn("flex flex-col gap-3", className)}>
      <code className="rounded-md bg-secondary px-3 py-2 font-mono text-body break-all text-ink select-all">
        {value}
      </code>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="outline"
          autoFocus={autoFocus}
          onClick={() => void copy()}
        >
          {copied ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          {copied ? t("copied") : t("copy")}
        </Button>
        <span role="status" className="sr-only">
          {copied ? t("copied") : null}
        </span>
        {outcome === "failed" ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-meta text-danger-text"
          >
            <CircleAlertIcon
              aria-hidden="true"
              className="mt-px size-4 shrink-0"
            />
            {t("copyFailed")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { CopyCode };
export type { CopyCodeProps };
