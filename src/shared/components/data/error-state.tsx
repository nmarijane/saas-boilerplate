import { CircleXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { cn } from "@/shared/utils/cn";

interface ErrorStateProps {
  /** Defaults to the translated "Something went wrong". */
  title?: string;
  /** Defaults to the translated "Please try again in a moment." */
  description?: string;
  /**
   * Shows the retry button. A route's `error.tsx` passes its `reset` here. A
   * function cannot cross from a Server Component, so a client component holds
   * it, as `error.tsx` is one.
   */
  onRetry?: () => void;
  /** Defaults to the translated "Try again". */
  retryLabel?: string;
  /**
   * The tag of the title: `h3` by default. A route's `error.tsx` replaces the
   * page, so it passes 1. The look is the same at every level.
   */
  headingLevel?: 1 | 2 | 3;
  className?: string;
}

// What a screen shows when its data did not come. It is an alert, so that
// assistive technology says so as it appears, and its way out is the one button.
// It sits on the same surface as the empty state (empty-state.tsx), and wraps
// its words anywhere for the same reason (see there).
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  headingLevel = 3,
  className,
}: ErrorStateProps) {
  const t = useTranslations("common");
  const Heading = `h${headingLevel}` as const;

  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-hairline bg-surface p-8 text-center",
        className,
      )}
    >
      <IconTile icon={CircleXIcon} tone="danger" size="lg" />
      <Heading className="mt-4 text-section text-balance wrap-anywhere text-ink">
        {title ?? t("errorTitle")}
      </Heading>
      <p className="mt-1 max-w-sm text-body wrap-anywhere text-ink-muted">
        {description ?? t("errorDescription")}
      </p>
      {onRetry ? (
        // The retry is called with nothing: the click event is not its business.
        <Button type="button" className="mt-6" onClick={() => onRetry()}>
          {retryLabel ?? t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
